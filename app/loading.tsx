// app/loading.tsx — Animated splash shown while any page loads

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

        @keyframes spin3d {
          0%   { transform: rotateY(0deg) rotateX(15deg); }
          100% { transform: rotateY(360deg) rotateX(15deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.85); opacity: 1; }
          100% { transform: scale(2.0);  opacity: 0; }
        }
        @keyframes zap-glow {
          0%,100% { filter: drop-shadow(0 0 8px #f0a500); opacity:1; }
          50%      { filter: drop-shadow(0 0 24px #ffcc44) drop-shadow(0 0 48px #f0a500); opacity:0.8; }
        }
        @keyframes scanline {
          0%   { top: -4px; }
          100% { top: 100vh; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes progressFill {
          0%   { width: 0%; }
          60%  { width: 75%; }
          100% { width: 92%; }
        }
        @keyframes gridPulse {
          0%,100% { opacity:0.04; }
          50%     { opacity:0.09; }
        }
        @keyframes dotPulse {
          0%,80%,100% { transform: scale(0); opacity:0.3; }
          40%         { transform: scale(1);   opacity:1; }
        }

        .spinner-wrap {
          perspective: 500px;
          margin-bottom: 36px;
        }
        .ring-spinner {
          width: 90px; height: 90px;
          position: relative;
          transform-style: preserve-3d;
          animation: spin3d 1.6s linear infinite;
        }
        .ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
        }
        .ring-1 {
          border-top-color: #f0a500;
          border-right-color: rgba(240,165,0,0.3);
          animation: spin3d 1.6s linear infinite;
        }
        .ring-2 {
          inset: 10px;
          border-bottom-color: rgba(240,165,0,0.6);
          border-left-color: rgba(240,165,0,0.2);
          animation: spin3d 1.1s linear infinite reverse;
        }
        .ring-3 {
          inset: 22px;
          border-top-color: rgba(240,165,0,0.4);
          animation: spin3d 0.8s linear infinite;
        }
        .zap-center {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .dot-loader span {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #f0a500;
          margin: 0 3px;
          animation: dotPulse 1.4s ease-in-out infinite;
        }
        .dot-loader span:nth-child(1) { animation-delay: 0s; }
        .dot-loader span:nth-child(2) { animation-delay: 0.2s; }
        .dot-loader span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(240,165,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(240,165,0,0.05) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'gridPulse 3s ease-in-out infinite',
      }}/>

      {/* Scanline */}
      <div style={{
        position: 'fixed', left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(240,165,0,0.25), transparent)',
        animation: 'scanline 3s linear infinite',
        pointerEvents: 'none',
      }}/>

      {/* Pulse rings behind spinner */}
      {[0, 0.5, 1.0].map((delay, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 140, height: 140,
          borderRadius: '50%',
          border: '1px solid rgba(240,165,0,0.25)',
          animation: `pulse-ring 2.4s ease-out ${delay}s infinite`,
        }}/>
      ))}

      {/* 3-ring spinning loader with zap in centre */}
      <div className="spinner-wrap">
        <div className="ring-spinner">
          <div className="ring ring-1"/>
          <div className="ring ring-2"/>
          <div className="ring ring-3"/>
          <div className="zap-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#f0a500"
              style={{ animation: 'zap-glow 1.2s ease-in-out infinite' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* EMMI title */}
      <div style={{ animation: 'fadeUp 0.5s ease 0.2s both', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 40, fontWeight: 800, letterSpacing: 10,
          color: '#f0a500',
          textShadow: '0 0 40px rgba(240,165,0,0.45)',
          margin: 0,
        }}>EMMI</h1>
        <p style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 10, letterSpacing: 4,
          color: 'rgba(255,255,255,0.35)',
          marginTop: 6, textTransform: 'uppercase',
        }}>Electrical Maintenance Intelligence</p>
      </div>

      {/* Dot loader */}
      <div className="dot-loader" style={{ animation: 'fadeUp 0.5s ease 0.5s both', marginTop: 32 }}>
        <span/><span/><span/>
      </div>

      {/* Progress bar */}
      <div style={{ animation: 'fadeUp 0.5s ease 0.6s both', marginTop: 20, width: 200 }}>
        <div style={{
          height: '2px', background: 'rgba(255,255,255,0.07)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #f0a500, #ffdd66)',
            animation: 'progressFill 2.5s ease-out 0.4s both',
            boxShadow: '0 0 10px rgba(240,165,0,0.7)',
          }}/>
        </div>
      </div>
    </div>
  );
}
