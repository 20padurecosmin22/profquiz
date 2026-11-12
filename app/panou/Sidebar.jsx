'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { Icon } from '@/components/Icons';
import { signOut } from '@/app/actions/auth';

const LINKS = [
  ['/panou', 'Testele mele', Icon.home],
  ['/panou/rapoarte', 'Rapoarte', Icon.chart],
  ['/biblioteca', 'Biblioteca publică', Icon.book],
  ['/panou/profil', 'Profilul meu', Icon.user],
];

export default function Sidebar({ name, institution }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await signOut();
    router.replace('/');
    router.refresh();
  }

  const isActive = (href) => (href === '/panou' ? path === '/panou' || path.startsWith('/panou/teste') : path.startsWith(href));

  return (
    <>
      <div className="app-top">
        <Logo light href="/panou" size={30} />
        <button className="btn btn-icon btn-light" aria-label="Meniu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? Icon.x(20) : Icon.menu()}</button>
      </div>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Meniul profesorului">
        <Logo light href="/panou" />
        <nav style={{ display: 'grid', gap: 4 }}>
          {LINKS.map(([href, label, ico]) => (
            <Link key={href} href={href} className={`side-link ${isActive(href) ? 'active' : ''}`} aria-current={isActive(href) ? 'page' : undefined} onClick={() => setOpen(false)}>
              {ico(20)}{label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <b>{name || 'Profesor'}</b>
          {institution && <span>{institution}</span>}
          <div><button onClick={logout}>Ieșire din cont</button></div>
        </div>
      </aside>
    </>
  );
}
