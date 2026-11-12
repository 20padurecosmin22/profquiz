'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createQuiz, copyQuiz, deleteQuiz } from '@/app/actions/quizzes';
import { Icon } from '@/components/Icons';

export function NewQuizButton({ className = 'btn btn-primary' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const r = await createQuiz();
    if (!r.ok) {
      setBusy(false);
      alert(r.error);
      return;
    }
    router.push(`/panou/teste/${r.id}?nou=1`);
  }
  return (
    <button className={className} onClick={create} disabled={busy}>
      {Icon.plus(18)} {busy ? 'Se creează...' : 'Test nou'}
    </button>
  );
}

export function QuizCardActions({ quiz }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    const r = await copyQuiz(quiz.id);
    setBusy(false);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Ștergeți testul „${quiz.title}”? Rapoartele jocurilor deja desfășurate rămân.`)) return;
    setBusy(true);
    const r = await deleteQuiz(quiz.id);
    setBusy(false);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  return (
    <div className="quiz-actions">
      {quiz.question_count > 0 ? (
        <Link href={`/live/${quiz.id}`} className="btn btn-primary btn-sm">{Icon.play(16)} Joacă live</Link>
      ) : (
        <span className="btn btn-primary btn-sm" aria-disabled="true" title="Adăugați întâi întrebări">{Icon.play(16)} Joacă live</span>
      )}
      <Link href={`/panou/teste/${quiz.id}`} className="btn btn-sm">{Icon.edit(16)} Editează</Link>
      <button className="btn btn-sm btn-icon" onClick={duplicate} disabled={busy} title="Duplică" aria-label={`Duplică testul ${quiz.title}`}>{Icon.copy(16)}</button>
      <button className="btn btn-sm btn-icon btn-danger" onClick={remove} disabled={busy} title="Șterge" aria-label={`Șterge testul ${quiz.title}`}>{Icon.trash(16)}</button>
    </div>
  );
}
