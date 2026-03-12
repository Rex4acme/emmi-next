// app/loading.tsx — Insane 3D loading screen shown while app initialises

export default function Loading() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0b0f14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');

        @keyframes orbitX {
          0%   { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes zap-flicker {
          0%,100% { opacity: 1; filter: drop-shadow(0 0 12px #f0a500); }
          50%      { opacity: 0.6; filter: drop-shadow(0 0 30px #f0a500) drop-shadow(0 0 60px #f0a500); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes countUp {
          from { opacity: 0.3; }
          to   { opacity: 1; }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to   { width: 85%; }
        }
        @keyframes gridPulse {
          0%,100% { opacity: 0.03; }
          50%     { opacity: 0.08; }
        }
        .orbit-cube {
          width: 80px; height: 80px;
          position: relative;
          transform-style: preserve-3d;
          animation: orbitX 3s linear infinite;
        }
        .cube-face {
          position: absolute;
          width: 80px; height: 80px;
          border: 1.5px solid rgba(240,165,0,0.4);
          background: rgba(240,165,0,0.04);
          backface-visibility: visible;
        }
        .face-front  { transform: translateZ(40px); }
        .face-back   { transform: rotateY(180deg) translateZ(40px); }
        .face-left   { transform: rotateY(-90deg) translateZ(40px); }
        .face-right  { transform: rotateY(90deg) translateZ(40px); }
        .face-top    { transform: rotateX(90deg) translateZ(40px); }
        .face-bottom { transform: rotateX(-90deg) translateZ(40px); }
      `}</style>

      {/* Animated grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(240,165,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(240,165,0,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'gridPulse 3s ease-in-out infinite',
      }}/>

      {/* Scanline effect */}
      <div style={{
        position: 'fixed', left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(240,165,0,0.3), transparent)',
        animation: 'scanline 4s linear infinite',
        pointerEvents: 'none',
      }}/>

      {/* Pulse rings */}
      {[0, 0.4, 0.8].map((delay, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 160, height: 160,
          borderRadius: '50%',
          border: '1px solid rgba(240,165,0,0.3)',
          animation: `pulse-ring 2.4s ease-out ${delay}s infinite`,
        }}/>
      ))}

      {/* 3D Rotating cube with lightning bolt inside */}
      <div style={{ perspective: '400px', marginBottom: 32 }}>
        <div className="orbit-cube">
          <div className="cube-face face-front"/>
          <div className="cube-face face-back"/>
          <div className="cube-face face-left"/>
          <div className="cube-face face-right"/>
          <div className="cube-face face-top"/>
          <div className="cube-face face-bottom"/>
          {/* Lightning bolt centred inside cube */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#f0a500"
              style={{ animation: 'zap-flicker 1.2s ease-in-out infinite', filter: 'drop-shadow(0 0 8px #f0a500)' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* EMMI text */}
      <div style={{ animation: 'fadeUp 0.6s ease 0.3s both', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 42, fontWeight: 800, letterSpacing: 8,
          color: '#f0a500',
          textShadow: '0 0 40px rgba(240,165,0,0.5)',
          margin: 0,
        }}>EMMI</h1>
        <p style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.4)',
          marginTop: 6, textTransform: 'uppercase',
        }}>Electrical Maintenance Intelligence</p>
      </div>

      {/* Progress bar */}
      <div style={{ animation: 'fadeUp 0.6s ease 0.6s both', marginTop: 40, width: 220 }}>
        <div style={{
          height: 2, background: 'rgba(255,255,255,0.08)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #f0a500, #ffcc44)',
            animation: 'progressFill 2s ease-out 0.8s both',
            boxShadow: '0 0 12px rgba(240,165,0,0.6)',
          }}/>
        </div>
        <p style={{
          fontFamily: 'monospace', fontSize: 10,
          color: 'rgba(240,165,0,0.5)', marginTop: 10,
          letterSpacing: 2, textAlign: 'center',
        }}>INITIALISING SYSTEMS…</p>
      </div>
    </div>
  );
}
