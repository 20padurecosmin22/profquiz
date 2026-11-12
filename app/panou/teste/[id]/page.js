import { notFound } from 'next/navigation';
import { currentTeacher } from '@/lib/supabase/server';
import Editor from './Editor';

export const metadata = { title: 'Editorul de teste' };

export default async function EditQuizPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await currentTeacher();
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
  if (!quiz || quiz.owner_id !== user.id) notFound();
  const { data: questions } = await supabase.from('questions').select('*').eq('quiz_id', id).order('position');
  return <Editor initialQuiz={quiz} initialQuestions={questions || []} userId={user.id} isNew={sp?.nou === '1'} />;
}
