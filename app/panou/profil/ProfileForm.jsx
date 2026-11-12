'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateProfile, changePassword } from '@/app/actions/auth';

export default function ProfileForm({ email, profile }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState(profile.full_name);
  const [inst, setInst] = useState(profile.institution);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(params.get('parola') ? { ok: true, t: 'Alegeți acum parola nouă.' } : null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const r = await updateProfile({ fullName: name, institution: inst });
    setBusy(false);
    setMsg(r.ok ? { ok: true, t: 'Profilul a fost salvat.' } : { ok: false, t: r.error });
    router.refresh();
  }

  async function changePw(e) {
    e.preventDefault();
    if (pw.length < 8) return setPwMsg({ ok: false, t: 'Parola trebuie să aibă cel puțin 8 caractere.' });
    const r = await changePassword({ password: pw });
    setPwMsg(r.ok ? { ok: true, t: 'Parola a fost schimbată.' } : { ok: false, t: r.error });
    if (r.ok) setPw('');
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel stack" onSubmit={save}>
        <h2>Date generale</h2>
        <div className="field"><label htmlFor="em">Email</label><input id="em" className="input" value={email} disabled /></div>
        <div className="field"><label htmlFor="nm">Numele și prenumele</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div className="field"><label htmlFor="in">Instituția de învățământ</label><input id="in" className="input" value={inst} onChange={(e) => setInst(e.target.value)} maxLength={200} /></div>
        {msg && <p className={`alert ${msg.ok ? 'alert-ok' : 'alert-bad'}`} role="status">{msg.t}</p>}
        <div><button className="btn btn-primary" disabled={busy}>Salvează</button></div>
      </form>
      <form className="panel stack" onSubmit={changePw}>
        <h2>Parola</h2>
        <div className="field"><label htmlFor="pw">Parola nouă</label><input id="pw" type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {pwMsg && <p className={`alert ${pwMsg.ok ? 'alert-ok' : 'alert-bad'}`} role="status">{pwMsg.t}</p>}
        <div><button className="btn">Schimbă parola</button></div>
      </form>
    </div>
  );
}
