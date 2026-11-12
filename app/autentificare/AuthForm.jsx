'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signUp, requestPasswordReset } from '@/app/actions/auth';
import { LogoMark } from '@/components/Logo';

export default function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState(params.get('mod') === 'inregistrare' ? 'register' : params.get('mod') === 'resetare' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('eroare') ? 'Linkul de confirmare nu mai este valabil. Autentificați-vă sau cereți unul nou.' : '');
  const [info, setInfo] = useState('');
  const rawNext = params.get('next') || '';
  const next = /^\/(?![\/\\])[^\s\\]*$/.test(rawNext) && rawNext.length < 300 ? rawNext : '/panou';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await signIn({ email, password });
        if (!r.ok) return setError(r.error);
        router.replace(next);
        router.refresh();
      } else if (mode === 'register') {
        const r = await signUp({ email, password, fullName, institution, next });
        if (!r.ok) return setError(r.error);
        if (r.session) {
          router.replace(next);
          router.refresh();
        } else {
          setInfo(`Contul a fost creat. V-am trimis un email la ${email.trim()}: deschideți linkul din el pentru a confirma adresa.`);
        }
      } else {
        await requestPasswordReset({ email });
        setInfo('Dacă adresa are un cont, veți primi un email cu linkul pentru o parolă nouă.');
      }
    } catch {
      setError('Nu ne-am putut conecta la server. Verificați internetul și reîncercați.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div style={{ marginBottom: 20 }}><Link href="/" aria-label="Pagina principală"><LogoMark size={44} /></Link></div>
      {mode !== 'reset' ? (
        <div className="tabs" role="tablist" aria-label="Tipul formularului">
          <button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>Autentificare</button>
          <button role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError(''); setInfo(''); }}>Cont nou</button>
        </div>
      ) : null}
      <h1>{mode === 'login' ? 'Bine ați revenit' : mode === 'register' ? 'Creați contul de profesor' : 'Resetați parola'}</h1>
      <p className="muted">
        {mode === 'login' ? 'Intrați în cont pentru a crea și juca teste.' : mode === 'register' ? 'Gratuit, durează mai puțin de un minut.' : 'Vă trimitem un link pentru a alege o parolă nouă.'}
      </p>
      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="fn">Numele și prenumele</label>
              <input id="fn" className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="inst">Instituția de învățământ <span className="muted">(opțional)</span></label>
              <input id="inst" className="input" autoComplete="organization" placeholder="de ex. Liceul Teoretic „Ion Creangă”" value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={200} />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="pw">Parola</label>
            <input id="pw" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
            {mode === 'register' && <p className="help">Cel puțin 10 caractere, cu litere și cifre.</p>}
          </div>
        )}
        {error && <p className="alert alert-bad" role="alert">{error}</p>}
        {info && <p className="alert alert-ok" role="status">{info}</p>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Se procesează...' : mode === 'login' ? 'Intră în cont' : mode === 'register' ? 'Creează contul' : 'Trimite linkul'}
        </button>
        {mode === 'login' && <button type="button" className="btn btn-ghost" onClick={() => { setMode('reset'); setError(''); setInfo(''); }}>Am uitat parola</button>}
        {mode === 'reset' && <button type="button" className="btn btn-ghost" onClick={() => { setMode('login'); setError(''); setInfo(''); }}>Înapoi la autentificare</button>}
      </form>
      <p className="help" style={{ marginTop: 24 }}>Sunteți elev? <Link href="/joc">Intrați în joc cu PIN-ul</Link>, fără cont.</p>
    </div>
  );
}
