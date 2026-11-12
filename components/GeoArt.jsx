export default function GeoArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 600 600" aria-hidden focusable="false">
      <defs>
        <linearGradient id="ga1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A995FF" />
          <stop offset=".5" stopColor="#8057F4" />
          <stop offset="1" stopColor="#286BFF" />
        </linearGradient>
        <linearGradient id="ga2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E879E8" />
          <stop offset="1" stopColor="#5632B8" />
        </linearGradient>
        <linearGradient id="ga3" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#286BFF" stopOpacity=".2" />
          <stop offset="1" stopColor="#A995FF" stopOpacity=".9" />
        </linearGradient>
      </defs>
      <g>
        <polygon points="300,40 360,250 300,300" fill="url(#ga1)" />
        <polygon points="300,40 240,250 300,300" fill="#A995FF" opacity=".85" />
        <polygon points="560,300 360,250 300,300" fill="#5632B8" />
        <polygon points="560,300 360,350 300,300" fill="url(#ga1)" />
        <polygon points="300,560 360,350 300,300" fill="#286BFF" opacity=".9" />
        <polygon points="300,560 240,350 300,300" fill="url(#ga2)" />
        <polygon points="40,300 240,350 300,300" fill="#8057F4" />
        <polygon points="40,300 240,250 300,300" fill="url(#ga2)" opacity=".9" />
      </g>
      <g fill="url(#ga3)" opacity=".7">
        <polygon points="470,90 520,120 480,150" />
        <polygon points="110,450 160,500 90,510" />
        <polygon points="480,470 540,440 530,510" />
        <polygon points="120,110 170,90 150,150" />
      </g>
      <g stroke="#A995FF" strokeOpacity=".35" strokeWidth="1.2" fill="none">
        <path d="M495,120 L560,300 L505,475 L300,560 L125,480 L40,300 L145,117 L300,40 Z" />
        <circle cx="300" cy="300" r="250" strokeDasharray="3 9" />
      </g>
      <g fill="#fff">
        <circle cx="495" cy="120" r="3" /><circle cx="505" cy="475" r="2.5" /><circle cx="125" cy="480" r="3" /><circle cx="145" cy="117" r="2.5" />
      </g>
    </svg>
  );
}
