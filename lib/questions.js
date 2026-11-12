
export const TYPES = {
  single: {
    label: 'Alegere unică',
    short: 'Unic',
    help: 'Un singur răspuns corect din 2-6 variante.',
  },
  multiple: {
    label: 'Alegere multiplă',
    short: 'Multiplu',
    help: 'Mai multe răspunsuri corecte. Elevul le bifează pe toate.',
  },
  truefalse: {
    label: 'Adevărat / Fals',
    short: 'A/F',
    help: 'O afirmație pe care elevul o confirmă sau o infirmă.',
  },
  text: {
    label: 'Răspuns scris',
    short: 'Scris',
    help: 'Elevul scrie răspunsul. Literele mari și diacriticele nu contează.',
  },
  order: {
    label: 'Ordonare',
    short: 'Ordine',
    help: 'Elevul aranjează elementele în ordinea corectă.',
  },
  poll: {
    label: 'Sondaj',
    short: 'Sondaj',
    help: 'Fără răspuns corect și fără puncte. Util pentru opinii și feedback.',
  },
};

export const TYPE_ORDER = ['single', 'multiple', 'truefalse', 'text', 'order', 'poll'];
export const TIME_CHOICES = [5, 10, 20, 30, 45, 60, 90, 120, 180, 240];
export const POINTS = {
  standard: { label: 'Standard', base: 1000 },
  double: { label: 'Dublu', base: 2000 },
  none: { label: 'Fără puncte', base: 0 },
};
export const MAX_OPTIONS = 6;

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function optionsFor(type, previous = []) {
  const texts = previous.map((o) => o.text).filter((t) => t && t.trim());
  if (type === 'truefalse') {
    const firstCorrect = previous.find((o) => o.correct);
    const trueIsCorrect = !firstCorrect || /^adev/i.test(firstCorrect.text || '') || previous.indexOf(firstCorrect) === 0;
    return [
      { text: 'Adevărat', correct: trueIsCorrect },
      { text: 'Fals', correct: !trueIsCorrect },
    ];
  }
  if (type === 'text') {
    const first = previous.find((o) => o.correct) || previous[0];
    return [{ text: first && !/^(adevărat|fals)$/i.test(first.text) ? first.text : '', correct: true }];
  }
  if (type === 'order') {
    const items = texts.length >= 3 ? texts : [...texts, '', '', ''].slice(0, Math.max(3, texts.length));
    return items.slice(0, MAX_OPTIONS).map((text) => ({ text, correct: true }));
  }
  const base = texts.length >= 2 && previous.length > 0 && !(type !== 'truefalse' && texts.join() === 'Adevărat,Fals')
    ? previous.map((o) => ({ text: o.text, correct: !!o.correct }))
    : [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
  if (type === 'poll') return base.map((o) => ({ text: o.text, correct: false }));
  if (type === 'single') {
    let seen = false;
    const list = base.map((o) => {
      const c = o.correct && !seen;
      if (c) seen = true;
      return { ...o, correct: c };
    });
    if (!seen && list[0]) list[0].correct = true;
    return list;
  }
  if (type === 'multiple' && !base.some((o) => o.correct) && base[0]) base[0].correct = true;
  return base;
}

export function blankQuestion(type = 'single') {
  return {
    id: newId(),
    type,
    text: '',
    image_url: null,
    time_limit: type === 'text' || type === 'order' ? 30 : 20,
    points: type === 'poll' ? 'none' : 'standard',
    options: optionsFor(type),
  };
}

export function problemsOf(q) {
  const list = [];
  if (!q.text.trim() && !q.image_url) list.push('Lipsește textul întrebării.');
  const filled = q.options.filter((o) => o.text.trim());
  if (q.type === 'text') {
    if (filled.length === 0) list.push('Adăugați cel puțin un răspuns acceptat.');
  } else if (q.type === 'order') {
    if (filled.length < 3) list.push('Ordonarea are nevoie de cel puțin 3 elemente.');
    if (filled.length !== q.options.length) list.push('Completați sau ștergeți elementele goale.');
  } else {
    if (filled.length < 2) list.push('Completați cel puțin două variante.');
    if (filled.length !== q.options.length) list.push('Completați sau ștergeți variantele goale.');
    if (q.type !== 'poll' && !q.options.some((o) => o.correct && o.text.trim())) list.push('Marcați răspunsul corect.');
  }
  return list;
}

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ţ]/g, 't')
    .replace(/[ş]/g, 's')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isCorrect(q, answer) {
  if (!answer) return false;
  if (q.type === 'poll') return null;
  if (q.type === 'single' || q.type === 'truefalse') {
    return typeof answer.c === 'number' && !!q.options[answer.c]?.correct;
  }
  if (q.type === 'multiple') {
    const want = q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0).sort().join(',');
    const got = [...new Set(answer.m || [])].sort().join(',');
    return want.length > 0 && want === got;
  }
  if (q.type === 'text') {
    const t = normalizeText(answer.t);
    return !!t && q.options.some((o) => normalizeText(o.text) === t);
  }
  if (q.type === 'order') {
    const o = answer.o || [];
    return o.length === q.options.length && o.every((v, i) => v === i);
  }
  return false;
}

export function pointsFor(q, correct, elapsedSec) {
  const base = POINTS[q.points]?.base ?? 1000;
  if (!correct || base === 0) return 0;
  const ratio = Math.min(Math.max(elapsedSec / q.time_limit, 0), 1);
  return Math.round(base * (1 - ratio / 2));
}

export function describeAnswer(q, answer) {
  if (!answer) return '-';
  const L = (i) => String.fromCharCode(65 + i);
  if (q.type === 'single' || q.type === 'truefalse' || q.type === 'poll') return typeof answer.c === 'number' ? `${L(answer.c)}. ${q.options[answer.c]?.text ?? ''}` : '-';
  if (q.type === 'multiple') return (answer.m || []).slice().sort().map(L).join(', ') || '-';
  if (q.type === 'text') return answer.t || '-';
  if (q.type === 'order') return (answer.o || []).map((i) => q.options[i]?.text ?? '?').map((t, i) => `${i + 1}. ${t}`).join(', ');
  return '-';
}

export function correctSummary(q) {
  const L = (i) => String.fromCharCode(65 + i);
  if (q.type === 'poll') return 'Sondaj (fără răspuns corect)';
  if (q.type === 'text') return q.options.map((o) => o.text).filter(Boolean).join(' / ');
  if (q.type === 'order') return q.options.map((o) => o.text).map((t, i) => `${i + 1}. ${t}`).join(', ');
  return q.options.map((o, i) => (o.correct ? `${L(i)}. ${o.text}` : null)).filter(Boolean).join('; ');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const SUBJECTS = [
  'Informatică', 'Matematică', 'Limba și literatura română', 'Limba engleză', 'Limba franceză', 'Limba rusă',
  'Istoria românilor și universală', 'Geografie', 'Biologie', 'Chimie', 'Fizică', 'Educație civică',
  'Educație tehnologică', 'Educație muzicală', 'Educație plastică', 'Educație fizică', 'Economie',
  'Discipline de specialitate', 'Altele',
];

export const GRADES = [
  'Clasele I-IV', 'Clasele V-IX', 'Liceu (X-XII)', 'Colegiu / școală profesională', 'Universitate', 'Formare continuă',
];
