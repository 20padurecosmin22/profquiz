'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { Icon } from './Icons';

export default function SiteHeader({ dark = false, loggedIn = false }) {
  const [open, setOpen] = useState(false);
  const links = [
    ['/#cum-functioneaza', 'Cum funcționează'],
    ['/#tipuri', 'Tipuri de întrebări'],
    ['/biblioteca', 'Biblioteca'],
    ['/#institutii', 'Pentru instituții'],
  ];
  return (
    <header className={`site-header ${dark ? 'on-dark' : ''}`}>
      <div className="container">
        <div className="bar">
          <Logo light={dark} />
          <nav className="site-nav" aria-label="Navigare principală">
            {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <div className="actions">
            <Link href="/joc" className={`btn ${dark ? 'btn-light' : ''} hide-sm`}>Intră în joc</Link>
            <Link href={loggedIn ? '/panou' : '/autentificare'} className="btn btn-primary">
              {loggedIn ? 'Panoul meu' : 'Cont profesor'}
            </Link>
            <button
              className={`btn btn-icon menu-btn ${dark ? 'btn-light' : ''}`}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label="Meniu"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? Icon.x(20) : Icon.menu()}
            </button>
          </div>
        </div>
        <nav id="mobile-nav" className={`mobile-nav ${open ? 'open' : ''}`} aria-label="Navigare mobilă" style={dark ? { color: '#fff' } : undefined}>
          {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link href="/joc" onClick={() => setOpen(false)}>Intră în joc cu PIN</Link>
        </nav>
      </div>
    </header>
  );
}
