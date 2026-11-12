import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import GeoArt from '@/components/GeoArt';
import JoinPanel from '@/components/JoinPanel';
import QuizCard from '@/components/QuizCard';
import { Shape } from '@/components/Shape';
import { Icon } from '@/components/Icons';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TYPES = [
  ['Alegere unică', 'Clasica întrebare cu 2-6 variante și un singur răspuns corect.'],
  ['Alegere multiplă', 'Mai multe variante corecte. Elevul le bifează pe toate.'],
  ['Adevărat sau fals', 'O afirmație rapidă, ideală pentru verificarea la început de lecție.'],
  ['Răspuns scris', 'Elevul scrie răspunsul. Literele mari și diacriticele nu contează.'],
  ['Ordonare', 'Etapele unui proces, evenimente istorice sau pașii unui algoritm, puse în ordine.'],
  ['Sondaj', 'Fără răspuns corect: aflați opinia clasei sau cât de clară a fost tema.'],
];

const FAQ = [
  ['Este ProfQuiz cu adevărat gratuit?', 'Da. Crearea testelor, jocurile live, rapoartele și biblioteca sunt gratuite pentru profesori și pentru elevi.'],
  ['Elevii au nevoie de cont?', 'Nu. Elevul deschide pagina de joc pe telefon, introduce PIN-ul afișat pe tablă și își scrie numele.'],
  ['Câți elevi pot juca în același timp?', 'O clasă obișnuită sau o grupă întreagă de studenți, de pe telefoane, tablete sau calculatoare, cu orice browser modern.'],
  ['Pot folosi testele pe care le am deja în Excel?', 'Da. Descărcați șablonul din editor sau încărcați direct un fișier .xlsx ori .csv, inclusiv cele exportate pentru Kahoot. Întrebările apar în test într-un singur pas.'],
  ['Unde văd rezultatele?', 'După fiecare joc, în secțiunea Rapoarte: punctajul fiecărui elev, procentul de răspunsuri corecte la fiecare întrebare și întrebările care au pus cele mai multe probleme. Totul se descarcă în Excel.'],
  ['Pot folosi testele altor profesori?', 'Da. Testele publicate în bibliotecă pot fi jucate direct sau copiate în contul dumneavoastră și adaptate pentru clasa proprie.'],
];

export default async function Home() {
  const supabase = await supabaseServer();
  const [{ data: auth }, { data: latest }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('quizzes')
      .select('id,title,subject,grade_level,cover_url,question_count,plays_count,copies_count,profiles(full_name,institution)')
      .eq('visibility', 'public')
      .gt('question_count', 0)
      .order('plays_count', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);
  const loggedIn = !!auth?.user;

  return (
    <>
      <a href="#continut" className="skip">Salt la conținut</a>
      <SiteHeader dark loggedIn={loggedIn} />
      <main id="continut">
        <section className="hero">
          <div className="hero-art"><GeoArt /></div>
          <div className="container">
            <div className="grid">
              <div>
                <span className="eyebrow">Gratuit pentru profesorii din Moldova</span>
                <h1>Teste <span className="grad-text">interactive</span> pentru fiecare lecție</h1>
                <p className="lead">
                  Creați un test cu imagini în câteva minute, jucați-l live la clasă de pe orice telefon
                  și vedeți imediat ce au înțeles elevii și unde mai e nevoie de explicații.
                </p>
                <div className="ctas">
                  <Link href={loggedIn ? '/panou' : '/autentificare?mod=inregistrare'} className="btn btn-primary btn-lg">
                    {loggedIn ? 'Mergi la panou' : 'Creează un test gratuit'} {Icon.arrow(18)}
                  </Link>
                  <Link href="/biblioteca" className="btn btn-light btn-lg">Vezi biblioteca</Link>
                </div>
              </div>
              <JoinPanel />
            </div>
            <div className="stats">
              <div className="stat"><b>6</b><span>tipuri de întrebări</span></div>
              <div className="stat"><b>0 lei</b><span>pentru profesori și elevi</span></div>
              <div className="stat"><b>0</b><span>conturi necesare pentru elevi</span></div>
              <div className="stat"><b>1 clic</b><span>până la raportul în Excel</span></div>
            </div>
          </div>
        </section>

        <section className="section" id="despre">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Despre platformă</span>
              <h2>Tot ce vă trebuie pentru o evaluare care chiar implică elevii</h2>
              <p>ProfQuiz îmbină jocul cu evaluarea formativă: elevii răspund cu plăcere, iar profesorul primește date clare despre fiecare temă.</p>
            </div>
            <div className="info-grid">
              <div className="info">
                <div className="ico">{Icon.edit(24)}</div>
                <h3>Creați ușor</h3>
                <p>Editor simplu, cu șase tipuri de întrebări, imagini, timp și punctaj pentru fiecare întrebare. Importați întrebările din Excel dintr-un singur pas.</p>
              </div>
              <div className="info">
                <div className="ico">{Icon.bolt(24)}</div>
                <h3>Jucați live</h3>
                <p>Întrebarea apare pe tablă, elevii răspund de pe telefon. Punctaj pentru viteză, clasament după fiecare întrebare și podium la final.</p>
              </div>
              <div className="info">
                <div className="ico">{Icon.chart(24)}</div>
                <h3>Monitorizați simplu</h3>
                <p>Fiecare joc se salvează automat. Vedeți rezultatul fiecărui elev și întrebările dificile, apoi descărcați totul în Excel.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt" id="cum-functioneaza">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Cum funcționează</span>
              <h2>De la idee la joc în patru pași</h2>
              <p>Nu trebuie instalat nimic. E nevoie doar de un proiector sau un ecran mare și de telefoanele elevilor.</p>
            </div>
            <ol className="timeline">
              <li><span className="when">2 minute</span><h3>Creați contul</h3><p>Înregistrare gratuită cu adresa de email. Fără card și fără abonament.</p></li>
              <li><span className="when">10 minute</span><h3>Scrieți testul</h3><p>Adăugați întrebări, imagini și variante sau importați-le dintr-un fișier Excel.</p></li>
              <li><span className="when">La lecție</span><h3>Porniți jocul</h3><p>Pe tablă apar PIN-ul și codul QR. Elevii intră de pe telefon cu numele lor.</p></li>
              <li><span className="when">După lecție</span><h3>Analizați rezultatele</h3><p>Raportul arată fiecare elev și fiecare întrebare. Îl descărcați în Excel pentru catalog.</p></li>
            </ol>
          </div>
        </section>

        <section className="section" id="tipuri">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Tipuri de întrebări</span>
              <h2>Șase moduri de a verifica ce știu elevii</h2>
              <p>Fiecare întrebare poate avea imagine, timp propriu (5-240 de secunde) și punctaj standard, dublu sau fără puncte.</p>
            </div>
            <div className="cat-grid">
              {TYPES.map(([t, d], i) => (
                <div className="cat" key={t}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="beneficii">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">De ce ProfQuiz</span>
              <h2>Gândit pentru clasele din Republica Moldova</h2>
            </div>
            <div className="benefit-grid">
              <div className="benefit">
                <span className="big">01</span>
                <div className="art"><Shape index={0} size={44} /></div>
                <h3>În limba română, gratuit</h3>
                <p>Interfață complet în română, fără limite ascunse și fără reclame pentru elevi.</p>
              </div>
              <div className="benefit">
                <span className="big">02</span>
                <div className="art" style={{ color: '#286BFF' }}><Shape index={1} size={44} /></div>
                <h3>Merge pe orice telefon</h3>
                <p>Elevii intră din browser, fără aplicații de instalat. Dacă pagina se reîncarcă, revin în joc cu același punctaj.</p>
              </div>
              <div className="benefit">
                <span className="big">03</span>
                <div className="art" style={{ color: '#B8338E' }}><Shape index={2} size={44} /></div>
                <h3>Accesibil pentru toți</h3>
                <p>Fiecare variantă are culoare, formă și literă, așa că poate fi recunoscută și de elevii care nu deosebesc culorile.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section dark" id="institutii">
          <div className="container editorial">
            <div>
              <span className="eyebrow">Pentru instituții de învățământ</span>
              <h2>O singură platformă pentru toată catedra</h2>
              <p>
                Școlile, liceele, colegiile și universitățile pot folosi ProfQuiz fără costuri. Profesorii își construiesc
                testele, le publică pentru colegi și reutilizează materialele bune de la un an la altul.
              </p>
              <ul className="checks">
                <li>Bibliotecă comună: testele publicate pot fi copiate și adaptate de colegi</li>
                <li>Rapoarte pe fiecare joc, cu export în Excel pentru catalog sau pentru comisia metodică</li>
                <li>Date găzduite în Uniunea Europeană; elevii nu își creează conturi și nu lasă date personale</li>
              </ul>
              <Link href="/autentificare?mod=inregistrare" className="btn btn-primary btn-lg">Începeți acum</Link>
            </div>
            <div className="mock" aria-hidden>
              <div className="mq">Care este capitala Republicii Moldova?</div>
              <div className="mo">
                {['Bălți', 'Chișinău', 'Cahul', 'Orhei'].map((a, i) => (
                  <div key={a} className={`opt opt-${i}`}><Shape index={i} size={22} /><span>{a}</span>{i === 1 && <span className="tick">{Icon.check(20)}</span>}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {latest && latest.length > 0 && (
          <section className="section" id="biblioteca">
            <div className="container">
              <div className="page-head">
                <div className="section-head" style={{ marginBottom: 0 }}>
                  <span className="eyebrow">Biblioteca</span>
                  <h2>Teste create de colegi</h2>
                </div>
                <Link href="/biblioteca" className="btn">Toate testele {Icon.arrow(18)}</Link>
              </div>
              <div className="quiz-grid">{latest.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
            </div>
          </section>
        )}

        <section className={`section ${latest && latest.length > 0 ? 'alt' : ''}`} id="intrebari">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Întrebări frecvente</span>
              <h2>Ce întreabă de obicei profesorii</h2>
            </div>
            <div className="faq">
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band">
              <div>
                <h2>Primul test, gata până la următoarea lecție</h2>
                <p>Creați contul gratuit și jucați primul test cu elevii chiar astăzi.</p>
              </div>
              <Link href={loggedIn ? '/panou' : '/autentificare?mod=inregistrare'} className="btn btn-lg" style={{ background: '#fff', color: 'var(--ink)' }}>
                {loggedIn ? 'Mergi la panou' : 'Creează cont gratuit'}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
