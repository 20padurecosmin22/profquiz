import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { QuizCover } from '@/components/QuizCard';
import { OPTION_STYLES } from '@/components/Shape';
import { Icon } from '@/components/Icons';
import { supabaseServer } from '@/lib/supabase/server';
import { TYPES } from '@/lib/questions';
import { mediaUrl } from '@/lib/media';
import CopyButton from './CopyButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('quizzes').select('title,description').eq('id', id).maybeSingle();
  return data ? { title: data.title, description: data.description || 'Test interactiv din biblioteca ProfQuiz.' } : { title: 'Test negăsit' };
}

export default async function LibraryQuiz({ params }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: auth }, { data: quiz }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('quizzes').select('*,profiles(full_name,institution)').eq('id', id).maybeSingle(),
  ]);
  if (!quiz) notFound();
  const user = auth?.user;
  const isOwner = user && user.id === quiz.owner_id;
  if (quiz.visibility !== 'public' && !isOwner) notFound();
  const { data: questions } = await supabase.from('questions').select('id,type,text,image_url,time_limit,options').eq('quiz_id', id).order('position');
  const list = questions || [];
  const minutes = Math.max(1, Math.round(list.reduce((t, q) => t + q.time_limit + 16, 0) / 60));

  return (
    <>
      <SiteHeader loggedIn={!!user} />
      <main className="section" style={{ paddingTop: 40 }}>
        <div className="container" style={{ maxWidth: 1100 }}>
          <Link href="/biblioteca" className="small">Înapoi la bibliotecă</Link>
          <div className="editorial" style={{ gridTemplateColumns: '1.3fr 1fr', marginTop: 16, alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 3rem)' }}>{quiz.title}</h1>
              <div className="quiz-meta" style={{ marginBottom: 14 }}>
                {quiz.subject && <span className="tag">{quiz.subject}</span>}
                {quiz.grade_level && <span className="tag gray">{quiz.grade_level}</span>}
                {quiz.visibility !== 'public' && <span className="tag gray">Privat (doar dumneavoastră îl vedeți)</span>}
              </div>
              {quiz.description && <p className="muted" style={{ fontSize: '1.08rem' }}>{quiz.description}</p>}
              <p className="muted">
                De {quiz.profiles?.full_name || 'un profesor'}{quiz.profiles?.institution ? `, ${quiz.profiles.institution}` : ''} ,
                {' '}{list.length} întrebări, aproximativ {minutes} minute, {quiz.plays_count} jocuri
              </p>
              <div className="row" style={{ marginTop: 20 }}>
                {user ? (
                  <>
                    <Link href={`/live/${quiz.id}`} className="btn btn-primary btn-lg">{Icon.play(18)} Joacă live la clasă</Link>
                    {isOwner ? <Link href={`/panou/teste/${quiz.id}`} className="btn btn-lg">{Icon.edit(18)} Editează</Link> : <CopyButton quizId={quiz.id} />}
                  </>
                ) : (
                  <Link href={`/autentificare?next=/biblioteca/${quiz.id}`} className="btn btn-primary btn-lg">Intrați în cont pentru a-l juca</Link>
                )}
              </div>
            </div>
            <div style={{ borderRadius: 22, overflow: 'hidden' }}><QuizCover quiz={{ ...quiz, question_count: list.length }} /></div>
          </div>

          <h2 style={{ marginTop: 48, fontSize: '1.5rem' }}>Întrebările</h2>
          {!user && <p className="alert alert-info" style={{ marginBottom: 16 }}>Răspunsurile corecte sunt vizibile doar profesorilor autentificați.</p>}
          <div className="stack">
            {list.map((q, i) => (
              <div className="panel" key={q.id}>
                <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{i + 1}. {q.text}</h3>
                  <span className="tag gray" style={{ flex: 'none' }}>{TYPES[q.type]?.label}, {q.time_limit} s</span>
                </div>
                {q.image_url && <img src={mediaUrl(q.image_url)} alt="" style={{ maxHeight: 180, borderRadius: 12, marginTop: 12 }} loading="lazy" />}
                {q.type !== 'text' && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 6 }}>
                    {(q.options || []).map((o, k) => (
                      <li key={k} className="row" style={{ gap: 8 }}>
                        <b style={{ width: 22 }}>{q.type === 'order' ? `${k + 1}.` : OPTION_STYLES[k]?.letter}</b>
                        <span>{o.text}</span>
                        {user && q.type !== 'poll' && q.type !== 'order' && o.correct && <span className="tag ok">corect</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type === 'text' && user && <p style={{ margin: '12px 0 0' }}><b>Răspunsuri acceptate:</b> {(q.options || []).map((o) => o.text).join(' / ')}</p>}
                {q.type === 'order' && user && <p className="help" style={{ marginTop: 8 }}>Elementele sunt afișate în ordinea corectă; elevii le primesc amestecate.</p>}
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
