import Link from 'next/link';
import { currentTeacher } from '@/lib/supabase/server';

export const metadata = { title: 'Rapoarte' };

function fmt(d) {
  return new Date(d).toLocaleString('ro-MD', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Chisinau' });
}

export default async function ReportsPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await currentTeacher();
  let query = supabase
    .from('game_sessions')
    .select('id,title,quiz_id,player_count,avg_accuracy,created_at,status,quiz_snapshot')
    .eq('host_id', user.id)
    .gt('player_count', 0)
    .order('created_at', { ascending: false })
    .limit(300);
  if (sp?.test) query = query.eq('quiz_id', sp.test);
  const { data } = await query;
  const list = data || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Rapoarte</h1>
          <p>Fiecare joc live se salvează aici automat, cu rezultatele tuturor elevilor.</p>
        </div>
        {sp?.test && <Link href="/panou/rapoarte" className="btn btn-sm">Toate jocurile</Link>}
      </div>
      {list.length === 0 ? (
        <div className="empty-state">
          <h2>Încă nu aveți rapoarte</h2>
          <p>După primul joc live cu elevii, rezultatele apar aici: punctajul fiecărui elev, întrebările dificile și exportul în Excel.</p>
          <Link href="/panou" className="btn btn-primary">Mergi la testele mele</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Test</th><th>Data</th><th className="num">Întrebări</th><th className="num">Elevi</th><th className="num">Răspunsuri corecte</th><th>Stare</th></tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const acc = s.avg_accuracy === null ? null : Math.round(s.avg_accuracy);
                return (
                  <tr key={s.id}>
                    <td><Link href={`/panou/rapoarte/${s.id}`}>{s.title}</Link></td>
                    <td>{fmt(s.created_at)}</td>
                    <td className="num">{Array.isArray(s.quiz_snapshot) ? s.quiz_snapshot.length : '-'}</td>
                    <td className="num">{s.player_count}</td>
                    <td className="num">{acc === null ? '-' : <span className={`tag ${acc < 50 ? 'bad' : acc < 75 ? 'gray' : 'ok'}`}>{acc}%</span>}</td>
                    <td>{s.status === 'finished' ? <span className="tag ok">Încheiat</span> : s.status === 'running' ? <span className="tag">În desfășurare</span> : <span className="tag gray">Întrerupt</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
