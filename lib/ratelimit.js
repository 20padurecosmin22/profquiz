import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from './supabase/server';

export async function allow(key, limit, windowSeconds) {
  const admin = supabaseAdmin();
  if (!admin) {
    console.error('SUPABASE_SECRET_KEY lipsește: limitarea încercărilor este dezactivată.');
    return true;
  }
  const hashed = createHash('sha256').update(`${process.env.SUPABASE_SECRET_KEY}|${key}`).digest('hex');
  const { data, error } = await admin.rpc('hit_rate', { p_key: hashed, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error('Limitarea încercărilor nu a putut fi verificată:', error.message);
    return true;
  }
  return data === true;
}
