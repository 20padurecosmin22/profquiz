'use server';

import { supabaseServer, siteOrigin } from '@/lib/supabase/server';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/panou');

function translate(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Emailul sau parola nu sunt corecte.';
  if (m.includes('email not confirmed')) return 'Adresa de email nu a fost confirmată încă. Verificați căsuța poștală, inclusiv dosarul Spam.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Există deja un cont cu acest email. Folosiți fila Autentificare.';
  if (m.includes('password should be') || m.includes('at least')) return 'Parola trebuie să aibă cel puțin 8 caractere.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Prea multe încercări într-un timp scurt. Reîncercați peste câteva minute.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Adresa de email nu este validă.';
  if (m.includes('error sending')) return 'Emailul nu a putut fi trimis. Reîncercați mai târziu.';
  return 'Operația nu a reușit. Reîncercați.';
}

export async function signIn({ email, password }) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: str(email, 200), password: String(password ?? '').slice(0, 200) });
  return error ? { ok: false, error: translate(error.message) } : { ok: true };
}

export async function signUp({ email, password, fullName, institution, next }) {
  const name = str(fullName, 120);
  const pw = String(password ?? '');
  if (name.length < 3) return { ok: false, error: 'Scrieți numele și prenumele. Ele apar pe testele publicate.' };
  if (pw.length < 8 || pw.length > 200) return { ok: false, error: 'Parola trebuie să aibă cel puțin 8 caractere.' };
  const supabase = await supabaseServer();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: str(email, 200),
    password: pw,
    options: {
      data: { full_name: name, institution: str(institution, 200) },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error) return { ok: false, error: translate(error.message) };
  if (data.session) return { ok: true, session: true };
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'Există deja un cont cu acest email. Folosiți fila Autentificare.' };
  }
  return { ok: true, session: false };
}

export async function requestPasswordReset({ email }) {
  const supabase = await supabaseServer();
  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(str(email, 200), { redirectTo: `${origin}/auth/callback?next=/panou/profil?parola=1` });
  return { ok: true };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return { ok: true };
}

export async function updateProfile({ fullName, institution }) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };
  const { error } = await supabase.from('profiles').update({ full_name: str(fullName, 120), institution: str(institution, 200) }).eq('id', auth.user.id);
  return error ? { ok: false, error: 'Profilul nu a putut fi salvat.' } : { ok: true };
}

export async function changePassword({ password }) {
  const pw = String(password ?? '');
  if (pw.length < 8 || pw.length > 200) return { ok: false, error: 'Parola trebuie să aibă cel puțin 8 caractere.' };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };
  const { error } = await supabase.auth.updateUser({ password: pw });
  return error ? { ok: false, error: translate(error.message) } : { ok: true };
}
