'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { SUBJECTS, GRADES, TIME_CHOICES, MAX_OPTIONS } from '@/lib/questions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ['single', 'multiple', 'truefalse', 'text', 'order', 'poll'];
const POINTS = ['standard', 'double', 'none'];
const str = (v, max) => String(v ?? '').slice(0, max);
const MAX_QUESTIONS = 200;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

function cleanImage(v, userId) {
  if (!v) return null;
  const s = String(v);
  if (/^https:\/\/[^\s"'<>]{1,500}$/i.test(s)) return s;
  const parts = s.split('/');
  if (parts.length === 3 && parts[0] === userId && parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p))) return s;
  return null;
}

function cleanQuestion(q, position, quizId, userId) {
  const type = TYPES.includes(q?.type) ? q.type : 'single';
  const options = (Array.isArray(q?.options) ? q.options : []).slice(0, MAX_OPTIONS).map((o) => ({
    text: str(o?.text, 200),
    correct: type === 'poll' ? false : type === 'text' || type === 'order' ? true : !!o?.correct,
  }));
  return {
    id: UUID.test(q?.id) ? q.id : crypto.randomUUID(),
    quiz_id: quizId,
    position,
    type,
    text: str(q?.text, 500),
    image_url: cleanImage(q?.image_url, userId),
    time_limit: TIME_CHOICES.includes(Number(q?.time_limit)) ? Number(q.time_limit) : 20,
    points: type === 'poll' ? 'none' : POINTS.includes(q?.points) ? q.points : 'standard',
    options,
  };
}

export async function createQuiz() {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };
  const { data, error } = await supabase.from('quizzes').insert({ owner_id: user.id, title: 'Test fără titlu' }).select('id').single();
  return error ? { ok: false, error: 'Testul nu a putut fi creat.' } : { ok: true, id: data.id };
}

export async function deleteQuiz(id) {
  if (!UUID.test(id)) return { ok: false, error: 'Test invalid.' };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat.' };
  const { error } = await supabase.from('quizzes').delete().eq('id', id).eq('owner_id', user.id);
  return error ? { ok: false, error: 'Testul nu a putut fi șters.' } : { ok: true };
}

export async function copyQuiz(id) {
  if (!UUID.test(id)) return { ok: false, error: 'Test invalid.' };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat.' };
  const { data, error } = await supabase.rpc('copy_quiz', { p_quiz: id });
  return error ? { ok: false, error: 'Testul nu a putut fi copiat.' } : { ok: true, id: data };
}

export async function saveQuiz({ quiz, questions, deletedIds }) {
  if (!quiz || !UUID.test(quiz.id)) return { ok: false, error: 'Test invalid.' };
  if (!Array.isArray(questions) || questions.length > MAX_QUESTIONS) return { ok: false, error: `Un test poate avea cel mult ${MAX_QUESTIONS} de întrebări.` };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };

  const { data: owned } = await supabase.from('quizzes').select('id').eq('id', quiz.id).eq('owner_id', user.id).maybeSingle();
  if (!owned) return { ok: false, error: 'Nu aveți drept de editare pentru acest test.' };

  const { error: e1 } = await supabase.from('quizzes').update({
    title: str(quiz.title, 150).trim() || 'Test fără titlu',
    description: str(quiz.description, 1000),
    subject: SUBJECTS.includes(quiz.subject) ? quiz.subject : '',
    grade_level: GRADES.includes(quiz.grade_level) ? quiz.grade_level : '',
    visibility: quiz.visibility === 'public' ? 'public' : 'private',
    cover_url: cleanImage(quiz.cover_url, user.id),
  }).eq('id', quiz.id);
  if (e1) return { ok: false, error: 'Setările testului nu au putut fi salvate.' };

  const del = (Array.isArray(deletedIds) ? deletedIds : []).filter((d) => UUID.test(d)).slice(0, 500);
  if (del.length) {
    const { error } = await supabase.from('questions').delete().eq('quiz_id', quiz.id).in('id', del);
    if (error) return { ok: false, error: 'Întrebările șterse nu au putut fi eliminate.' };
  }
  if (questions.length) {
    const rows = questions.map((q, i) => cleanQuestion(q, i, quiz.id, user.id));
    const { error } = await supabase.from('questions').upsert(rows);
    if (error) return { ok: false, error: 'Întrebările nu au putut fi salvate.' };
  }
  return { ok: true };
}

export async function uploadImage(formData) {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat.' };
  const file = formData.get('file');
  const quizId = String(formData.get('quizId') || '');
  if (!UUID.test(quizId)) return { ok: false, error: 'Test invalid.' };
  if (!file || typeof file === 'string') return { ok: false, error: 'Nu a fost primită nicio imagine.' };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { ok: false, error: 'Sunt acceptate imagini PNG, JPG, WEBP sau GIF.' };
  if (file.size > 3.5 * 1024 * 1024) return { ok: false, error: 'Imaginea este prea mare (maximum 3,5 MB).' };
  const { data: owned } = await supabase.from('quizzes').select('id').eq('id', quizId).eq('owner_id', user.id).maybeSingle();
  if (!owned) return { ok: false, error: 'Nu aveți drept de editare pentru acest test.' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sig = Array.from(bytes.slice(0, 12));
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  const isGif = sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46;
  const isWebp = sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50;
  const matches = { png: isPng, jpg: isJpg, gif: isGif, webp: isWebp }[ext];
  if (!matches) return { ok: false, error: 'Fișierul nu este o imagine validă.' };

  const path = `${user.id}/${quizId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('quiz-images').upload(path, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false });
  return error ? { ok: false, error: 'Încărcarea imaginii a eșuat.' } : { ok: true, path };
}
