import Link from 'next/link';
import { currentTeacher } from '@/lib/supabase/server';
import { QuizCover } from '@/components/QuizCard';
import { Icon } from '@/components/Icons';
import { NewQuizButton, QuizCardActions } from './QuizActions';

export const metadata = { title: 'Testele mele' };

function fmtDate(d) {
  return new Date(d).toLocaleDateString('ro-MD', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function Dashboard() {
  const { supabase, user, profile } = await currentTeacher();
  const [{ data: quizzes }, { data: sessions }] = await Promise.all([
    supabase.from('quizzes').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }),
    supabase
      .from('game_sessions')
      .select('id,title,player_count,avg_accuracy,created_at,status')
      .eq('host_id', user.id)
      .gt('player_count', 0)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  const list = quizzes || [];
  const ses = sessions || [];
  const students = ses.reduce((t, s) => t + (s.player_count || 0), 0);
  const withAcc = ses.filter((s) => s.avg_accuracy !== null);
  const acc = withAcc.length ? Math.round(withAcc.reduce((t, s) => t + Number(s.avg_accuracy), 0) / withAcc.length) : null;
  const firstName = (profile?.full_name || '').split(' ')[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{firstName ? `Bună, ${firstName}!` : 'Testele mele'}</h1>
          <p>Creați un test nou, editați-l pe unul existent sau porniți un joc la clasă.</p>
        </div>
        <NewQuizButton />
      </div>

      <div className="kpis">
        <div className="kpi"><b>{list.length}</b><span>teste create</span></div>
        <div className="kpi"><b>{ses.length}</b><span>jocuri desfășurate</span></div>
        <div className="kpi"><b>{students}</b><span>participări ale elevilor</span></div>
        <div className="kpi"><b>{acc === null ? '-' : `${acc}%`}</b><span>răspunsuri corecte, în medie</span></div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <h2>Încă nu aveți niciun test</h2>
          <p>Începeți cu un test gol, importați întrebările din Excel sau copiați un test din biblioteca publică.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <NewQuizButton />
            <Link href="/biblioteca" className="btn">{Icon.book(18)} Răsfoiți biblioteca</Link>
          </div>
        </div>
      ) : (
        <div className="quiz-grid">
          {list.map((q) => (
            <article className="quiz-card" key={q.id}>
              <Link href={`/panou/teste/${q.id}`} tabIndex={-1} aria-hidden style={{ position: 'relative' }}>
                <QuizCover quiz={q} />
              </Link>
              <div className="quiz-body">
                <h3><Link href={`/panou/teste/${q.id}`}>{q.title}</Link></h3>
                <div className="quiz-meta">
                  <span className={`tag ${q.visibility === 'public' ? '' : 'gray'}`}>{q.visibility === 'public' ? 'Public' : 'Privat'}</span>
                  {q.subject && <span className="tag gray">{q.subject}</span>}
                </div>
                <div className="quiz-meta">
                  <span>Modificat {fmtDate(q.updated_at)}</span>
                  <span>{q.plays_count} jocuri</span>
                </div>
                <QuizCardActions quiz={q} />
              </div>
            </article>
          ))}
        </div>
      )}

      {ses.length > 0 && (
        <div style={{ marginTop: 44 }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Jocuri recente</h2>
            <Link href="/panou/rapoarte" className="btn btn-sm">Toate rapoartele</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Test</th><th>Data</th><th className="num">Elevi</th><th className="num">Corecte</th></tr></thead>
              <tbody>
                {ses.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/panou/rapoarte/${s.id}`}>{s.title}</Link></td>
                    <td>{fmtDate(s.created_at)}</td>
                    <td className="num">{s.player_count}</td>
                    <td className="num">{s.avg_accuracy === null ? '-' : `${Math.round(s.avg_accuracy)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
