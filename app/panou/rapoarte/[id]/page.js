import { notFound } from 'next/navigation';
import { currentTeacher } from '@/lib/supabase/server';
import Report from './Report';

export const metadata = { title: 'Raportul jocului' };

export default async function ReportPage({ params }) {
  const { id } = await params;
  const { supabase, user } = await currentTeacher();
  const { data: session } = await supabase.from('game_sessions').select('*').eq('id', id).maybeSingle();
  if (!session || session.host_id !== user.id) notFound();
  const [{ data: players }, { data: answers }] = await Promise.all([
    supabase.from('session_players').select('id,name,score,correct_count,answered_count,rank,joined_at').eq('session_id', id).order('score', { ascending: false }),
    supabase.from('session_answers').select('player_id,question_index,answer,is_correct,points,time_ms').eq('session_id', id).limit(20000),
  ]);
  return <Report session={session} players={players || []} answers={answers || []} />;
}
