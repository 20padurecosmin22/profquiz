import { Suspense } from 'react';
import AuthForm from './AuthForm';
import Logo from '@/components/Logo';
import GeoArt from '@/components/GeoArt';

export const metadata = { title: 'Autentificare' };

export default function AuthPage() {
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Logo light />
        <div className="hero-art"><GeoArt /></div>
        <div>
          <h2>Lecții în care toată clasa ridică mâna</h2>
          <p>Creați teste interactive, jucați-le live și urmăriți progresul elevilor. Gratuit, în limba română.</p>
        </div>
        <p className="small">Elevii nu au nevoie de cont: intră în joc doar cu PIN-ul de pe tablă.</p>
      </aside>
      <main className="auth-form">
        <Suspense>
          <AuthForm />
        </Suspense>
      </main>
    </div>
  );
}
