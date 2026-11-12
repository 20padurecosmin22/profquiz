import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import QuizCard from '@/components/QuizCard';
import { Icon } from '@/components/Icons';
import { supabaseServer } from '@/lib/supabase/server';
import { SUBJECTS, GRADES } from '@/lib/questions';

export const metadata = { title: 'Biblioteca de teste', description: 'Teste interactive publicate de profesori din Republica Moldova, gata de jucat sau de adaptat.' };
export const dynamic = 'force-dynamic';

const PAGE = 24;

export default async function Library({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').slice(0, 80);
  const subject = SUBJECTS.includes(sp?.disciplina) ? sp.disciplina : '';
  const grade = GRADES.includes(sp?.nivel) ? sp.nivel : '';
  const sort = sp?.ordine === 'noi' ? 'noi' : 'populare';
  const page = Math.max(1, Number(sp?.pagina) || 1);

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  let query = supabase
    .from('quizzes')
    .select('id,title,subject,grade_level,cover_url,question_count,plays_count,copies_count,profiles(full_name,institution)', { count: 'exact' })
    .eq('visibility', 'public')
    .gt('question_count', 0);
  const clean = q.replace(/[,()%*\\]/g, ' ').trim();
  if (clean) query = query.or(`title.ilike.%${clean}%,description.ilike.%${clean}%`);
  if (subject) query = query.eq('subject', subject);
  if (grade) query = query.eq('grade_level', grade);
  query = sort === 'noi' ? query.order('updated_at', { ascending: false }) : query.order('plays_count', { ascending: false }).order('copies_count', { ascending: false });
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const list = data || [];
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE));
  const link = (p) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (subject) u.set('disciplina', subject);
    if (grade) u.set('nivel', grade);
    if (sort !== 'populare') u.set('ordine', sort);
    if (p > 1) u.set('pagina', String(p));
    return `/biblioteca${u.toString() ? `?${u}` : ''}`;
  };

  return (
    <>
      <SiteHeader loggedIn={!!auth?.user} />
      <main className="section" style={{ paddingTop: 48 }}>
        <div className="container">
          <div className="section-head" style={{ marginBottom: 28 }}>
            <span className="eyebrow">Biblioteca publică</span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>Teste create de profesori, pentru profesori</h1>
            <p>Jucați un test direct la clasă sau copiați-l în contul dumneavoastră și adaptați-l. Toate sunt gratuite.</p>
          </div>
          <form className="panel row" style={{ marginBottom: 28, alignItems: 'flex-end' }} role="search">
            <div className="field grow" style={{ minWidth: 220 }}>
              <label htmlFor="q">Căutare</label>
              <input id="q" name="q" className="input" defaultValue={q} placeholder="Titlu sau temă, de ex. fracții, Ștefan cel Mare" />
            </div>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="d">Disciplina</label>
              <select id="d" name="disciplina" className="select" defaultValue={subject}>
                <option value="">Toate</option>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="n">Nivelul</label>
              <select id="n" name="nivel" className="select" defaultValue={grade}>
                <option value="">Toate</option>
                {GRADES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field" style={{ minWidth: 150 }}>
              <label htmlFor="o">Ordinea</label>
              <select id="o" name="ordine" className="select" defaultValue={sort}>
                <option value="populare">Cele mai jucate</option>
                <option value="noi">Cele mai noi</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">{Icon.search(18)} Caută</button>
          </form>

          {list.length === 0 ? (
            <div className="empty-state">
              <h2>{q || subject || grade ? 'Niciun test găsit' : 'Biblioteca abia începe'}</h2>
              <p>{q || subject || grade ? 'Încercați alte cuvinte sau alte filtre.' : 'Fiți primul profesor care publică un test: în editor, la Setări, alegeți „Public în bibliotecă”.'}</p>
              <Link href={auth?.user ? '/panou' : '/autentificare?mod=inregistrare'} className="btn btn-primary">{auth?.user ? 'Mergi la testele mele' : 'Creează cont gratuit'}</Link>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 16 }}>{count} {count === 1 ? 'test' : 'teste'}</p>
              <div className="quiz-grid">{list.map((x) => <QuizCard key={x.id} quiz={x} />)}</div>
              {pages > 1 && (
                <nav className="row" style={{ justifyContent: 'center', marginTop: 32 }} aria-label="Paginare">
                  {page > 1 && <Link className="btn btn-sm" href={link(page - 1)}>Pagina anterioară</Link>}
                  <span className="muted">Pagina {page} din {pages}</span>
                  {page < pages && <Link className="btn btn-sm" href={link(page + 1)}>Pagina următoare</Link>}
                </nav>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
