'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteSession } from '@/app/actions/games';
import { exportWorkbook } from '@/lib/excel';
import { TYPES, describeAnswer, correctSummary } from '@/lib/questions';
import { OPTION_STYLES } from '@/components/Shape';
import { Icon } from '@/components/Icons';

function fmt(d) {
  return new Date(d).toLocaleString('ro-MD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Chisinau' });
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const meterCls = (p) => (p === null ? '' : p < 40 ? 'low' : p < 70 ? 'mid' : '');

export default function Report({ session, players, answers }) {
  const router = useRouter();
  const [tab, setTab] = useState('rezumat');
  const questions = Array.isArray(session.quiz_snapshot) ? session.quiz_snapshot : [];
  const gradableIdx = questions.map((q, i) => (q.type !== 'poll' ? i : -1)).filter((i) => i >= 0);

  const byPlayer = useMemo(() => {
    const m = {};
    answers.forEach((a) => { (m[a.player_id] ||= {})[a.question_index] = a; });
    return m;
  }, [answers]);

  const qStats = useMemo(
    () =>
      questions.map((q, i) => {
        const list = answers.filter((a) => a.question_index === i);
        const correct = list.filter((a) => a.is_correct).length;
        const times = list.map((a) => a.time_ms).filter((t) => t !== null);
        const counts = q.options.map(() => 0);
        if (q.type === 'multiple') list.forEach((a) => (a.answer?.m || []).forEach((k) => { if (counts[k] !== undefined) counts[k] += 1; }));
        else if (['single', 'truefalse', 'poll'].includes(q.type)) list.forEach((a) => { if (counts[a.answer?.c] !== undefined) counts[a.answer.c] += 1; });
        return {
          answered: list.length,
          correct,
          acc: q.type === 'poll' ? null : pct(correct, players.length),
          avgTime: times.length ? Math.round(times.reduce((t, v) => t + v, 0) / times.length / 100) / 10 : null,
          counts,
          texts: q.type === 'text' ? list.map((a) => a.answer?.t).filter(Boolean) : [],
        };
      }),
    [questions, answers, players.length]
  );

  const avgAcc = players.length && gradableIdx.length
    ? Math.round(players.reduce((t, p) => t + p.correct_count / gradableIdx.length, 0) / players.length * 100)
    : null;
  const hardest = gradableIdx.map((i) => ({ i, acc: qStats[i].acc ?? 0 })).sort((a, b) => a.acc - b.acc).slice(0, 3);
  const struggling = players.filter((p) => gradableIdx.length && p.correct_count / gradableIdx.length < 0.5);

  async function exportXlsx() {
    const date = new Date(session.created_at).toISOString().slice(0, 10);
    const safe = session.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'test';
    await exportWorkbook(`ProfQuiz-${safe}-${date}.xlsx`, [
      {
        name: 'Elevi',
        widths: [8, 28, 10, 14, 14, ...questions.map(() => 8)],
        rows: [
          ['Locul', 'Numele', 'Punctaj', 'Corecte', 'Procent', ...questions.map((_, i) => `Î${i + 1}`)],
          ...players.map((p, k) => [
            p.rank ?? k + 1, p.name, p.score, `${p.correct_count}/${gradableIdx.length}`,
            gradableIdx.length ? `${pct(p.correct_count, gradableIdx.length)}%` : '-',
            ...questions.map((q, i) => {
              const a = byPlayer[p.id]?.[i];
              if (!a) return '-';
              return q.type === 'poll' ? 'răspuns' : a.is_correct ? 'corect' : 'greșit';
            }),
          ]),
        ],
      },
      {
        name: 'Întrebări',
        widths: [6, 50, 18, 40, 12, 14, 14],
        rows: [
          ['Nr.', 'Întrebarea', 'Tipul', 'Răspunsul corect', 'Au răspuns', 'Corecte (%)', 'Timp mediu (s)'],
          ...questions.map((q, i) => [i + 1, q.text, TYPES[q.type]?.label, correctSummary(q), qStats[i].answered, qStats[i].acc === null ? '-' : `${qStats[i].acc}%`, qStats[i].avgTime ?? '-']),
        ],
      },
      {
        name: 'Răspunsuri',
        widths: [28, 6, 40, 40, 10, 10, 10],
        rows: [
          ['Elevul', 'Nr.', 'Întrebarea', 'Răspunsul dat', 'Corect', 'Puncte', 'Timp (s)'],
          ...players.flatMap((p) => questions.map((q, i) => {
            const a = byPlayer[p.id]?.[i];
            return [p.name, i + 1, q.text, a ? describeAnswer(q, a.answer) : 'fără răspuns', q.type === 'poll' ? '-' : a?.is_correct ? 'da' : 'nu', a?.points ?? 0, a?.time_ms != null ? Math.round(a.time_ms / 100) / 10 : '-'];
          })),
        ],
      },
    ]);
  }

  async function remove() {
    if (!confirm('Ștergeți definitiv acest raport?')) return;
    const r = await deleteSession(session.id);
    if (!r.ok) return alert(r.error);
    router.replace('/panou/rapoarte');
    router.refresh();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/panou/rapoarte" className="small">Înapoi la rapoarte</Link>
          <h1 style={{ marginTop: 6 }}>{session.title}</h1>
          <p>Joc live din {fmt(session.created_at)}, PIN {session.pin}</p>
        </div>
        <div className="row">
          {session.quiz_id && <Link href={`/live/${session.quiz_id}`} className="btn">{Icon.play(16)} Joacă din nou</Link>}
          <button className="btn btn-primary" onClick={() => exportXlsx().catch((e) => alert(e.message))}>{Icon.download(18)} Descarcă în Excel</button>
          <button className="btn btn-icon btn-danger" onClick={remove} aria-label="Șterge raportul" title="Șterge raportul">{Icon.trash(18)}</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><b>{players.length}</b><span>elevi participanți</span></div>
        <div className="kpi"><b>{questions.length}</b><span>întrebări</span></div>
        <div className="kpi"><b>{avgAcc === null ? '-' : `${avgAcc}%`}</b><span>răspunsuri corecte, în medie</span></div>
        <div className="kpi"><b>{struggling.length}</b><span>elevi sub 50%</span></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Secțiunile raportului">
        {[['rezumat', 'Rezumat'], ['elevi', 'Elevi'], ['matrice', 'Răspunsuri pe elev'], ['intrebari', 'Întrebări']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'rezumat' && (
        <div className="stack" style={{ gap: 24 }}>
          {hardest.length > 0 && (
            <div className="panel">
              <h2>Întrebările care au pus cele mai multe probleme</h2>
              <p className="muted">Merită reluate la lecția următoare.</p>
              <div className="stack" style={{ gap: 10 }}>
                {hardest.map(({ i, acc }) => (
                  <div key={i} className="alert alert-warn">
                    <b>Întrebarea {i + 1}: {questions[i].text}</b><br />
                    {acc}% răspunsuri corecte, Răspunsul corect: {correctSummary(questions[i])}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="panel">
            <h2>Răspunsuri corecte la fiecare întrebare</h2>
            {questions.map((q, i) => (
              <div className="bar-row" key={i}>
                <span className="qn">{i + 1}</span>
                <div>
                  <div className="qt">{q.text}</div>
                  {q.type === 'poll' ? <span className="tag gray">Sondaj, {qStats[i].answered} răspunsuri</span> : <div className={`meter ${meterCls(qStats[i].acc)}`}><span style={{ width: `${qStats[i].acc ?? 0}%` }} /></div>}
                </div>
                <span className="pct">{q.type === 'poll' ? '' : `${qStats[i].acc ?? 0}%`}</span>
              </div>
            ))}
          </div>
          {struggling.length > 0 && (
            <div className="panel">
              <h2>Elevi care au nevoie de sprijin</h2>
              <p className="muted">Au răspuns corect la mai puțin de jumătate din întrebări.</p>
              <div className="row">{struggling.map((p) => <span key={p.id} className="tag bad">{p.name}, {pct(p.correct_count, gradableIdx.length)}%</span>)}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'elevi' && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th className="num">Locul</th><th>Numele</th><th className="num">Punctaj</th><th className="num">Corecte</th><th>Procent</th><th className="num">Au răspuns</th></tr></thead>
            <tbody>
              {players.map((p, k) => {
                const pr = gradableIdx.length ? pct(p.correct_count, gradableIdx.length) : null;
                return (
                  <tr key={p.id}>
                    <td className="num">{p.rank ?? k + 1}</td>
                    <td><b>{p.name}</b></td>
                    <td className="num">{p.score}</td>
                    <td className="num">{p.correct_count}/{gradableIdx.length}</td>
                    <td style={{ minWidth: 160 }}>{pr === null ? '-' : <div className="row" style={{ flexWrap: 'nowrap' }}><div className={`meter grow ${meterCls(pr)}`}><span style={{ width: `${pr}%` }} /></div><b style={{ width: 44, textAlign: 'right' }}>{pr}%</b></div>}</td>
                    <td className="num">{p.answered_count}/{questions.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'matrice' && (
        <>
          <p className="help" style={{ marginBottom: 12 }}>Verde: corect. Roșu: greșit. Gri: fără răspuns. Violet: sondaj. Treceți cu mouse-ul peste o celulă pentru a vedea răspunsul dat.</p>
          <div className="table-wrap">
            <table className="data matrix">
              <thead><tr><th>Elevul</th>{questions.map((_, i) => <th key={i} title={questions[i].text}>Î{i + 1}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    {questions.map((q, i) => {
                      const a = byPlayer[p.id]?.[i];
                      const title = a ? describeAnswer(q, a.answer) : 'fără răspuns';
                      if (!a) return <td key={i} className="cell-none" title={title}>-</td>;
                      if (q.type === 'poll') return <td key={i} title={title}><span className="dot dot-poll" aria-label="sondaj" /></td>;
                      return <td key={i} className={a.is_correct ? 'cell-ok' : 'cell-bad'} title={title} aria-label={a.is_correct ? 'corect' : 'greșit'}>{a.is_correct ? Icon.check(16) : Icon.x(16)}</td>;
                    })}
                    <td className="num"><b>{p.correct_count}/{gradableIdx.length}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'intrebari' && (
        <div className="stack">
          {questions.map((q, i) => {
            const st = qStats[i];
            const max = Math.max(1, ...st.counts);
            return (
              <div className="panel" key={i}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <h2 style={{ margin: 0 }}>{i + 1}. {q.text}</h2>
                  <span className="tag gray">{TYPES[q.type]?.label}</span>
                </div>
                <p className="muted small" style={{ margin: '8px 0 14px' }}>
                  {st.answered} din {players.length} au răspuns{st.acc !== null ? `, ${st.acc}% corect` : ''}{st.avgTime !== null ? `, timp mediu ${st.avgTime} s` : ''}
                </p>
                {['single', 'multiple', 'truefalse', 'poll'].includes(q.type) && (
                  <div className="stack" style={{ gap: 8 }}>
                    {q.options.map((o, k) => (
                      <div key={k} className="row" style={{ flexWrap: 'nowrap' }}>
                        <span style={{ width: 28, fontWeight: 800 }}>{OPTION_STYLES[k].letter}</span>
                        <span style={{ flex: '0 0 38%' }}>{o.text} {q.type !== 'poll' && o.correct && <span className="tag ok">corect</span>}</span>
                        <div className="meter grow"><span className={OPTION_STYLES[k].cls} style={{ width: `${(st.counts[k] / max) * 100}%` }} /></div>
                        <b style={{ width: 32, textAlign: 'right' }}>{st.counts[k]}</b>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'text' && (
                  <>
                    <p><b>Acceptat:</b> {correctSummary(q)}</p>
                    <div className="row">{st.texts.length ? st.texts.map((t, k) => <span key={k} className="tag gray">{t}</span>) : <span className="muted">Niciun răspuns</span>}</div>
                  </>
                )}
                {q.type === 'order' && <p><b>Ordinea corectă:</b> {correctSummary(q)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
