// Signature background element: a static holographic ARENA (tiered seats
// + court markings) per sport. The arena itself never moves — instead the
// outer .arena-orbit wrapper (the "camera") glides around it in 3D, and
// two independent spotlight beams sweep across the seat rows the whole
// time. After each camera pass, the arena crossfades to the next sport.
// Purely decorative — inert to clicks (pointer-events disabled in CSS).
function Seats({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="50%" cy="52%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="250" cy="260" rx="245" ry="165" fill={`url(#${id})`} />
      <ellipse cx="250" cy="260" rx="230" ry="150" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray="5 5" opacity="0.3" />
      <ellipse cx="250" cy="260" rx="200" ry="129" fill="none" stroke="currentColor" strokeWidth="9" strokeDasharray="5 5" opacity="0.38" />
      <ellipse cx="250" cy="260" rx="170" ry="109" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="4 5" opacity="0.46" />
      <ellipse cx="250" cy="260" rx="140" ry="90" fill="none" stroke="currentColor" strokeWidth="7" strokeDasharray="4 5" opacity="0.54" />
    </>
  );
}

function Beams() {
  return (
    <>
      <div className="arena-beam arena-beam--a" />
      <div className="arena-beam arena-beam--b" />
    </>
  );
}

export default function ArenaHologram() {
  return (
    <div className="hologram-stage" aria-hidden="true">
      <div className="arena-orbit">
        <div className="arena-scene arena-scene--basketball">
          <svg viewBox="0 0 500 500" fill="none" stroke="currentColor" strokeWidth="2">
            <Seats id="glow-bball" />
            <g transform="translate(125,185) scale(0.5)">
              <rect x="10" y="10" width="480" height="280" />
              <line x1="250" y1="10" x2="250" y2="290" />
              <circle cx="250" cy="150" r="45" />
              <rect x="10" y="75" width="120" height="150" />
              <circle cx="130" cy="150" r="45" />
              <rect x="370" y="75" width="120" height="150" />
              <circle cx="370" cy="150" r="45" />
              <path d="M10,40 A170,170 0 0,1 10,260" />
              <path d="M490,40 A170,170 0 0,0 490,260" />
            </g>
          </svg>
          <Beams />
        </div>

        <div className="arena-scene arena-scene--football">
          <svg viewBox="0 0 500 500" fill="none" stroke="currentColor" strokeWidth="2">
            <Seats id="glow-football" />
            <g transform="translate(135,185.25) scale(0.46)">
              <rect x="10" y="10" width="480" height="305" />
              <line x1="250" y1="10" x2="250" y2="315" />
              <circle cx="250" cy="162" r="50" />
              <circle cx="250" cy="162" r="2.5" fill="currentColor" />
              <rect x="10" y="87" width="90" height="150" />
              <rect x="10" y="127" width="35" height="70" />
              <rect x="400" y="87" width="90" height="150" />
              <rect x="455" y="127" width="35" height="70" />
            </g>
          </svg>
          <Beams />
        </div>

        <div className="arena-scene arena-scene--volleyball">
          <svg viewBox="0 0 500 500" fill="none" stroke="currentColor" strokeWidth="2">
            <Seats id="glow-volleyball" />
            <g transform="translate(125,197.5) scale(0.5)">
              <rect x="10" y="10" width="480" height="230" />
              <line x1="250" y1="10" x2="250" y2="240" strokeDasharray="6 6" />
              <line x1="167" y1="10" x2="167" y2="240" strokeDasharray="4 8" opacity="0.6" />
              <line x1="333" y1="10" x2="333" y2="240" strokeDasharray="4 8" opacity="0.6" />
            </g>
          </svg>
          <Beams />
        </div>
      </div>
    </div>
  );
}