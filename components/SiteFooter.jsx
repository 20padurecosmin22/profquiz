import Link from 'next/link';
import Logo from './Logo';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="cols">
          <div>
            <Logo light />
            <p style={{ marginTop: 16, maxWidth: '36ch' }}>
              Teste interactive gratuite pentru școlile, liceele, colegiile și universitățile din Republica Moldova.
            </p>
          </div>
          <div>
            <h4>Platforma</h4>
            <ul>
              <li><Link href="/#cum-functioneaza">Cum funcționează</Link></li>
              <li><Link href="/#tipuri">Tipuri de întrebări</Link></li>
              <li><Link href="/biblioteca">Biblioteca de teste</Link></li>
            </ul>
          </div>
          <div>
            <h4>Profesori</h4>
            <ul>
              <li><Link href="/autentificare?mod=inregistrare">Creează cont gratuit</Link></li>
              <li><Link href="/autentificare">Autentificare</Link></li>
              <li><Link href="/panou">Panoul meu</Link></li>
            </ul>
          </div>
          <div>
            <h4>Elevi</h4>
            <ul>
              <li><Link href="/joc">Intră în joc cu PIN</Link></li>
              <li><Link href="/#intrebari">Întrebări frecvente</Link></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {year} ProfQuiz. Platformă educațională gratuită.</span>
          <span>Făcut în Republica Moldova</span>
        </div>
      </div>
    </footer>
  );
}
