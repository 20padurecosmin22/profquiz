'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { problemsOf } from '@/lib/questions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT = /^[a-z0-9]{6,24}$/;
const int = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

async function ownSession(supabase, userId, sessionId) {
  if (!UUID.test(sessionId)) return false;
  const { data } = await supabase.from('game_sessions').select('id').eq('id', sessionId).eq('host_id', userId).maybeSingle();
  return !!data;
}

export async function findGame(pin) {
  const p = String(pin || '');
  if (!/^[0-9]{6}$/.test(p)) return { ok: false };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('session_by_pin', { p_pin: p });
  if (error) return { ok: false, error: 'network' };
  return { ok: Array.isArray(data) && data.length > 0 };
}

export async function createSession(quizId) {
  if (!UUID.test(quizId)) return { ok: false, error: 'Test invalid.' };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };
  const { data: quiz } = await supabase.from('quizzes').select('id,title').eq('id', quizId).maybeSingle();
  if (!quiz) return { ok: false, error: 'Testul nu există sau nu este accesibil.' };
  const { data: questions } = await supabase
    .from('questions')
    .select('id,type,text,image_url,time_limit,points,options')
    .eq('quiz_id', quizId)
    .order('position');

  const playable = (questions || []).filter((q) => problemsOf({ ...q, options: q.options || [] }).length === 0);
  if (!playable.length) return { ok: false, error: 'Testul nu are nicio întrebare completă.' };

  await supabase.from('game_sessions').update({ status: 'abandoned' }).eq('host_id', user.id).in('status', ['lobby', 'running']);

  for (let i = 0; i < 6; i++) {
    const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({ quiz_id: quiz.id, host_id: user.id, pin, title: quiz.title, quiz_snapshot: playable })
      .select('id,pin')
      .single();
    if (!error) return { ok: true, id: data.id, pin: data.pin, questions: playable };
    if (error.code !== '23505') return { ok: false, error: 'Jocul nu a putut fi creat.' };
  }
  return { ok: false, error: 'Nu am putut genera un PIN liber. Reîncercați.' };
}

export async function markSession(sessionId, status) {
  if (!['running', 'finished', 'abandoned'].includes(status)) return { ok: false };
  const { supabase, user } = await requireUser();
  if (!user || !(await ownSession(supabase, user.id, sessionId))) return { ok: false, error: 'Acces refuzat.' };
  const patch = { status };
  if (status === 'running') patch.started_at = new Date().toISOString();
  else patch.ended_at = new Date().toISOString();
  const { error } = await supabase.from('game_sessions').update(patch).eq('id', sessionId);
  return error ? { ok: false, error: 'Starea jocului nu a putut fi salvată.' } : { ok: true };
}

export async function saveRound({ sessionId, qIndex, players, answers }) {
  const { supabase, user } = await requireUser();
  if (!user || !(await ownSession(supabase, user.id, sessionId))) return { ok: false, error: 'Acces refuzat.' };
  const list = (Array.isArray(players) ? players : []).slice(0, 300).filter((p) => CLIENT.test(p?.clientId));
  if (!list.length) return { ok: true };
  const rows = list.map((p) => ({
    session_id: sessionId,
    client_id: p.clientId,
    name: String(p.name || 'Fără nume').slice(0, 24),
    score: int(p.score, 0, 10000000),
    correct_count: int(p.correctCount, 0, 1000),
    answered_count: int(p.answeredCount, 0, 1000),
  }));
  const { data, error } = await supabase.from('session_players').upsert(rows, { onConflict: 'session_id,client_id' }).select('id,client_id');
  if (error) return { ok: false, error: 'Jucătorii nu au putut fi salvați.' };
  const ids = Object.fromEntries(data.map((r) => [r.client_id, r.id]));
  const ans = (Array.isArray(answers) ? answers : [])
    .filter((a) => ids[a?.clientId])
    .slice(0, 300)
    .map((a) => ({
      session_id: sessionId,
      player_id: ids[a.clientId],
      question_index: int(qIndex, 0, 1000),
      answer: a.value && typeof a.value === 'object' && JSON.stringify(a.value).length < 2000 ? a.value : null,
      is_correct: a.isCorrect === null ? null : !!a.isCorrect,
      points: int(a.points, 0, 100000),
      time_ms: int(a.timeMs, 0, 3600000),
    }));
  if (ans.length) {
    const { error: e2 } = await supabase.from('session_answers').upsert(ans, { onConflict: 'player_id,question_index' });
    if (e2) return { ok: false, error: 'Răspunsurile nu au putut fi salvate.' };
  }
  await supabase.from('game_sessions').update({ player_count: rows.length }).eq('id', sessionId);
  return { ok: true };
}

export async function finishSession({ sessionId, ranking, playerCount, avgAccuracy }) {
  const { supabase, user } = await requireUser();
  if (!user || !(await ownSession(supabase, user.id, sessionId))) return { ok: false, error: 'Acces refuzat.' };
  const order = (Array.isArray(ranking) ? ranking : []).filter((c) => CLIENT.test(c)).slice(0, 300);
  await Promise.all(order.map((clientId, i) => supabase.from('session_players').update({ rank: i + 1 }).eq('session_id', sessionId).eq('client_id', clientId)));
  const avg = avgAccuracy === null || avgAccuracy === undefined ? null : Math.round(Math.min(100, Math.max(0, Number(avgAccuracy))) * 10) / 10;
  const { error } = await supabase.from('game_sessions').update({
    status: 'finished', ended_at: new Date().toISOString(), player_count: int(playerCount, 0, 300), avg_accuracy: avg,
  }).eq('id', sessionId);
  return error ? { ok: false, error: 'Rezultatele finale nu au putut fi salvate.' } : { ok: true };
}

export async function deleteSession(sessionId) {
  const { supabase, user } = await requireUser();
  if (!user || !(await ownSession(supabase, user.id, sessionId))) return { ok: false, error: 'Acces refuzat.' };
  const { error } = await supabase.from('game_sessions').delete().eq('id', sessionId);
  return error ? { ok: false, error: 'Raportul nu a putut fi șters.' } : { ok: true };
}
