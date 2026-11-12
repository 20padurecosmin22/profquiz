'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { realtime, joinTopic, postTo, postReliable, topics, randomId } from '@/lib/room';
import { findGame } from '@/app/actions/games';
import { OPTION_STYLES, Shape } from '@/components/Shape';
import { LogoMark } from '@/components/Logo';
import { Icon } from '@/components/Icons';

const SAVE_KEY = 'profquiz-player';

export default function Player({ rt }) {
  const params = useSearchParams();
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('join');
  const [err, setErr] = useState('');
  const [me, setMe] = useState(null);
  const [info, setInfo] = useState({});
  const [left, setLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState([]);
  const [typed, setTyped] = useState('');
  const [order, setOrder] = useState([]);
  const [myAnswer, setMyAnswer] = useState(null);
  const room = useRef(null);
  const myRoom = useRef(null);
  const pinRef = useRef('');
  const meRef = useRef(null);
  const qIndexRef = useRef(-1);
  const answeredRef = useRef(-1);
  const joinTimer = useRef(null);
  const tick = useRef(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    const p = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6);
    if (p) setPin(p);
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null');
      if (saved && saved.pin && saved.id && (!p || p === saved.pin)) {
        setName(saved.name || '');
        setPin(saved.pin);
        connect(saved.pin, saved.name, saved.id);
      } else {
        const n = localStorage.getItem('profquiz-name');
        if (n) setName(n);
      }
    } catch {}
    return () => {
      clearInterval(tick.current);
      clearTimeout(joinTimer.current);
      closeRooms();
    };
  }, []);

  function startCountdown(seconds) {
    clearInterval(tick.current);
    const end = Date.now() + seconds * 1000;
    setLeft(Math.ceil(seconds));
    tick.current = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) clearInterval(tick.current);
    }, 250);
  }

  function prepareQuestion(q) {
    setPicked([]);
    setTyped('');
    setMyAnswer(null);
    setOrder(q && q.type === 'order' ? q.options.map((text, k) => ({ idx: q.perm[k], text })) : []);
  }

  function applyState(s) {
    if (!s || !s.phase) return;
    const id = meRef.current && meRef.current.id;
    setInfo((prev) => ({ ...s, question: s.question || (s.phase === 'reveal' ? prev.question : undefined) }));
    if (typeof s.score === 'number') setScore(s.score);
    switch (s.phase) {
      case 'lobby':
        setStage('waiting');
        break;
      case 'intro':
        qIndexRef.current = s.qIndex;
        setStage('intro');
        break;
      case 'question':
        if (qIndexRef.current !== s.qIndex || stageRef.current === 'intro' || stageRef.current === 'connecting') {
          if (answeredRef.current !== s.qIndex) prepareQuestion(s.question);
        }
        qIndexRef.current = s.qIndex;
        setStage(s.answered || answeredRef.current === s.qIndex ? 'answered' : 'question');
        startCountdown(s.remaining ?? s.question.time);
        break;
      case 'reveal': {
        clearInterval(tick.current);
        const r = s.results && s.results[id];
        if (r) setScore(r.score);
        setStage('reveal');
        break;
      }
      case 'scoreboard':
        setStage('scoreboard');
        break;
      case 'podium': {
        const f = s.final && s.final[id];
        if (f) setScore(f.score);
        setStage('podium');
        sessionStorage.removeItem(SAVE_KEY);
        break;
      }
      case 'closed':
        setStage('closed');
        sessionStorage.removeItem(SAVE_KEY);
        closeRooms();
        break;
      default:
    }
  }

  function connect(p, n, existingId) {
    setErr('');
    const id = existingId || randomId();
    meRef.current = { id, name: n };
    setMe(meRef.current);
    setStage('connecting');
    pinRef.current = p;
    closeRooms();
    let ready = 0;
    const onStatus = async (status) => {
      if (status === 'SUBSCRIBED') {
        ready += 1;
        if (ready < 2) return;
        await postTo(realtime(rt), topics.up(p), 'join', { id, name: n });
        clearTimeout(joinTimer.current);
        joinTimer.current = setTimeout(() => {
          if (stageRef.current === 'connecting') {
            setErr('Tabla jocului nu a răspuns. Verificați PIN-ul și încercați din nou.');
            setStage('join');
            sessionStorage.removeItem(SAVE_KEY);
            closeRooms();
          }
        }, 7000);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (stageRef.current === 'connecting') {
          setErr('Conexiunea a eșuat. Verificați internetul telefonului și încercați din nou.');
          setStage('join');
        }
      }
    };
    const sb = realtime(rt);
    myRoom.current = joinTopic(
      sb,
      topics.me(p, id),
      {
        welcome: (w) => {
          if (!w || w.id !== meRef.current.id) return;
          clearTimeout(joinTimer.current);
          meRef.current = { id: w.id, name: w.name };
          setMe(meRef.current);
          sessionStorage.setItem(SAVE_KEY, JSON.stringify({ pin: p, id: w.id, name: n }));
          if (w.snapshot?.phase === 'question') prepareQuestion(w.snapshot.question);
          applyState(w.snapshot);
          if (w.snapshot && w.snapshot.phase === 'lobby') setStage('waiting');
        },
        kicked: () => {
          sessionStorage.removeItem(SAVE_KEY);
          setStage('kicked');
          closeRooms();
        },
      },
      onStatus
    );
    room.current = joinTopic(sb, topics.down(p), { state: (s) => { if (stageRef.current !== 'connecting') applyState(s); } }, onStatus);
  }

  function closeRooms() {
    if (room.current) { room.current.close(); room.current = null; }
    if (myRoom.current) { myRoom.current.close(); myRoom.current = null; }
  }

  async function submitJoin(e) {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    const n = name.replace(/\s+/g, ' ').trim();
    if (p.length !== 6) return setErr('PIN-ul are 6 cifre.');
    if (n.length < 2) return setErr('Scrieți-vă numele.');
    setErr('');
    setStage('connecting');
    let found;
    try {
      found = await findGame(p);
    } catch {
      found = { ok: false, error: 'network' };
    }
    if (found.error) { setStage('join'); return setErr('Nu ne-am putut conecta. Verificați internetul și încercați din nou.'); }
    if (!found.ok) { setStage('join'); return setErr('Nu există niciun joc deschis cu acest PIN. Verificați cifrele de pe tablă.'); }
    localStorage.setItem('profquiz-name', n);
    connect(p, n);
  }

  async function send(answer, shown) {
    if (stage !== 'question') return;
    const qIndex = qIndexRef.current;
    answeredRef.current = qIndex;
    setMyAnswer(shown);
    setStage('answered');
    if (navigator.vibrate) navigator.vibrate(40);
    const ok = await postReliable(realtime(rt), topics.up(pinRef.current), 'answer', { id: meRef.current.id, qIndex, answer });
    if (!ok) setErr('Răspunsul nu a putut fi trimis. Verificați conexiunea.');
  }

  function moveItem(k, d) {
    const j = k + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[k], next[j]] = [next[j], next[k]];
    setOrder(next);
  }

  const inGame = me && stage !== 'join' && stage !== 'connecting';
  const top = (
    <header className="phone-top">
      <span className="row" style={{ gap: 8 }}><LogoMark size={24} />{inGame ? me.name : 'ProfQuiz'}</span>
      <span>{inGame ? `${score} puncte` : ''}</span>
    </header>
  );

  if (stage === 'join' || stage === 'connecting') {
    return (
      <div className="phone">
        {top}
        <main className="phone-main">
          <div className="center">
            <form className="join-card" onSubmit={submitJoin} noValidate>
              <h1>Intră în joc</h1>
              <div className="field">
                <label htmlFor="pin">PIN-ul jocului (de pe tablă)</label>
                <input id="pin" className="input pin-input" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
              </div>
              <div className="field">
                <label htmlFor="name">Numele și prenumele</label>
                <input id="name" className="input" autoComplete="name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
                <p className="help">Numele apare pe tablă și în rezultatele profesorului.</p>
              </div>
              {err && <p className="alert alert-bad" role="alert">{err}</p>}
              <button className="btn btn-primary btn-lg" type="submit" disabled={stage === 'connecting'}>
                {stage === 'connecting' ? 'Se conectează...' : 'Intră'}
              </button>
              <p className="help center-text">Sunteți profesor? <Link href="/autentificare">Intrați în cont</Link></p>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const q = info.question;
  const header = info.total ? <span className="ptimer">Întrebarea {(info.qIndex ?? 0) + 1} din {info.total}</span> : null;
  let body;

  if (stage === 'waiting') {
    body = (
      <div className="center">
        <div className="big">Ești în joc!</div>
        <div className="mid">Numele tău apare pe tablă. Așteaptă să înceapă jocul.</div>
        <div className="spinner" aria-hidden />
      </div>
    );
  } else if (stage === 'intro') {
    body = (
      <div className="center">
        {header}
        <div className="big">Pregătește-te...</div>
        {q?.text && <div className="mid">{q.text}</div>}
        <div className="spinner" aria-hidden />
      </div>
    );
  } else if (stage === 'question' && q) {
    const head = <div className="row between">{header}<span className="ptimer" aria-live="off">{left} s</span></div>;
    const qbox = (
      <div className="pq">
        {q.text}
        {q.image && <img src={q.image} alt="" />}
      </div>
    );
    if (q.type === 'single' || q.type === 'truefalse' || q.type === 'poll') {
      body = (
        <>
          {head}{qbox}
          <div className={`pgrid ${q.options.length > 4 ? 'one' : ''}`}>
            {q.options.map((a, i) => (
              <button key={i} className={`opt ${OPTION_STYLES[i].cls}`} onClick={() => send({ c: i }, { kind: 'one', i })}>
                <Shape index={i} size={26} /><span>{a}</span>
              </button>
            ))}
          </div>
        </>
      );
    } else if (q.type === 'multiple') {
      body = (
        <>
          {head}{qbox}
          <p className="mid center-text" style={{ margin: 0 }}>Bifează toate răspunsurile corecte, apoi apasă „Trimite”.</p>
          <div className={`pgrid ${q.options.length > 4 ? 'one' : ''}`}>
            {q.options.map((a, i) => {
              const on = picked.includes(i);
              return (
                <button key={i} className={`opt ${OPTION_STYLES[i].cls} ${on ? 'picked' : ''}`} aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}>
                  <Shape index={i} size={26} /><span>{a}</span>{on && <span className="tick" aria-hidden>{Icon.check(20)}</span>}
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary btn-lg" disabled={!picked.length} onClick={() => send({ m: picked }, { kind: 'many', list: picked })}>Trimite ({picked.length})</button>
        </>
      );
    } else if (q.type === 'text') {
      body = (
        <>
          {head}{qbox}
          <form className="text-answer-form" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) send({ t: typed.trim() }, { kind: 'text', t: typed.trim() }); }}>
            <label htmlFor="ans" className="sr-only">Răspunsul tău</label>
            <input id="ans" className="input" autoComplete="off" autoCapitalize="off" maxLength={120} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Scrie răspunsul" autoFocus />
            <button className="btn btn-primary btn-lg" disabled={!typed.trim()}>Trimite</button>
          </form>
        </>
      );
    } else if (q.type === 'order') {
      body = (
        <>
          {head}{qbox}
          <p className="mid center-text" style={{ margin: 0 }}>Mută elementele cu săgețile, de la primul (sus) la ultimul (jos).</p>
          <div className="order-phone">
            {order.map((it, k) => (
              <div key={it.idx} className={`opt opt-${k % 6}`}>
                <span className="letter">{k + 1}.</span>
                <span>{it.text}</span>
                <span className="moves">
                  <button className="mini-btn" onClick={() => moveItem(k, -1)} disabled={k === 0} aria-label={`Mută „${it.text}” mai sus`}>{Icon.up(18)}</button>
                  <button className="mini-btn" onClick={() => moveItem(k, 1)} disabled={k === order.length - 1} aria-label={`Mută „${it.text}” mai jos`}>{Icon.down(18)}</button>
                </span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => send({ o: order.map((x) => x.idx) }, { kind: 'order', list: order.map((x) => x.text) })}>Trimite ordinea</button>
        </>
      );
    }
  } else if (stage === 'answered' || (stage === 'question' && !q)) {
    body = (
      <div className="center">
        {header}
        <div className="big">Răspuns trimis</div>
        {myAnswer?.kind === 'one' && q && (
          <div className={`opt ${OPTION_STYLES[myAnswer.i].cls}`} style={{ width: 'min(420px,100%)' }}>
            <Shape index={myAnswer.i} size={26} /><span>{q.options[myAnswer.i]}</span>
          </div>
        )}
        {myAnswer?.kind === 'many' && q && <div className="mid">Ai bifat: {myAnswer.list.slice().sort().map((i) => OPTION_STYLES[i].letter).join(', ')}</div>}
        {myAnswer?.kind === 'text' && <div className="mid">Ai scris: <b>{myAnswer.t}</b></div>}
        {myAnswer?.kind === 'order' && <div className="mid">{myAnswer.list.map((t, i) => `${i + 1}. ${t}`).join(', ')}</div>}
        <div className="mid">Așteaptă rezultatul. Timp rămas: {left} s</div>
        {err && <p className="alert alert-bad" role="alert">{err}</p>}
      </div>
    );
  } else if (stage === 'reveal') {
    const r = info.results && me && info.results[me.id];
    const poll = info.type === 'poll';
    const cls = poll ? 'poll' : !r || !r.answered ? 'none' : r.correct ? 'ok' : 'bad';
    body = (
      <div className="center">
        {header}
        <div className={`result ${cls}`} role="status">
          <div className="icon" aria-hidden>{cls === 'ok' || poll ? Icon.check(52) : cls === 'bad' ? Icon.x(52) : Icon.clock(52)}</div>
          <div className="big">{poll ? (r?.answered ? 'Mulțumim pentru răspuns!' : 'Sondaj încheiat') : cls === 'ok' ? 'Corect!' : cls === 'bad' ? 'Greșit' : 'Nu ai răspuns'}</div>
          {r && r.gained > 0 && <div className="gain">+{r.gained}</div>}
          {r && r.streak >= 2 && <div className="mid">{r.streak} răspunsuri corecte la rând</div>}
          {!poll && cls !== 'ok' && info.correctText && <div className="mid">Răspunsul corect: {info.correctText}</div>}
        </div>
        {r && <div className="mid">Ești pe locul {r.rank} din {info.players}</div>}
      </div>
    );
  } else if (stage === 'scoreboard') {
    const pos = info.top ? info.top.findIndex((t) => me && t.name === me.name) : -1;
    body = (
      <div className="center">
        <div className="big">{pos >= 0 ? `Ești în top 5, pe locul ${pos + 1}!` : 'Privește clasamentul pe tablă'}</div>
        <div className="mid">Ai {score} puncte.</div>
        <div className="spinner" aria-hidden />
      </div>
    );
  } else if (stage === 'podium') {
    const f = info.final && me && info.final[me.id];
    body = (
      <div className="center">
        <div className="big">Jocul s-a încheiat</div>
        {f && (
          <div className="result ok" style={{ background: f.rank <= 3 ? 'var(--violet-deep)' : 'rgba(255,255,255,.1)' }}>
            <div className="icon" aria-hidden>{f.rank}</div>
            <div className="big">Locul {f.rank} din {info.players}</div>
            <div className="mid">{f.score} puncte, {f.correctCount} din {info.total} corecte</div>
          </div>
        )}
        <button className="btn btn-light" onClick={() => { setStage('join'); setInfo({}); setScore(0); }}>Intră în alt joc</button>
      </div>
    );
  } else if (stage === 'kicked') {
    body = (
      <div className="center">
        <div className="big">Ai fost scos din joc</div>
        <div className="mid">Profesorul a eliminat acest nume. Poți intra din nou cu numele tău real.</div>
        <button className="btn btn-light" onClick={() => { setStage('join'); setInfo({}); setScore(0); }}>Înapoi</button>
      </div>
    );
  } else {
    body = (
      <div className="center">
        <div className="big">Jocul a fost închis</div>
        <div className="mid">Profesorul a încheiat jocul. Mulțumim pentru participare!</div>
        <button className="btn btn-light" onClick={() => { setStage('join'); setInfo({}); setScore(0); }}>Intră în alt joc</button>
      </div>
    );
  }

  return (
    <div className="phone">
      {top}
      <main className="phone-main">{body}</main>
    </div>
  );
}
