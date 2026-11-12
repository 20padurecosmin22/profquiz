import { notFound } from 'next/navigation';
import { currentTeacher, realtimeConfig } from '@/lib/supabase/server';
import { problemsOf } from '@/lib/questions';
import Board from './Board';

export const metadata = { title: 'Joc live' };

export default async function LivePage({ params }) {
  const { id } = await params;
  const { supabase, user } = await currentTeacher();
  const { data: quiz } = await supabase.from('quizzes').select('id,title,owner_id').eq('id', id).maybeSingle();
  if (!quiz) notFound();
  const { data: questions } = await supabase
    .from('questions')
    .select('id,type,text,image_url,time_limit,points,options')
    .eq('quiz_id', id)
    .order('position');
  const playable = (questions || []).filter((q) => problemsOf({ ...q, options: q.options || [] }).length === 0);
  return (
    <Board
      quiz={{ id: quiz.id, title: quiz.title }}
      questions={playable}
      skipped={(questions || []).length - playable.length}
      isOwner={quiz.owner_id === user.id}
      rt={realtimeConfig()}
    />
  );
}
