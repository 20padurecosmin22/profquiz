'use client';

import { TYPES, TIME_CHOICES, newId, problemsOf } from './questions';

const H = (v) => ({ value: v, fontWeight: 'bold', backgroundColor: '#EDE7FF' });

export const TEMPLATE_HEADER = [
  'Întrebare', 'Tip', 'Varianta 1', 'Varianta 2', 'Varianta 3', 'Varianta 4', 'Varianta 5', 'Varianta 6',
  'Corect', 'Timp (secunde)', 'Imagine (link, opțional)',
];

export async function downloadTemplate() {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const rows = [
    TEMPLATE_HEADER.map(H),
    ['Care este capitala Republicii Moldova?', 'unic', 'Bălți', 'Chișinău', 'Cahul', 'Orhei', null, null, '2', 20, null],
    ['Care dintre numerele de mai jos sunt pare?', 'multiplu', '3', '4', '7', '10', null, null, '2,4', 30, null],
    ['Apa fierbe la 100 °C la presiune normală.', 'adevărat/fals', null, null, null, null, null, null, 'Adevărat', 10, null],
    ['Scrieți simbolul chimic al fierului.', 'scris', 'Fe', null, null, null, null, null, null, 30, null],
    ['Ordonați etapele, de la prima la ultima:', 'ordonare', 'Planificarea', 'Proiectarea', 'Programarea', 'Testarea', null, null, null, 45, null],
    ['Cât de clară a fost tema de astăzi?', 'sondaj', 'Foarte clară', 'Mai am întrebări', 'Neclară', null, null, null, null, 20, null],
  ];
  const help = [
    [H('Coloana'), H('Ce scrieți')],
    ['Tip', 'unic, multiplu, adevărat/fals, scris, ordonare sau sondaj. Dacă o lăsați goală: „unic” (sau „multiplu” dacă la Corect sunt mai multe numere).'],
    ['Varianta 1-6', 'Variantele de răspuns. La „scris”: toate răspunsurile acceptate. La „ordonare”: elementele, în ordinea corectă.'],
    ['Corect', 'Numărul variantei corecte (1-6) sau litera ei (A-F). La „multiplu”: mai multe, separate prin virgulă (de ex. 1,3). La „adevărat/fals”: Adevărat sau Fals. La „scris”, „ordonare” și „sondaj” rămâne goală.'],
    ['Timp (secunde)', 'Între 5 și 240. Dacă lipsește: 20 de secunde.'],
    ['Imagine', 'Opțional: un link public către o imagine (https://...). Imaginile se pot adăuga și direct din editor.'],
    ['Kahoot', 'Pot fi încărcate și fișierele în formatul șablonului Kahoot (Question, Answer 1-4, Time limit, Correct answer).'],
  ];
  await writeExcelFile([
    { data: rows, sheet: 'Întrebări', columns: [{ width: 46 }, { width: 14 }, ...Array(6).fill({ width: 18 }), { width: 10 }, { width: 14 }, { width: 30 }], stickyRowsCount: 1 },
    { data: help, sheet: 'Instrucțiuni', columns: [{ width: 18 }, { width: 110 }] },
  ]).toFile('ProfQuiz-sablon-intrebari.xlsx');
}

export async function exportWorkbook(fileName, sheets) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(
    sheets.map((s) => ({
      sheet: s.name.slice(0, 31),
      data: [s.rows[0].map(H), ...s.rows.slice(1).map((r) => r.map((c) => (c === undefined ? null : c)))],
      columns: s.widths ? s.widths.map((w) => ({ width: w })) : undefined,
      stickyRowsCount: 1,
    }))
  ).toFile(fileName);
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function readRows(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsv((await file.text()).replace(/^﻿/, ''));
  }
  if (!name.endsWith('.xlsx')) throw new Error('Încărcați un fișier .xlsx sau .csv. Fișierele .xls vechi se salvează întâi din Excel ca .xlsx.');
  const { readSheet } = await import('read-excel-file/browser');
  return await readSheet(file);
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const norm = (v) => str(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function detectColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r].map(norm);
    const qi = cells.findIndex((c) => /^(intrebare|intrebarea|question|text)/.test(c) || /question -|intrebare \(/.test(c));
    if (qi === -1) continue;
    const map = { header: r, q: qi, type: -1, opts: [], correct: -1, time: -1, image: -1 };
    cells.forEach((c, i) => {
      if (i === qi) return;
      if (/^(tip|type)\b/.test(c)) map.type = i;
      else if (/(varianta|answer|raspuns|optiune|option)\s*\d/.test(c)) map.opts.push(i);
      else if (/corect|correct/.test(c)) map.correct = i;
      else if (/^(timp|time)/.test(c)) map.time = i;
      else if (/imagin|image|poza/.test(c)) map.image = i;
    });
    if (map.opts.length) return map;
  }
  return { header: -1, q: 0, type: 1, opts: [2, 3, 4, 5, 6, 7], correct: 8, time: 9, image: 10 };
}

function parseType(v, correctTokens) {
  const t = norm(v);
  if (!t) return correctTokens.length > 1 ? 'multiple' : 'single';
  if (/^(unic|single|quiz|alegere unica)/.test(t)) return 'single';
  if (/^(multi|multiple)/.test(t)) return 'multiple';
  if (/adevarat|fals|true|false|a\/f/.test(t)) return 'truefalse';
  if (/scris|text|type answer|raspuns scris/.test(t)) return 'text';
  if (/ordon|order|puzzle/.test(t)) return 'order';
  if (/sondaj|poll|opinie/.test(t)) return 'poll';
  return null;
}

function correctTokens(v) {
  return str(v)
    .split(/[,;\s/]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (/^[a-f]$/i.test(x) ? x.toUpperCase().charCodeAt(0) - 65 : /^\d+$/.test(x) ? Number(x) - 1 : NaN))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < 6);
}

function snapTime(v) {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 20;
  return TIME_CHOICES.reduce((best, t) => (Math.abs(t - n) < Math.abs(best - n) ? t : best), 20);
}

export function rowsToQuestions(rows) {
  const map = detectColumns(rows);
  const out = [];
  const issues = [];
  let skipped = 0;
  for (let r = map.header + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const text = str(row[map.q]);
    const opts = map.opts.map((i) => str(row[i]));
    if (!text && opts.every((o) => !o)) continue;
    const rawCorrect = map.correct >= 0 ? row[map.correct] : '';
    const tokens = correctTokens(rawCorrect);
    const type = parseType(map.type >= 0 ? row[map.type] : '', tokens);
    if (!type) {
      issues.push({ line: r + 1, text, message: `Tipul „${str(row[map.type])}” nu este cunoscut.` });
      skipped++;
      continue;
    }
    let options;
    const filled = opts.filter(Boolean);
    if (type === 'truefalse') {
      const c = norm(rawCorrect);
      const isTrue = /^(adevarat|true|da|1|a)$/.test(c) || (!c && true);
      options = [{ text: 'Adevărat', correct: isTrue }, { text: 'Fals', correct: !isTrue }];
    } else if (type === 'text') {
      options = (filled.length ? filled : str(rawCorrect) ? [str(rawCorrect)] : []).map((t) => ({ text: t, correct: true }));
    } else if (type === 'order') {
      options = filled.map((t) => ({ text: t, correct: true }));
    } else {
      options = opts.map((t, i) => ({ text: t, correct: type !== 'poll' && tokens.includes(i) })).filter((o) => o.text);
      if (type === 'single' && options.filter((o) => o.correct).length > 1) {
        let seen = false;
        options = options.map((o) => { const c = o.correct && !seen; if (c) seen = true; return { ...o, correct: c }; });
      }
    }
    const image = map.image >= 0 ? str(row[map.image]) : '';
    const q = {
      id: newId(),
      type,
      text: text.slice(0, 500),
      image_url: /^https:\/\//i.test(image) ? image : null,
      time_limit: snapTime(map.time >= 0 ? row[map.time] : 20),
      points: type === 'poll' ? 'none' : 'standard',
      options: options.slice(0, 6).map((o) => ({ ...o, text: o.text.slice(0, 200) })),
    };
    const p = problemsOf(q);
    if (p.length) issues.push({ line: r + 1, text, message: p.join(' ') });
    out.push(q);
  }
  return { questions: out, skipped, issues, typeLabel: (t) => TYPES[t]?.label };
}
