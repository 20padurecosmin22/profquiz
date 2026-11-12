'use server';

import { supabaseServer, siteOrigin, clientIp } from '@/lib/supabase/server';
import { allow } from '@/lib/ratelimit';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const safeNext = (n) => (typeof n === 'string' && /^\/(?![\/\\])[^\s\\]*$/.test(n) && n.length < 300 ? n : '/panou');
const TOO_MANY = 'Prea multe încercări. Așteptați câteva minute și reîncercați.';

function weakPassword(pw) {
  if (pw.length < 10 || pw.length > 200) return 'Parola trebuie să aibă cel puțin 10 caractere.';
  if (!/[a-zA-ZăâîșțĂÂÎȘȚ]/.test(pw) || !/[0-9]/.test(pw)) return 'Parola trebuie să conțină litere și cifre.';
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|qwertyuiop|parolaparola)/i.test(pw)) return 'Parola este prea ușor de ghicit.';
  return null;
}

function translate(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Emailul sau parola nu sunt corecte.';
  if (m.includes('email not confirmed')) return 'Adresa de email nu a fost confirmată încă. Verificați căsuța poștală, inclusiv dosarul Spam.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Există deja un cont cu acest email. Folosiți fila Autentificare.';
  if (m.includes('password should be') || m.includes('at least') || m.includes('weak')) return 'Parola nu respectă cerințele de siguranță.';
  if (m.includes('same password') || m.includes('different from the old')) return 'Parola nouă trebuie să fie diferită de cea veche.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Prea multe încercări într-un timp scurt. Reîncercați peste câteva minute.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Adresa de email nu este validă.';
  if (m.includes('error sending')) return 'Emailul nu a putut fi trimis. Reîncercați mai târziu.';
  return 'Operația nu a reușit. Reîncercați.';
}

export async function signIn({ email, password }) {
  const ip = await clientIp();
  const mail = str(email, 200).toLowerCase();
  if (!(await allow(`login-ip:${ip}`, 30, 900)) || !(await allow(`login-mail:${mail}`, 8, 900))) return { ok: false, error: TOO_MANY };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: str(email, 200), password: String(password ?? '').slice(0, 200) });
  return error ? { ok: false, error: translate(error.message) } : { ok: true };
}

export async function signUp({ email, password, fullName, institution, next }) {
  const name = str(fullName, 120);
  const pw = String(password ?? '');
  if (name.length < 3) return { ok: false, error: 'Scrieți numele și prenumele. Ele apar pe testele publicate.' };
  const weak = weakPassword(pw);
  if (weak) return { ok: false, error: weak };
  if (!(await allow(`signup-ip:${await clientIp()}`, 5, 3600))) return { ok: false, error: TOO_MANY };
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
  const mail = str(email, 200).toLowerCase();
  if (!(await allow(`reset-ip:${await clientIp()}`, 5, 3600)) || !(await allow(`reset-mail:${mail}`, 3, 3600))) return { ok: true };
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
  const weak = weakPassword(pw);
  if (weak) return { ok: false, error: weak };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Sesiunea a expirat. Autentificați-vă din nou.' };
  if (!(await allow(`pw-user:${auth.user.id}`, 5, 3600))) return { ok: false, error: TOO_MANY };
  const { error } = await supabase.auth.updateUser({ password: pw });
  return error ? { ok: false, error: translate(error.message) } : { ok: true };
}
