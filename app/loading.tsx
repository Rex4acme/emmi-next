// app/loading.tsx
// This is the boot splash shown by Next.js while the root page.tsx
// is doing the server-side auth check.
// It matches the exact same visual design as splash-client.tsx so
// there is no jarring switch between the two.

export default function Loading() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#09090E',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@500;700&display=swap');

        /* grid */
        .ld-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(245,166,35,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,166,35,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        /* CRT */
        .ld-crt {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.055) 2px, rgba(0,0,0,0.055) 4px
          );
        }
        /* vignette */
        .ld-vig {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 100% 100% at 50% 50%,
            transparent 40%, rgba(0,0,0,0.55) 100%);
        }
        /* glow orb */
        .ld-orb {
          position: absolute;
          width: 480px; height: 480px; border-radius: 50%;
          background: radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%);
          pointer-events: none;
          animation: ld-breathe 4s ease-in-out infinite;
        }
        @keyframes ld-breathe {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.12); opacity: 0.7; }
        }
        /* scanline */
        .ld-scan {
          position: absolute; left: 0; right: 0; height: 160px;
          background: linear-gradient(to bottom,
            transparent,
            rgba(245,166,35,0.035) 35%,
            rgba(245,166,35,0.08)  50%,
            rgba(245,166,35,0.035) 65%,
            transparent);
          animation: ld-scan 5.5s linear infinite;
          pointer-events: none;
        }
        @keyframes ld-scan { 0% { top: -160px; } 100% { top: 100%; } }
        /* corner brackets */
        .ld-corn {
          position: absolute; width: 24px; height: 24px;
          border-color: rgba(245,166,35,0.2); border-style: solid;
        }
        .ld-c1 { top: 18px; left: 18px;    border-width: 1px 0 0 1px; }
        .ld-c2 { top: 18px; right: 18px;   border-width: 1px 1px 0 0; }
        .ld-c3 { bottom: 18px; left: 18px;  border-width: 0 0 1px 1px; }
        .ld-c4 { bottom: 18px; right: 18px; border-width: 0 1px 1px 0; }
        /* bolt pulse */
        @keyframes ld-bolt {
          0%,100% { filter: drop-shadow(0 0 10px rgba(245,166,35,0.6)); }
          50%      { filter: drop-shadow(0 0 28px rgba(245,166,35,1)) drop-shadow(0 0 48px rgba(245,166,35,0.4)); }
        }
        .ld-bolt { animation: ld-bolt 2s ease-in-out infinite; }
        /* ring spin */
        @keyframes ld-spin { to { transform: rotate(360deg); } }
        .ld-ring-spin {
          position: absolute;
          width: 140px; height: 140px; border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: rgba(245,166,35,0.55);
          border-right-color: rgba(245,166,35,0.15);
          animation: ld-spin 2s linear infinite;
        }
        /* pulse rings */
        @keyframes ld-ringpulse {
          0%,100% { opacity: 0.18; transform: scale(1); }
          50%      { opacity: 0.06; transform: scale(1.04); }
        }
        .ld-ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(245,166,35,0.1);
          animation: ld-ringpulse 3.5s ease-in-out infinite;
        }
        /* name */
        @keyframes ld-fadein {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ld-name {
          font-family: 'Rajdhani', sans-serif;
          font-size: 2.1rem; font-weight: 700;
          letter-spacing: 0.22em;
          color: #F5A623;
          text-shadow: 0 0 24px rgba(245,166,35,0.5);
          animation: ld-fadein 0.6s ease 0.3s both;
          margin-bottom: 4px;
        }
        .ld-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.28em;
          color: rgba(245,166,35,0.35);
          text-transform: uppercase;
          animation: ld-fadein 0.6s ease 0.5s both;
          margin-bottom: 28px;
        }
        /* spinner */
        @keyframes ld-sp { to { transform: rotate(360deg); } }
        .ld-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid rgba(245,166,35,0.12);
          border-top-color: #F5A623;
          animation: ld-sp 0.75s linear infinite;
          margin-bottom: 14px;
        }
        .ld-hint {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.12em;
          color: rgba(245,166,35,0.3);
          animation: ld-fadein 0.6s ease 0.7s both;
        }
        /* progress bar */
        @keyframes ld-bar { 0% { width: 0%; } 80% { width: 75%; } 100% { width: 75%; } }
        @keyframes ld-shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        .ld-pbar-wrap {
          width: 220px; height: 2px;
          background: rgba(245,166,35,0.07); border-radius: 1px;
          overflow: hidden; margin-bottom: 8px;
          animation: ld-fadein 0.5s ease 0.6s both;
        }
        .ld-pbar-fill {
          height: 100%;
          background: linear-gradient(90deg, #F5A623 0%, #FFD166 50%, #F5A623 100%);
          background-size: 200% 100%;
          border-radius: 1px;
          animation:
            ld-bar     3s ease-out 0.5s both,
            ld-shimmer 2s linear   0.5s infinite;
          box-shadow: 0 0 8px #F5A623;
        }
      `}</style>

      <div className="ld-orb"/>
      <div className="ld-grid"/>
      <div className="ld-crt"/>
      <div className="ld-vig"/>
      <div className="ld-scan"/>
      <div className="ld-corn ld-c1"/><div className="ld-corn ld-c2"/>
      <div className="ld-corn ld-c3"/><div className="ld-corn ld-c4"/>

      {/* Logo */}
      <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <div className="ld-ring" style={{ width: 172, height: 172 }}/>
        <div className="ld-ring" style={{ width: 148, height: 148, animationDelay: '0.6s' }}/>
        <div className="ld-ring" style={{ width: 124, height: 124, animationDelay: '1.2s' }}/>
        <div className="ld-ring-spin"/>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <svg className="ld-bolt" viewBox="0 0 58 68" fill="none" width={38} height={44}>
            <path d="M34 2L4 38H26L24 66L54 30H32L34 2Z"
              fill="url(#ld-lg)" stroke="rgba(255,215,80,0.22)" strokeWidth="0.75"/>
            <defs>
              <linearGradient id="ld-lg" x1="29" y1="2" x2="29" y2="66" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#FFD166"/>
                <stop offset="100%" stopColor="#F5A623"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div className="ld-name">EMMI<span style={{ color: 'rgba(245,166,35,0.4)', margin: '0 2px' }}>·</span>NEXT</div>
      <div className="ld-tag">Electrical Intelligence Platform</div>

      <div className="ld-pbar-wrap">
        <div className="ld-pbar-fill"/>
      </div>
      <div className="ld-hint">&gt;_ Initialising system…</div>
    </div>
  );
}
