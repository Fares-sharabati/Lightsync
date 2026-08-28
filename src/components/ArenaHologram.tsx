// Ambient background signature element: a 3D ring holding three courts
// (basketball, football, volleyball) 120° apart. The ring spins a full
// 360° continuously, physically carrying each court around and past the
// camera, fading in as it approaches and out as it swings away — so the
// hologram is always rotating and always mid-transition between sports.
// Purely decorative — inert to clicks (pointer-events disabled in CSS)
// and safe to drop into any page.
export default function ArenaHologram() {
    return (
      <div className="hologram-stage" aria-hidden="true">
        <div className="hologram-tilt">
          <div className="hologram-ring">
            <div className="hologram-court hologram-court--basketball">
              <svg viewBox="0 0 500 300" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="10" y="10" width="480" height="280" />
                <line x1="250" y1="10" x2="250" y2="290" />
                <circle cx="250" cy="150" r="45" />
                <rect x="10" y="75" width="120" height="150" />
                <circle cx="130" cy="150" r="45" />
                <rect x="370" y="75" width="120" height="150" />
                <circle cx="370" cy="150" r="45" />
                <path d="M10,40 A170,170 0 0,1 10,260" />
                <path d="M490,40 A170,170 0 0,0 490,260" />
              </svg>
            </div>
  
            <div className="hologram-court hologram-court--football">
              <svg viewBox="0 0 500 325" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="10" y="10" width="480" height="305" />
                <line x1="250" y1="10" x2="250" y2="315" />
                <circle cx="250" cy="162" r="50" />
                <circle cx="250" cy="162" r="2.5" fill="currentColor" />
                <rect x="10" y="87" width="90" height="150" />
                <rect x="10" y="127" width="35" height="70" />
                <rect x="400" y="87" width="90" height="150" />
                <rect x="455" y="127" width="35" height="70" />
              </svg>
            </div>
  
            <div className="hologram-court hologram-court--volleyball">
              <svg viewBox="0 0 500 250" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="10" y="10" width="480" height="230" />
                <line x1="250" y1="10" x2="250" y2="240" strokeDasharray="6 6" />
                <line x1="167" y1="10" x2="167" y2="240" strokeDasharray="4 8" opacity="0.6" />
                <line x1="333" y1="10" x2="333" y2="240" strokeDasharray="4 8" opacity="0.6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }