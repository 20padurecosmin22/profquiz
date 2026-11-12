'use client';

import { useRef, useState } from 'react';
import { readRows, rowsToQuestions, downloadTemplate } from '@/lib/excel';
import { TYPES } from '@/lib/questions';
import { Icon } from '@/components/Icons';

export default function ImportModal({ onClose, onImport }) {
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  async function handle(file) {
    if (!file) return;
    setErr('');
    setResult(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const rows = await readRows(file);
      const r = rowsToQuestions(rows);
      if (r.questions.length === 0) setErr('Nu am găsit întrebări în fișier. Verificați că prima foaie are coloanele din șablon.');
      else setResult(r);
    } catch (e) {
      setErr(e.message || 'Fișierul nu a putut fi citit.');
    }
    setBusy(false);
  }

  const issuesByLine = new Map((result?.issues || []).map((i) => [i.text, i]));

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="imp-title">
        <div className="row between">
          <h2 id="imp-title" style={{ margin: 0 }}>Import din Excel sau CSV</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Închide">{Icon.x()}</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Completați șablonul ProfQuiz (o întrebare pe rând) sau încărcați un fișier în formatul șablonului Kahoot.
          Întrebările se adaugă la sfârșitul testului.
        </p>
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn" onClick={() => downloadTemplate().catch((e) => setErr(e.message))}>{Icon.download(18)} Descarcă șablonul Excel</button>
        </div>

        <div
          className="file-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files?.[0]); }}
        >
          <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
          <div style={{ color: 'var(--violet)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>{Icon.upload(32)}</div>
          <p style={{ fontWeight: 650, margin: '0 0 10px' }}>{busy ? 'Se citește fișierul...' : fileName ? fileName : 'Trageți fișierul aici'}</p>
          <button className="btn btn-sm" onClick={() => input.current.click()} disabled={busy}>Alegeți fișierul (.xlsx sau .csv)</button>
        </div>

        {err && <p className="alert alert-bad" role="alert" style={{ marginTop: 16 }}>{err}</p>}

        {result && (
          <div style={{ marginTop: 20 }}>
            <p className={`alert ${result.issues.length ? 'alert-warn' : 'alert-ok'}`} role="status">
              Am găsit <b>{result.questions.length}</b> întrebări.
              {result.issues.length > 0 && ` ${result.issues.length} au nevoie de completări (sunt marcate mai jos); le puteți corecta după import, în editor.`}
              {result.skipped > 0 && ` ${result.skipped} rânduri au fost sărite.`}
            </p>
            <ul className="preview-list" style={{ marginTop: 12 }}>
              {result.questions.map((q, i) => {
                const issue = issuesByLine.get(q.text);
                return (
                  <li key={q.id} className={issue ? 'bad' : ''}>
                    <b>{i + 1}. {q.text || <em>(fără text)</em>}</b>
                    <div className="small muted">
                      {TYPES[q.type].label}, {q.time_limit} s, {q.options.map((o) => (o.correct && q.type !== 'text' && q.type !== 'order' ? `${o.text} (corect)` : o.text)).join(' | ')}
                    </div>
                    {issue && <div className="small" style={{ color: 'var(--bad)' }}>{issue.message}</div>}
                  </li>
                );
              })}
            </ul>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={onClose}>Renunță</button>
              <button className="btn btn-primary" onClick={() => onImport(result.questions)}>Adaugă {result.questions.length} întrebări</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
