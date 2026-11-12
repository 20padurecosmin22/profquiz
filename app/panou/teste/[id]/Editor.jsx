'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveQuiz } from '@/app/actions/quizzes';
import { mediaUrl } from '@/lib/media';
import { uploadImage } from '@/lib/images';
import { TYPES, TYPE_ORDER, TIME_CHOICES, POINTS, MAX_OPTIONS, blankQuestion, optionsFor, problemsOf, newId, SUBJECTS, GRADES } from '@/lib/questions';
import { OPTION_STYLES, Shape } from '@/components/Shape';
import { Icon } from '@/components/Icons';
import ImportModal from './ImportModal';

export default function Editor({ initialQuiz, initialQuestions, userId, isNew }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [questions, setQuestions] = useState(() => initialQuestions.map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
  const [sel, setSel] = useState(0);
  const [state, setState] = useState('saved');
  const [errMsg, setErrMsg] = useState('');
  const [showSettings, setShowSettings] = useState(isNew && initialQuestions.length === 0);
  const [showTypes, setShowTypes] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const deleted = useRef(new Set());
  const latest = useRef({ quiz, questions });
  latest.current = { quiz, questions };
  const saving = useRef(false);
  const again = useRef(false);
  const timer = useRef(null);

  const save = useCallback(async () => {
    if (saving.current) { again.current = true; return null; }
    saving.current = true;
    setState('saving');
    const { quiz: qz, questions: qs } = latest.current;
    const del = [...deleted.current];
    let ok = false;
    try {
      const r = await saveQuiz({ quiz: qz, questions: qs, deletedIds: del });
      if (!r.ok) throw new Error(r.error);
      del.forEach((d) => deleted.current.delete(d));
      setState('saved');
      setErrMsg('');
      ok = true;
    } catch (e) {
      setState('error');
      setErrMsg(e.message || 'Eroare de rețea');
    } finally {
      saving.current = false;
      if (again.current) { again.current = false; save(); }
    }
    return ok;
  }, []);

  const touch = useCallback(() => {
    setState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 1200);
  }, [save]);

  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const warn = (e) => {
      if (stateRef.current !== 'saved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); clearTimeout(timer.current); };
  }, []);

  const q = questions[sel];

  function setMeta(patch) { setQuiz((x) => ({ ...x, ...patch })); touch(); }
  function updateQ(patch) {
    setQuestions((list) => list.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
    touch();
  }
  function updateOpt(i, patch) {
    updateQ({ options: q.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  }
  function addQuestion(type) {
    const nq = blankQuestion(type);
    setQuestions((list) => { const next = [...list]; next.splice(sel + 1, 0, nq); return next; });
    setSel(questions.length === 0 ? 0 : sel + 1);
    setShowTypes(false);
    touch();
  }
  function duplicateQ() {
    const copy = { ...q, id: newId(), options: q.options.map((o) => ({ ...o })) };
    setQuestions((list) => { const next = [...list]; next.splice(sel + 1, 0, copy); return next; });
    setSel(sel + 1);
    touch();
  }
  function deleteQ() {
    if (!confirm('Ștergeți această întrebare?')) return;
    deleted.current.add(q.id);
    setQuestions((list) => list.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, Math.min(s, questions.length - 2)));
    touch();
  }
  function move(from, to) {
    if (to < 0 || to >= questions.length || from === to) return;
    setQuestions((list) => { const next = [...list]; const [it] = next.splice(from, 1); next.splice(to, 0, it); return next; });
    setSel(to);
    touch();
  }
  function changeType(type) {
    updateQ({ type, options: optionsFor(type, q.options), points: type === 'poll' ? 'none' : q.points === 'none' ? 'standard' : q.points });
  }
  function toggleCorrect(i) {
    if (q.type === 'single' || q.type === 'truefalse') updateQ({ options: q.options.map((o, k) => ({ ...o, correct: k === i })) });
    else updateOpt(i, { correct: !q.options[i].correct });
  }
  function addOption() {
    if (q.options.length >= MAX_OPTIONS) return;
    updateQ({ options: [...q.options, { text: '', correct: q.type === 'text' || q.type === 'order' }] });
  }
  function removeOption(i) {
    const min = q.type === 'text' ? 1 : q.type === 'order' ? 3 : 2;
    if (q.options.length <= min) return;
    let next = q.options.filter((_, k) => k !== i);
    if (q.type === 'single' && !next.some((o) => o.correct)) next = next.map((o, k) => ({ ...o, correct: k === 0 }));
    updateQ({ options: next });
  }
  function moveOption(i, d) {
    const j = i + d;
    if (j < 0 || j >= q.options.length) return;
    const next = [...q.options];
    [next[i], next[j]] = [next[j], next[i]];
    updateQ({ options: next });
  }
  function importQuestions(list) {
    setQuestions((cur) => {
      const onlyBlank = cur.length === 1 && !cur[0].text.trim() && cur[0].options.every((o) => !o.text.trim());
      if (onlyBlank) deleted.current.add(cur[0].id);
      return onlyBlank ? list : [...cur, ...list];
    });
    setSel(questions.length === 1 && !questions[0].text.trim() ? 0 : questions.length);
    setShowImport(false);
    touch();
  }

  const allProblems = questions.map(problemsOf);
  const invalidCount = allProblems.filter((p) => p.length).length;
  const canPlay = questions.length > 0 && invalidCount === 0;

  async function playLive() {
    clearTimeout(timer.current);
    while (saving.current) await new Promise((r) => setTimeout(r, 100));
    if (await save()) router.push(`/live/${quiz.id}`);
  }

  const stateText = { saved: 'Toate modificările sunt salvate', dirty: 'Modificări nesalvate...', saving: 'Se salvează...', error: 'Salvarea a eșuat' }[state];

  return (
    <div>
      <div className="editor-top">
        <Link href="/panou" className="btn btn-icon btn-ghost" aria-label="Înapoi la testele mele"><span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>{Icon.arrow(18)}</span></Link>
        <label htmlFor="quiz-title" className="sr-only">Titlul testului</label>
        <input id="quiz-title" className="title-input" value={quiz.title} maxLength={150} onChange={(e) => setMeta({ title: e.target.value })} />
        <span className={`save-state ${state === 'error' ? 'err' : ''}`} role="status" aria-live="polite">{stateText}</span>
        {state === 'error' && <button className="btn btn-sm" onClick={save}>Reîncearcă</button>}
        <button className="btn btn-sm" onClick={() => setShowSettings(true)}>{Icon.settings(16)} Setări</button>
        <button className="btn btn-sm" onClick={() => setShowImport(true)}>{Icon.upload(16)} Import Excel</button>
        <button className="btn btn-sm btn-primary" onClick={playLive} disabled={!canPlay} title={canPlay ? 'Pornește jocul la clasă' : 'Rezolvați întâi problemele marcate'}>
          {Icon.play(16)} Joacă live
        </button>
      </div>
      {state === 'error' && <p className="alert alert-bad" style={{ margin: '12px 20px 0' }}>Modificările nu au fost salvate ({errMsg}). Verificați conexiunea și apăsați „Reîncearcă”.</p>}

      <div className="editor">
        <aside className="q-list" aria-label="Lista întrebărilor">
          {questions.map((x, i) => (
            <button
              key={x.id}
              className={`q-item ${i === sel ? 'active' : ''} ${dragIdx === i ? 'dragging' : ''} ${overIdx === i && dragIdx !== i ? 'drop-target' : ''}`}
              onClick={() => setSel(i)}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
              aria-current={i === sel ? 'true' : undefined}
            >
              <span className="n">{i + 1}</span>
              <span>
                <span className="t">{x.text.trim() || <em className="muted">Întrebare fără text</em>}</span>
                <span className="k">{TYPES[x.type].label}, {x.time_limit} s</span>
              </span>
              {allProblems[i].length > 0 ? <span className="warn-dot" title={allProblems[i].join(' ')} aria-label="Are probleme" /> : <span />}
            </button>
          ))}
          <button className="btn btn-primary" onClick={() => setShowTypes(true)}>{Icon.plus(18)} Adaugă întrebare</button>
          {questions.length > 0 && (
            <p className="help" style={{ textAlign: 'center' }}>
              {questions.length} întrebări{invalidCount > 0 ? `, ${invalidCount} de completat` : ''}
            </p>
          )}
        </aside>

        <section className="q-edit" aria-label="Editarea întrebării">
          {!q ? (
            <div className="empty-state">
              <h2>Adăugați prima întrebare</h2>
              <p>Alegeți tipul întrebării sau importați mai multe deodată dintr-un fișier Excel.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setShowTypes(true)}>{Icon.plus(18)} Adaugă întrebare</button>
                <button className="btn" onClick={() => setShowImport(true)}>{Icon.upload(18)} Import din Excel</button>
              </div>
            </div>
          ) : (
            <QuestionForm
              q={q}
              index={sel}
              total={questions.length}
              problems={allProblems[sel]}
              userId={userId}
              quizId={quiz.id}
              onPatch={updateQ}
              onOpt={updateOpt}
              onType={changeType}
              onToggleCorrect={toggleCorrect}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onMoveOption={moveOption}
              onMove={(d) => move(sel, sel + d)}
              onDuplicate={duplicateQ}
              onDelete={deleteQ}
            />
          )}
        </section>
      </div>

      {showTypes && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowTypes(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="types-title">
            <div className="row between"><h2 id="types-title">Ce tip de întrebare adăugați?</h2><button className="btn btn-icon btn-ghost" onClick={() => setShowTypes(false)} aria-label="Închide">{Icon.x()}</button></div>
            <div className="type-picker">
              {TYPE_ORDER.map((t) => (
                <button key={t} className="type-card" onClick={() => addQuestion(t)} autoFocus={t === 'single'}>
                  <b>{TYPES[t].label}</b><span>{TYPES[t].help}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importQuestions} />}

      {showSettings && (
        <SettingsDrawer quiz={quiz} userId={userId} onChange={setMeta} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function ImageField({ url, onChange, userId, quizId, label = 'Imaginea întrebării' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef(null);
  async function handle(file) {
    if (!file) return;
    setErr('');
    setBusy(true);
    try { onChange(await uploadImage(file, quizId)); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div
      className={`img-drop ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => { const f = [...(e.clipboardData?.files || [])][0]; if (f) handle(f); }}
    >
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      {url ? (
        <>
          <img src={mediaUrl(url)} alt={label} />
          <div className="img-actions">
            <button type="button" className="btn btn-sm" onClick={() => input.current.click()}>Schimbă</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Elimină</button>
          </div>
        </>
      ) : (
        <div>
          <div style={{ color: 'var(--violet)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>{Icon.image(36)}</div>
          <p style={{ margin: '0 0 10px', fontWeight: 650 }}>{busy ? 'Se încarcă imaginea...' : 'Trageți o imagine aici sau'}</p>
          <button type="button" className="btn btn-sm" onClick={() => input.current.click()} disabled={busy}>{Icon.upload(16)} Alegeți un fișier</button>
          <p className="help" style={{ marginTop: 8 }}>PNG, JPG, WEBP sau GIF, până la 5 MB. Puteți și lipi (Ctrl+V) o imagine copiată.</p>
        </div>
      )}
      {err && <p className="alert alert-bad" role="alert" style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>{err}</p>}
    </div>
  );
}

function QuestionForm({ q, index, total, problems, userId, quizId, onPatch, onOpt, onType, onToggleCorrect, onAddOption, onRemoveOption, onMoveOption, onMove, onDuplicate, onDelete }) {
  const isChoice = q.type === 'single' || q.type === 'multiple' || q.type === 'poll' || q.type === 'truefalse';
  return (
    <>
      <div className="q-toolbar">
        <div className="field">
          <label htmlFor="qtype">Tipul întrebării</label>
          <select id="qtype" className="select" value={q.type} onChange={(e) => onType(e.target.value)}>
            {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qtime">Timp</label>
          <select id="qtime" className="select" value={q.time_limit} onChange={(e) => onPatch({ time_limit: Number(e.target.value) })}>
            {TIME_CHOICES.map((t) => <option key={t} value={t}>{t < 60 ? `${t} secunde` : `${t / 60} ${t === 60 ? 'minut' : 'minute'}`}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qpoints">Punctaj</label>
          <select id="qpoints" className="select" value={q.points} onChange={(e) => onPatch({ points: e.target.value })} disabled={q.type === 'poll'}>
            {Object.entries(POINTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mută mai sus" title="Mută mai sus">{Icon.up()}</button>
          <button className="btn btn-icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Mută mai jos" title="Mută mai jos">{Icon.down()}</button>
          <button className="btn btn-icon" onClick={onDuplicate} aria-label="Duplică întrebarea" title="Duplică">{Icon.copy(18)}</button>
          <button className="btn btn-icon btn-danger" onClick={onDelete} aria-label="Șterge întrebarea" title="Șterge">{Icon.trash(18)}</button>
        </div>
      </div>

      <p className="help" style={{ marginBottom: 10 }}>Întrebarea {index + 1} din {total}. {TYPES[q.type].help}</p>
      <label htmlFor="qtext" className="sr-only">Textul întrebării</label>
      <textarea
        id="qtext"
        className="textarea q-text"
        placeholder={q.type === 'truefalse' ? 'Scrieți afirmația...' : 'Scrieți întrebarea...'}
        value={q.text}
        maxLength={500}
        onChange={(e) => onPatch({ text: e.target.value })}
      />

      <ImageField url={q.image_url} onChange={(url) => onPatch({ image_url: url })} userId={userId} quizId={quizId} />

      {isChoice && (
        <>
          <div className="opt-edit-grid">
            {q.options.map((o, i) => (
              <div key={i} className={`opt-edit ${OPTION_STYLES[i].cls}`}>
                <span className="shape"><Shape index={i} size={30} /></span>
                <input
                  type="text"
                  value={o.text}
                  maxLength={200}
                  placeholder={`Varianta ${OPTION_STYLES[i].letter}${i >= 2 && q.type !== 'truefalse' ? ' (opțional)' : ''}`}
                  aria-label={`Varianta ${OPTION_STYLES[i].letter}`}
                  onChange={(e) => onOpt(i, { text: e.target.value })}
                  readOnly={q.type === 'truefalse'}
                />
                {q.type !== 'poll' ? (
                  <button
                    type="button"
                    className="correct-toggle"
                    role={q.type === 'multiple' ? 'checkbox' : 'radio'}
                    aria-checked={!!o.correct}
                    aria-label={`Varianta ${OPTION_STYLES[i].letter} este corectă`}
                    title={o.correct ? 'Răspuns corect' : 'Marcați ca răspuns corect'}
                    onClick={() => onToggleCorrect(i)}
                  >
                    {o.correct ? Icon.check(18) : null}
                  </button>
                ) : <span />}
                {q.type !== 'truefalse' && q.options.length > 2 ? (
                  <button type="button" className="mini-btn" onClick={() => onRemoveOption(i)} aria-label={`Șterge varianta ${OPTION_STYLES[i].letter}`}>{Icon.x(16)}</button>
                ) : <span />}
              </div>
            ))}
          </div>
          {q.type !== 'truefalse' && q.options.length < MAX_OPTIONS && (
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={onAddOption}>{Icon.plus(16)} Adaugă variantă</button>
          )}
          {q.type === 'multiple' && <p className="help" style={{ marginTop: 10 }}>Răspunsul se consideră corect doar dacă elevul bifează exact variantele marcate.</p>}
        </>
      )}

      {q.type === 'text' && (
        <div className="panel">
          <h2 style={{ fontSize: '1.05rem' }}>Răspunsuri acceptate</h2>
          <p className="help" style={{ marginBottom: 14 }}>Adăugați toate formele corecte (de ex. „Ștefan cel Mare” și „Ștefan al III-lea”). Literele mari, diacriticele și semnele de punctuație nu contează.</p>
          <div className="stack" style={{ gap: 10 }}>
            {q.options.map((o, i) => (
              <div className="row" key={i}>
                <input className="input grow" value={o.text} maxLength={200} placeholder={`Răspuns acceptat ${i + 1}`} aria-label={`Răspuns acceptat ${i + 1}`} onChange={(e) => onOpt(i, { text: e.target.value, correct: true })} />
                {q.options.length > 1 && <button className="btn btn-icon btn-danger" onClick={() => onRemoveOption(i)} aria-label={`Șterge răspunsul ${i + 1}`}>{Icon.x(16)}</button>}
              </div>
            ))}
          </div>
          {q.options.length < MAX_OPTIONS && <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={onAddOption}>{Icon.plus(16)} Adaugă o variantă acceptată</button>}
        </div>
      )}

      {q.type === 'order' && (
        <>
          <p className="help" style={{ marginBottom: 10 }}>Scrieți elementele <b>în ordinea corectă</b>. Elevii le vor primi amestecate.</p>
          <div className="order-edit">
            {q.options.map((o, i) => (
              <div key={i} className={`opt-edit ${OPTION_STYLES[i].cls}`}>
                <span className="shape" style={{ fontWeight: 800, fontSize: '1.3rem' }}>{i + 1}</span>
                <input type="text" value={o.text} maxLength={200} placeholder={`Elementul ${i + 1}`} aria-label={`Elementul ${i + 1}`} onChange={(e) => onOpt(i, { text: e.target.value, correct: true })} />
                <button type="button" className="mini-btn" onClick={() => onMoveOption(i, -1)} disabled={i === 0} aria-label="Mută mai sus">{Icon.up(16)}</button>
                <button type="button" className="mini-btn" onClick={() => onMoveOption(i, 1)} disabled={i === q.options.length - 1} aria-label="Mută mai jos">{Icon.down(16)}</button>
                {q.options.length > 3 ? <button type="button" className="mini-btn" onClick={() => onRemoveOption(i)} aria-label={`Șterge elementul ${i + 1}`}>{Icon.x(16)}</button> : <span />}
              </div>
            ))}
          </div>
          {q.options.length < MAX_OPTIONS && <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={onAddOption}>{Icon.plus(16)} Adaugă element</button>}
        </>
      )}

      {problems.length > 0 && (
        <div className="alert alert-warn problems" role="status">
          <b>De completat înainte de joc:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function SettingsDrawer({ quiz, userId, onChange, onClose }) {
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2 id="settings-title" style={{ margin: 0 }}>Setările testului</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Închide">{Icon.x()}</button>
        </div>
        <div className="stack">
          <div className="field">
            <label htmlFor="s-title">Titlul</label>
            <input id="s-title" className="input" value={quiz.title} maxLength={150} onChange={(e) => onChange({ title: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="s-desc">Descrierea <span className="muted">(opțional)</span></label>
            <textarea id="s-desc" className="textarea" value={quiz.description} maxLength={1000} onChange={(e) => onChange({ description: e.target.value })} placeholder="Tema, obiectivele lecției sau alte indicații pentru colegi" />
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field grow">
              <label htmlFor="s-sub">Disciplina</label>
              <select id="s-sub" className="select" value={quiz.subject} onChange={(e) => onChange({ subject: e.target.value })}>
                <option value="">Alegeți...</option>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field grow">
              <label htmlFor="s-gr">Nivelul</label>
              <select id="s-gr" className="select" value={quiz.grade_level} onChange={(e) => onChange({ grade_level: e.target.value })}>
                <option value="">Alegeți...</option>
                {GRADES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 6 }}>Vizibilitatea</legend>
            <label className="panel row" style={{ padding: 14, cursor: 'pointer', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="radio" name="vis" checked={quiz.visibility === 'private'} onChange={() => onChange({ visibility: 'private' })} style={{ marginTop: 5 }} />
              <span><b>{Icon.lock(16)} Privat</b><br /><span className="help">Doar dumneavoastră vedeți și jucați testul.</span></span>
            </label>
            <label className="panel row" style={{ padding: 14, cursor: 'pointer', alignItems: 'flex-start', flexWrap: 'nowrap', marginTop: 8 }}>
              <input type="radio" name="vis" checked={quiz.visibility === 'public'} onChange={() => onChange({ visibility: 'public' })} style={{ marginTop: 5 }} />
              <span><b>{Icon.globe(16)} Public în bibliotecă</b><br /><span className="help">Alți profesori îl pot găsi, juca și copia. Numele dumneavoastră apare ca autor.</span></span>
            </label>
          </fieldset>
          <div className="field">
            <span className="label">Imaginea de copertă <span className="muted">(opțional)</span></span>
            <ImageField url={quiz.cover_url} onChange={(url) => onChange({ cover_url: url })} userId={userId} quizId={quiz.id} label="Coperta testului" />
          </div>
          <button className="btn btn-primary" onClick={onClose}>Gata</button>
        </div>
      </div>
    </div>
  );
}
