import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Lipsesc variabilele SUPABASE_URL și SUPABASE_PUBLISHABLE_KEY.');
  return { url, key };
}

export const cookieDefaults = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };

export async function supabaseServer() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, ...cookieDefaults }));
        } catch {}
      },
    },
  });
}

export async function currentTeacher() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return { supabase, user: data.user, profile };
}

export async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host && host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function realtimeConfig() {
  const { url, key } = supabaseEnv();
  return { url, key };
}
