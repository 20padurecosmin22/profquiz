'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPanel() {
  const [pin, setPin] = useState('');
  const router = useRouter();
  return (
    <div className="join-panel">
      <h2>Ai primit un PIN?</h2>
      <p>Introdu cele 6 cifre afișate pe tablă și intră în joc. Nu ai nevoie de cont.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(pin.length === 6 ? `/joc?pin=${pin}` : '/joc');
        }}
      >
        <label htmlFor="hero-pin" className="sr-only">PIN-ul jocului</label>
        <input
          id="hero-pin"
          className="input"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button className="btn btn-primary btn-lg" type="submit">Intră</button>
      </form>
    </div>
  );
}
