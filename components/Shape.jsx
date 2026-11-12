
export const OPTION_STYLES = [
  { letter: 'A', name: 'triunghi', cls: 'opt-0' },
  { letter: 'B', name: 'hexagon', cls: 'opt-1' },
  { letter: 'C', name: 'stea', cls: 'opt-2' },
  { letter: 'D', name: 'pentagon', cls: 'opt-3' },
  { letter: 'E', name: 'cruce', cls: 'opt-4' },
  { letter: 'F', name: 'inel', cls: 'opt-5' },
];

export function Shape({ index, size = 28 }) {
  const p = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true, fill: 'currentColor' };
  switch (index % 6) {
    case 0:
      return <svg {...p}><polygon points="16,3 30,28 2,28" /></svg>;
    case 1:
      return <svg {...p}><polygon points="9,3 23,3 30,16 23,29 9,29 2,16" /></svg>;
    case 2:
      return <svg {...p}><polygon points="16,1 20,12 31,16 20,20 16,31 12,20 1,16 12,12" /></svg>;
    case 3:
      return <svg {...p}><polygon points="16,2 30,12.5 24.7,29 7.3,29 2,12.5" /></svg>;
    case 4:
      return <svg {...p}><polygon points="11,2 21,2 21,11 30,11 30,21 21,21 21,30 11,30 11,21 2,21 2,11 11,11" /></svg>;
    default:
      return <svg {...p}><path fillRule="evenodd" d="M16 2a14 14 0 1 1 0 28a14 14 0 1 1 0-28zm0 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14z" /></svg>;
  }
}
