'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { copyQuiz } from '@/app/actions/quizzes';
import { Icon } from '@/components/Icons';

export default function CopyButton({ quizId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    const r = await copyQuiz(quizId);
    if (!r.ok) {
      setBusy(false);
      alert(r.error);
      return;
    }
    router.push(`/panou/teste/${r.id}`);
  }
  return (
    <button className="btn btn-lg" onClick={copy} disabled={busy}>
      {Icon.copy(18)} {busy ? 'Se copiază...' : 'Copiază în contul meu'}
    </button>
  );
}
