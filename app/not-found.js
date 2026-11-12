import Link from 'next/link';
import { LogoMark } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="phone" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <LogoMark size={64} />
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginTop: 20 }}>Pagina nu a fost găsită</h1>
      <p style={{ color: 'rgba(255,255,255,.75)', maxWidth: '44ch' }}>Linkul poate fi greșit, sau testul a fost șters ori nu mai este public.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">Pagina principală</Link>
        <Link href="/joc" className="btn btn-light">Intră în joc</Link>
      </div>
    </main>
  );
}
