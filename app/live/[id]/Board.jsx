'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { realtime, joinTopic, postTo, topics } from '@/lib/room';
import { createSession, markSession, saveRound, finishSession } from '@/app/actions/games';
import { mediaUrl } from '@/lib/media';
import { createHostKeys, signMessage, sharedKey, unseal, validJwk, sameJwk } from '@/lib/gamecrypto';
import { TYPES, isCorrect, pointsFor, normalizeText, shuffle, POINTS } from '@/lib/questions';
import { OPTION_STYLES, Shape } from '@/components/Shape';
import { LogoMark } from '@/components/Logo';
import { Icon } from '@/components/Icons';

const INTRO_SECONDS = 4;
const MAX_PLAYERS = 250;
const ID_RE = /^[a-z0-9]{6,24}$/;

function newPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function publicQuestion(q) {
  return {
    type: q.type,
    text: q.text,
    image: mediaUrl(q.image_url),
    time: q.time_limit,
    options: q.type === 'text' ? [] : q.type === 'order' ? q.perm.map((i) => q.options[i].text) : q.options.map((o) => o.text),
    perm: q.type === 'order' ? q.perm : undefined,
  };
}

function validAnswer(q, a) {
  if (!a || typeof a !== 'object') return null;
  const n = q.options.length;
  if (q.type === 'single' || q.type === 'truefalse' || q.type === 'poll') return Number.isInteger(a.c) && a.c >= 0 && a.c < n ? { c: a.c } : null;
  if (q.type === 'multiple') {
    const m = Array.isArray(a.m) ? [...new Set(a.m)].filter((i) => Number.isInteger(i) && i >= 0 && i < n) : [];
    return m.length ? { m } : null;
  }
  if (q.type === 'text') {
    const t = String(a.t || '').trim().slice(0, 120);
    return t ? { t } : null;
  }
  if (q.type === 'order') {
    const o = Array.isArray(a.o) ? a.o : [];
    const ok = o.length === n && [...o].sort((x, y) => x - y).every((v, i) => v === i);
    return ok ? { o } : null;
  }
  return null;
}

export default function Board({ quiz, questions, skipped, isOwner, rt }) {
  const G = useRef(null);
  const room = useRef(null);
  const upRoom = useRef(null);
  const timer = useRef(null);
  const persistChain = useRef(Promise.resolve());
  const sendQueue = useRef(Promise.resolve());
  const keysRef = useRef(null);
  const [, render] = useReducer((x) => x + 1, 0);
  const [qr, setQr] = useState('');
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState('');
  const [dbError, setDbError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    const warn = (e) => {
      if (G.current && G.current.phase !== 'podium') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    const keys = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.target.tagName === 'BUTTON' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        advance();
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('keydown', keys);
      clearInterval(timer.current);
      clearTimeout(timer.current);
      if (room.current) room.current.close();
      if (upRoom.current) upRoom.current.close();
    };
  }, []);

  const g = G.current;

  function persist(fn) {
    persistChain.current = persistChain.current
      .then(fn)
      .then(() => setDbError(''))
      .catch((e) => setDbError((e?.message || 'Rezultatele nu au putut fi salvate.') + ' Jocul continuă.'));
    return persistChain.current;
  }

  function saveAfterQuestion(qIndex) {
    const s = G.current;
    const q = s.questions[qIndex];
    const players = s.order.map((id) => {
      const p = s.players[id];
      return { clientId: id, name: p.name, score: p.score, correctCount: p.correctCount, answeredCount: p.answeredCount };
    });
    const answers = Object.entries(s.answers).map(([cid, a]) => ({
      clientId: cid,
      value: a.value,
      isCorrect: q.type === 'poll' ? null : !!s.lastResults[cid]?.correct,
      points: s.lastResults[cid]?.gained || 0,
      timeMs: Math.round(a.elapsed * 1000),
    }));
    persist(async () => {
      const r = await saveRound({ sessionId: s.sessionId, qIndex, players, answers });
      if (!r.ok) throw new Error(r.error);
    });
  }

  function saveFinal() {
    const s = G.current;
    const ranking = [...s.order].sort((x, y) => s.players[y].score - s.players[x].score);
    const gradable = s.questions.filter((q) => q.type !== 'poll').length;
    const accs = s.order.map((id) => (gradable ? (s.players[id].correctCount / gradable) * 100 : null)).filter((v) => v !== null);
    const avg = accs.length ? accs.reduce((t, v) => t + v, 0) / accs.length : null;
    persist(async () => {
      const r = await finishSession({ sessionId: s.sessionId, ranking, playerCount: s.order.length, avgAccuracy: avg });
      if (!r.ok) throw new Error(r.error);
    });
  }

  function signed(payload) {
    const s = G.current;
    return signMessage(s.keys.signKey, { ...payload, sid: s.sessionId });
  }

  function broadcast(payload) {
    const s = G.current;
    const r = room.current;
    if (!r || !s) return;
    sendQueue.current = sendQueue.current.then(async () => { r.send('state', await signed(payload)); }).catch(() => {});
  }

  function sendTo(id, event, payload) {
    const s = G.current;
    if (!s) return;
    sendQueue.current = sendQueue.current.then(async () => { await postTo(realtime(rt), topics.me(s.pin, id), event, await signed({ ...payload, to: id })); }).catch(() => {});
  }

  function snapshotFor(id) {
    const s = G.current;
    const p = s.players[id];
    const base = { phase: s.phase, qIndex: s.qIndex, total: s.questions.length, title: s.title, score: p ? p.score : 0 };
    if (s.phase === 'question') {
      const q = s.questions[s.qIndex];
      const left = Math.max(0, q.time_limit - (Date.now() - s.qStart) / 1000);
      return { ...base, question: publicQuestion(q), remaining: left, answered: !!s.answers[id] };
    }
    if (s.phase === 'intro') {
      const q = s.questions[s.qIndex];
      return { ...base, question: { text: q.text, type: q.type } };
    }
    return base;
  }

  async function onJoin(msg) {
    const s = G.current;
    const id = msg && msg.id;
    if (!s || typeof id !== 'string' || !ID_RE.test(id) || !validJwk(msg.pub) || s.phase === 'podium') return;
    if (s.kicked.has(id)) return;
    const existing = s.players[id];
    if (existing) {
      if (!sameJwk(existing.pub, msg.pub)) return;
    } else {
      if (s.locked || s.order.length >= MAX_PLAYERS || s.pending.has(id)) return;
      s.pending.add(id);
      let key;
      try {
        key = await sharedKey(s.keys.dhKey, msg.pub);
      } catch {
        s.pending.delete(id);
        return;
      }
      s.pending.delete(id);
      if (G.current !== s || s.players[id] || s.locked || s.order.length >= MAX_PLAYERS) return;
      const clean = String(msg.name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Fără nume';
      const taken = Object.values(s.players).map((p) => p.name.toLowerCase());
      let n = clean, k = 2;
      while (taken.includes(n.toLowerCase())) n = `${clean} ${k++}`;
      s.players[id] = { id, name: n, pub: msg.pub, key, score: 0, streak: 0, correctCount: 0, answeredCount: 0 };
      s.order.push(id);
    }
    sendTo(id, 'welcome', { id, name: s.players[id].name, snapshot: snapshotFor(id) });
    render();
  }

  async function onAnswer(msg) {
    const s = G.current;
    const at = Date.now();
    if (!s || s.phase !== 'question' || !msg || typeof msg.id !== 'string') return;
    const p = s.players[msg.id];
    if (!p || s.answers[msg.id]) return;
    const data = await unseal(p.key, msg.box);
    if (!data || G.current !== s || s.phase !== 'question' || data.qIndex !== s.qIndex || s.answers[msg.id]) return;
    const q = s.questions[s.qIndex];
    const value = validAnswer(q, data.answer);
    if (!value) return;
    s.answers[msg.id] = { value, elapsed: Math.max(0, (at - s.qStart) / 1000) };
    render();
    if (Object.keys(s.answers).length >= s.order.length) endQuestion();
  }

  function toggleLock() {
    const s = G.current;
    if (!s) return;
    s.locked = !s.locked;
    render();
  }

  function kick(id) {
    const s = G.current;
    if (!s || !s.players[id]) return;
    if (!confirm(`Eliminați jucătorul „${s.players[id].name}” din joc?`)) return;
    sendTo(id, 'kicked', {});
    s.kicked.add(id);
    delete s.players[id];
    s.order = s.order.filter((x) => x !== id);
    render();
  }

  async function createGame() {
    setStarting(true);
    setDbError('');
    let session;
    try {
      const keys = await createHostKeys();
      keysRef.current = keys;
      session = await createSession(quiz.id, keys.publicKeys);
    } catch {
      session = { ok: false, error: 'Nu ne-am putut conecta la server.' };
    }
    if (!session.ok) { setDbError(session.error); setStarting(false); return; }
    const prepared = session.questions.map((q) => ({ ...q, options: q.options || [], perm: q.type === 'order' ? derange((q.options || []).length) : null }));
    G.current = {
      keys: keysRef.current, locked: false, pending: new Set(),
      pin: session.pin, sessionId: session.id, title: quiz.title, questions: prepared,
      players: {}, order: [], kicked: new Set(), dbIds: {}, qIndex: -1, phase: 'lobby',
      answers: {}, qStart: 0, timeLeft: 0, lastResults: null, counts: [], textCounts: [],
    };
    if (room.current) room.current.close();
    if (upRoom.current) upRoom.current.close();
    const sb = realtime(rt);
    room.current = joinTopic(sb, topics.down(session.pin), {}, () => {});
    upRoom.current = joinTopic(sb, topics.up(session.pin), { join: onJoin, answer: onAnswer }, setStatus);
    const url = `${window.location.origin}/joc?pin=${session.pin}`;
    setQr(await QRCode.toDataURL(url, { margin: 1, width: 460, errorCorrectionLevel: 'M' }));
    setStarting(false);
    render();
  }

  function derange(n) {
    let p = shuffle([...Array(n).keys()]);
    for (let i = 0; i < 10 && p.every((v, k) => v === k); i++) p = shuffle(p);
    return p;
  }

  function nextQuestion() {
    const s = G.current;
    if (s.qIndex === -1) {
      persist(() => markSession(s.sessionId, 'running'));
    }
    s.qIndex += 1;
    if (s.qIndex >= s.questions.length) return showPodium();
    s.phase = 'intro';
    s.answers = {};
    broadcast(snapshotFor(null));
    render();
    clearTimeout(timer.current);
    clearInterval(timer.current);
    timer.current = setTimeout(startAnswering, INTRO_SECONDS * 1000);
  }

  function startAnswering() {
    const s = G.current;
    const q = s.questions[s.qIndex];
    s.phase = 'question';
    s.qStart = Date.now();
    s.timeLeft = q.time_limit;
    broadcast({ phase: 'question', qIndex: s.qIndex, total: s.questions.length, title: s.title, question: publicQuestion(q), remaining: q.time_limit });
    render();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const left = Math.ceil(q.time_limit - (Date.now() - s.qStart) / 1000);
      if (left !== s.timeLeft) { s.timeLeft = Math.max(0, left); render(); }
      if (left <= 0) endQuestion();
    }, 200);
  }

  function endQuestion() {
    const s = G.current;
    if (!s || s.phase !== 'question') return;
    clearInterval(timer.current);
    const q = s.questions[s.qIndex];
    const graded = q.type !== 'poll';
    const results = {};
    for (const id of s.order) {
      const p = s.players[id];
      const a = s.answers[id];
      const correct = a ? isCorrect(q, a.value) : false;
      let gained = 0;
      if (a) p.answeredCount += 1;
      if (graded) {
        if (correct) {
          p.streak += 1;
          p.correctCount += 1;
          const base = pointsFor(q, true, a.elapsed);
          gained = base > 0 ? base + Math.min(500, 100 * (p.streak - 1)) * (POINTS[q.points].base / 1000) : 0;
        } else {
          p.streak = 0;
        }
      }
      p.score += gained;
      results[id] = { answered: !!a, correct: graded ? correct : null, gained, score: p.score, streak: p.streak };
    }
    const ranking = [...s.order].sort((x, y) => s.players[y].score - s.players[x].score);
    ranking.forEach((id, i) => { results[id].rank = i + 1; });

    const vals = Object.values(s.answers).map((a) => a.value);
    s.counts = q.options.map(() => 0);
    s.textCounts = [];
    s.orderStats = { ok: 0, bad: 0 };
    if (q.type === 'multiple') vals.forEach((v) => v.m.forEach((i) => { s.counts[i] += 1; }));
    else if (q.type === 'text') {
      const m = new Map();
      vals.forEach((v) => {
        const k = normalizeText(v.t);
        const e = m.get(k) || { text: v.t, n: 0, ok: isCorrect(q, v) };
        e.n += 1;
        m.set(k, e);
      });
      s.textCounts = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 12);
    } else if (q.type === 'order') vals.forEach((v) => { if (isCorrect(q, v)) s.orderStats.ok += 1; else s.orderStats.bad += 1; });
    else vals.forEach((v) => { s.counts[v.c] += 1; });

    s.lastResults = results;
    s.phase = 'reveal';
    const correctText = q.type === 'poll' ? '' : q.type === 'order' ? q.options.map((o) => o.text).map((t, i) => `${i + 1}. ${t}`).join(', ') : q.type === 'text' ? q.options.map((o) => o.text).join(' / ') : q.options.filter((o) => o.correct).map((o) => o.text).join('; ');
    broadcast({ phase: 'reveal', qIndex: s.qIndex, total: s.questions.length, title: s.title, type: q.type, correctText, results, players: s.order.length });
    saveAfterQuestion(s.qIndex);
    render();
  }

  function topList(n) {
    const s = G.current;
    return [...s.order].sort((x, y) => s.players[y].score - s.players[x].score).slice(0, n).map((id) => s.players[id]);
  }

  function showScoreboard() {
    const s = G.current;
    s.phase = 'scoreboard';
    broadcast({ phase: 'scoreboard', qIndex: s.qIndex, total: s.questions.length, title: s.title, top: topList(5).map((p) => ({ name: p.name, score: p.score })) });
    render();
  }

  function showPodium() {
    const s = G.current;
    clearTimeout(timer.current);
    clearInterval(timer.current);
    s.phase = 'podium';
    const ranking = [...s.order].sort((x, y) => s.players[y].score - s.players[x].score);
    const final = {};
    const gradable = s.questions.filter((q) => q.type !== 'poll').length;
    ranking.forEach((id, i) => { final[id] = { rank: i + 1, score: s.players[id].score, correctCount: s.players[id].correctCount }; });
    broadcast({ phase: 'podium', total: gradable, title: s.title, final, players: s.order.length, top: topList(3).map((p) => ({ name: p.name, score: p.score })) });
    saveFinal();
    render();
  }

  function advance() {
    const s = G.current;
    if (!s) return;
    if (s.phase === 'lobby' && s.order.length > 0) return nextQuestion();
    if (s.phase === 'question') return endQuestion();
    if (s.phase === 'reveal') return s.qIndex + 1 >= s.questions.length ? showPodium() : showScoreboard();
    if (s.phase === 'scoreboard') return nextQuestion();
  }

  function closeGame() {
    clearTimeout(timer.current);
    clearInterval(timer.current);
    const s = G.current;
    if (s && s.phase !== 'podium') {
      persist(() => markSession(s.sessionId, s.qIndex >= 0 ? 'finished' : 'abandoned'));
    }
    if (room.current && s) {
      const r = room.current;
      signMessage(s.keys.signKey, { phase: 'closed', sid: s.sessionId }).then((m) => r.send('state', m)).finally(() => r.close());
      room.current = null;
    }
    if (upRoom.current) { upRoom.current.close(); upRoom.current = null; }
    G.current = null;
    setQr('');
    render();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  const top = (
    <header className="board-top">
      <span className="row" style={{ gap: 10, fontWeight: 800 }}><LogoMark size={28} /> ProfQuiz <span style={{ fontWeight: 600, opacity: .7 }}>, {quiz.title}</span></span>
      <span className="right">
        {dbError && <span className="badge err" title={dbError}>Salvarea a eșuat</span>}
        {g && g.phase !== 'lobby' && <span>PIN {g.pin}, {g.order.length} jucători</span>}
        <button className="btn btn-light btn-sm" onClick={toggleFullscreen}>{Icon.expand(16)} Ecran complet (F)</button>
        {g ? (
          <button className="btn btn-light btn-sm" onClick={() => { if (g.phase === 'podium' || confirm('Încheiați jocul acum? Rezultatele de până acum rămân salvate în rapoarte.')) closeGame(); }}>Încheie jocul</button>
        ) : (
          <Link className="btn btn-light btn-sm" href={isOwner ? `/panou/teste/${quiz.id}` : '/panou'}>Înapoi</Link>
        )}
      </span>
    </header>
  );

  if (!g) {
    return (
      <div className="board">
        {top}
        <main className="board-main">
          <div className="board-setup">
            <span className="eyebrow">Joc live</span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)' }}>{quiz.title}</h1>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: '1.15rem' }}>
              {questions.length} întrebări, aproximativ {Math.max(1, Math.round(questions.reduce((t, x) => t + x.time_limit + INTRO_SECONDS + 12, 0) / 60))} minute.
              Elevii intră de pe telefon cu PIN-ul care va apărea pe ecran.
            </p>
            {skipped > 0 && <p className="alert alert-warn" style={{ margin: '0 auto 16px', maxWidth: 560 }}>{skipped} întrebări incomplete nu vor apărea în joc.</p>}
            {dbError && <p className="alert alert-bad" style={{ margin: '0 auto 16px', maxWidth: 560 }}>{dbError}</p>}
            {questions.length === 0 ? (
              <p className="alert alert-warn">Testul nu are nicio întrebare completă.</p>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={createGame} disabled={starting} autoFocus>
                {Icon.play(18)} {starting ? 'Se pregătește...' : 'Deschide jocul'}
              </button>
            )}
            <p style={{ color: 'rgba(255,255,255,.55)', marginTop: 24 }} className="small">Sfat: conectați calculatorul la proiector și apăsați F pentru ecran complet. Spațiu, Enter sau săgeata dreapta trec mai departe.</p>
          </div>
        </main>
      </div>
    );
  }

  const q = g.qIndex >= 0 && g.qIndex < g.questions.length ? g.questions[g.qIndex] : null;
  const answeredCount = Object.keys(g.answers).length;

  if (g.phase === 'lobby') {
    return (
      <div className="board">
        {top}
        <main className="board-main">
          <div className="lobby">
            <div className="join-box">
              <div className="step">1. Deschideți pe telefon</div>
              <div className="url">{origin.replace(/^https?:\/\//, '')}/joc</div>
              <div className="step">2. Introduceți PIN-ul jocului</div>
              <div className="pin" aria-label={`PIN ${g.pin.split('').join(' ')}`}>{g.pin}</div>
              {qr && <img src={qr} alt="Cod QR pentru intrarea în joc" />}
              <div className="step">sau scanați codul QR</div>
            </div>
            <div className="players-box">
              <h2>Jucători<span className="count" aria-live="polite">{g.order.length}</span></h2>
              {status && status !== 'SUBSCRIBED' && <p style={{ color: 'rgba(255,255,255,.7)' }}>Se conectează la server ({status})...</p>}
              {g.order.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,.7)' }}>Așteptăm elevii... Numele lor apar aici pe măsură ce intră.</p>
              ) : (
                <div className="chips">
                  {g.order.map((id) => (
                    <span className="chip" key={id}>
                      {g.players[id].name}
                      <button onClick={() => kick(id)} aria-label={`Elimină ${g.players[id].name}`} title="Elimină">{Icon.x(14)}</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="foot-actions" style={{ marginTop: 20 }}>
                <span className="hint">{g.questions.length} întrebări. Puteți elimina un nume nepotrivit cu butonul de lângă el.</span>
                <button className="btn btn-light" onClick={toggleLock} aria-pressed={!!g.locked}>{g.locked ? 'Deblochează intrarea' : 'Blochează intrarea'}</button>
                <button className="btn btn-primary btn-lg" disabled={g.order.length === 0} onClick={nextQuestion}>Începe jocul</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (g.phase === 'intro') {
    return (
      <div className="board">
        {top}
        <main className="board-main">
          <div className="intro-wrap">
            <div className="qhead"><span>Întrebarea {g.qIndex + 1} din {g.questions.length}</span><span>{POINTS[q.points].base === 2000 ? 'Puncte duble' : q.points === 'none' ? 'Fără puncte' : ''}</span></div>
            <div className="intro-type">{TYPES[q.type].label}</div>
            <div className="qtext">{q.text}</div>
            <div className="intro-bar"><span key={g.qIndex} style={{ animationDuration: `${INTRO_SECONDS}s` }} /></div>
          </div>
        </main>
      </div>
    );
  }

  if (g.phase === 'question' || g.phase === 'reveal') {
    const reveal = g.phase === 'reveal';
    const nOpt = q.options.length;
    const max = Math.max(1, ...(g.counts.length ? g.counts : [1]));
    const showOptions = q.type !== 'text';
    const displayIdx = q.type === 'order' && !reveal ? q.perm : q.options.map((_, i) => i);
    return (
      <div className="board">
        {top}
        <main className="board-main">
          <div className="qhead"><span>Întrebarea {g.qIndex + 1} din {g.questions.length}, {TYPES[q.type].label}</span><span>{q.type === 'multiple' ? 'Pot fi mai multe răspunsuri corecte' : q.type === 'order' ? 'Aranjați în ordinea corectă' : ''}</span></div>
          <div className="qtext">{q.text}</div>
          <div className="qmiddle">
            {!reveal ? (
              <>
                <div className={`timer ${g.timeLeft <= 5 ? 'low' : ''}`} aria-live="off">{g.timeLeft}</div>
                <div className="qimage">{q.image_url ? <img src={mediaUrl(q.image_url)} alt="" /> : q.type === 'text' ? <p style={{ fontSize: '1.4rem', fontWeight: 700, opacity: .8 }}>Scrieți răspunsul pe telefon</p> : null}</div>
                <div className="answered" aria-live="polite"><b>{answeredCount}</b><span>răspunsuri din {g.order.length}</span></div>
              </>
            ) : (
              <>
                <div />
                {q.type === 'text' ? (
                  <div className="text-answers" aria-label="Răspunsurile elevilor">
                    {g.textCounts.length === 0 ? <span>Niciun răspuns</span> : g.textCounts.map((t) => <span key={t.text} className={t.ok ? 'ok' : ''}>{t.text}, {t.n}</span>)}
                  </div>
                ) : q.type === 'order' ? (
                  <div className="answered"><b>{g.orderStats.ok} / {g.orderStats.ok + g.orderStats.bad}</b><span>au aranjat corect</span></div>
                ) : (
                  <div className="dist" aria-label="Distribuția răspunsurilor">
                    {q.options.map((o, i) => (
                      <div className="col" key={i}>
                        <span className="val">{g.counts[i]}</span>
                        <div className={`bar ${OPTION_STYLES[i].cls} ${q.type !== 'poll' && !o.correct ? 'dim' : ''}`} style={{ height: `${(g.counts[i] / max) * 150 + 8}px` }}>
                          {q.type !== 'poll' && o.correct && <span aria-hidden>{Icon.check(22)}</span>}
                        </div>
                        <span className="lab"><Shape index={i} size={18} />{OPTION_STYLES[i].letter}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div />
              </>
            )}
          </div>
          {showOptions && (
            q.type === 'order' ? (
              <div className="order-board">
                {displayIdx.map((oi, k) => (
                  <div key={oi} className={`opt ${OPTION_STYLES[k].cls}`}>
                    <span className="letter">{reveal ? `${k + 1}.` : OPTION_STYLES[k].letter}</span>
                    <span>{q.options[oi].text}</span>
                    {reveal && <span className="tick" aria-hidden>{Icon.check(22)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`optgrid n${nOpt}`}>
                {q.options.map((a, i) => (
                  <div key={i} className={`opt ${OPTION_STYLES[i].cls} ${reveal && q.type !== 'poll' && !a.correct ? 'dim' : ''}`}>
                    <Shape index={i} size={34} />
                    <span className="letter">{OPTION_STYLES[i].letter}</span>
                    <span>{a.text}</span>
                    {reveal && q.type !== 'poll' && a.correct && <span className="tick" aria-label="răspuns corect">{Icon.check(22)}</span>}
                  </div>
                ))}
              </div>
            )
          )}
          {reveal && q.type === 'text' && <p className="alert alert-ok" style={{ textAlign: 'center' }}>Răspuns corect: {q.options.map((o) => o.text).join(' / ')}</p>}
          <div className="foot-actions">
            <span className="hint">{reveal ? 'Discutați răspunsul, apoi treceți mai departe.' : 'Întrebarea se încheie când răspund toți sau expiră timpul.'}</span>
            {!reveal && <button className="btn btn-light" onClick={endQuestion}>Oprește timpul</button>}
            {reveal && <button className="btn btn-primary btn-lg" onClick={advance}>{g.qIndex + 1 >= g.questions.length ? 'Clasamentul final' : 'Clasamentul'}</button>}
          </div>
        </main>
      </div>
    );
  }

  if (g.phase === 'scoreboard') {
    const list = topList(5);
    return (
      <div className="board">
        {top}
        <main className="board-main">
          <div className="score-wrap">
            <h1>Clasamentul după întrebarea {g.qIndex + 1}</h1>
            <div className="rows">
              {list.map((p, i) => (
                <div className="row" key={p.id} style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="pos">{i + 1}</span>
                  <span>{p.name}</span>
                  {p.streak >= 2 ? <span className="streak">{p.streak} la rând</span> : <span />}
                  <span>{p.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="foot-actions">
            <button className="btn btn-primary btn-lg" onClick={nextQuestion}>Întrebarea următoare</button>
          </div>
        </main>
      </div>
    );
  }

  const t3 = topList(3);
  const order = [t3[1], t3[0], t3[2]];
  const cls = ['p2', 'p1', 'p3'];
  const place = [2, 1, 3];
  const gradable = g.questions.filter((x) => x.type !== 'poll').length;
  return (
    <div className="board">
      {top}
      <main className="board-main">
        <div className="score-wrap"><h1>Rezultatele finale</h1></div>
        <div className="podium">
          {order.map((p, i) => p && (
            <div className={`pod ${cls[i]}`} key={p.id}>
              <span className="nm">{p.name}</span>
              <span className="pts">{p.score} puncte, {p.correctCount}/{gradable} corecte</span>
              <div className="block">{place[i]}</div>
            </div>
          ))}
        </div>
        <div className="foot-actions">
          <span className="hint">{g.order.length} jucători. Rezultatele fiecărui elev sunt salvate în raport.</span>
          <a className="btn btn-light" href={`/panou/rapoarte/${g.sessionId}`} target="_blank" rel="noreferrer">{Icon.chart(18)} Raportul complet</a>
          <button className="btn btn-primary btn-lg" onClick={closeGame}>Joc nou</button>
        </div>
      </main>
    </div>
  );
}
