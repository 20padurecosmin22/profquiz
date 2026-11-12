import Link from 'next/link';

export function LogoMark({ size = 34 }) {
  const id = `pqg${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A995FF" />
          <stop offset="0.5" stopColor="#8057F4" />
          <stop offset="1" stopColor="#286BFF" />
        </linearGradient>
      </defs>
      <polygon points="20,2 25,15 20,20" fill={`url(#${id})`} />
      <polygon points="20,2 15,15 20,20" fill="#A995FF" />
      <polygon points="38,20 25,15 20,20" fill="#5632B8" />
      <polygon points="38,20 25,25 20,20" fill={`url(#${id})`} />
      <polygon points="20,38 25,25 20,20" fill="#286BFF" />
      <polygon points="20,38 15,25 20,20" fill={`url(#${id})`} />
      <polygon points="2,20 15,25 20,20" fill="#8057F4" />
      <polygon points="2,20 15,15 20,20" fill="#E879E8" />
    </svg>
  );
}

export default function Logo({ href = '/', light = false, size = 34 }) {
  return (
    <Link href={href} className={`logo ${light ? 'logo-light' : ''}`} aria-label="ProfQuiz, pagina principală">
      <LogoMark size={size} />
      <span>Prof<b>Quiz</b></span>
    </Link>
  );
}
