// app/loading.tsx — EMMI startup splash screen
// EKG pulse line + circuit boot sequence

export default function Loading() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0b0f14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap');

        @keyframes ekg-draw {
          0%   { stroke-dashoffset: 1000; opacity: 1; }
          70%  { stroke-dashoffset: 0;    opacity: 1; }
          100% { stroke-dashoffset: 0;    opacity: 0.2; }
        }
        @keyframes ekg-glow {
          0%,100% { filter: drop-shadow(0 0 4px #f0a500); }
          50%     { filter: drop-shadow(0 0 18px #ffcc44) drop-shadow(0 0 36px #f0a500); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes boot-fade {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes bar-fill {
          0%   { width:0%;  }
          20%  { width:18%; }
          45%  { width:52%; }
          70%  { width:74%; }
          90%  { width:91%; }
          100% { width:96%; }
        }
        @keyframes bar-glow {
          0%,100% { box-shadow:0 0 6px rgba(240,165,0,0.5); }
          50%     { box-shadow:0 0 16px rgba(240,165,0,0.9),0 0 32px rgba(240,165,0,0.4); }
        }
        @keyframes cursor-blink {
          0%,49%  { opacity:0; }
          50%,100%{ opacity:1; }
        }
        @keyframes grid-breathe {
          0%,100%{ opacity:0.03; } 50%{ opacity:0.07; }
        }
        @keyframes scan {
          0%  { top:-4px; }
          100%{ top:100vh; }
        }

        .ekg-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation:
            ekg-draw 2s cubic-bezier(0.4,0,0.2,1) 0.3s forwards,
            ekg-glow  1.4s ease-in-out 0.3s infinite;
        }
        .boot-line {
          opacity: 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: rgba(240,165,0,0.6);
          letter-spacing: 0.04em;
          animation: boot-fade 0.3s ease forwards;
          white-space: nowrap;
          line-height: 1.7;
        }
        .boot-line:nth-child(1){ animation-delay:0.7s;  }
        .boot-line:nth-child(2){ animation-delay:1.05s; }
        .boot-line:nth-child(3){ animation-delay:1.4s;  }
        .boot-line:nth-child(4){ animation-delay:1.75s; color:rgba(52,208,88,0.75); }
        .cursor {
          display:inline-block; width:6px; height:10px;
          background:#f0a500; margin-left:2px;
          vertical-align:middle;
          animation: cursor-blink 1s step-end 2s infinite;
        }
      `}</style>

      {/* Grid */}
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none',
        backgroundImage:`
          linear-gradient(rgba(240,165,0,0.06) 1px,transparent 1px),
          linear-gradient(90deg,rgba(240,165,0,0.06) 1px,transparent 1px)
        `,
        backgroundSize:'48px 48px',
        animation:'grid-breathe 4s ease-in-out infinite',
      }}/>

      {/* Scanline */}
      <div style={{
        position:'fixed', left:0, right:0, height:'1px',
        background:'linear-gradient(90deg,transparent,rgba(240,165,0,0.28),transparent)',
        animation:'scan 4s linear infinite', pointerEvents:'none',
      }}/>

      {/* Content */}
      <div style={{ width:'100%', maxWidth:320, padding:'0 24px', display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* EKG waveform */}
        <div style={{ width:'100%', marginBottom:28, animation:'fadeUp 0.4s ease 0.1s both' }}>
          <svg viewBox="0 0 320 70" width="100%" height="70" style={{ overflow:'visible' }}>
            {/* Dim baseline */}
            <line x1="0" y1="35" x2="320" y2="35"
              stroke="rgba(240,165,0,0.1)" strokeWidth="1"/>
            {/* Live EKG trace */}
            <path
              className="ekg-path"
              d="M0,35 L50,35 L58,35 L62,26 L67,14 L72,4 L76,62 L80,35 L88,35 L93,28 L97,35
                 L148,35 L156,35 L160,26 L165,14 L170,4 L174,62 L178,35 L186,35 L191,28 L195,35
                 L320,35"
              fill="none" stroke="#f0a500" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {/* Travelling dot along the path */}
            <circle r="3.5" fill="#f0a500" style={{ filter:'drop-shadow(0 0 8px #f0a500)' }}>
              <animateMotion dur="2.3s" begin="0.3s" repeatCount="indefinite"
                path="M0,35 L50,35 L58,35 L62,26 L67,14 L72,4 L76,62 L80,35 L88,35 L93,28 L97,35 L148,35 L156,35 L160,26 L165,14 L170,4 L174,62 L178,35 L186,35 L191,28 L195,35 L320,35"/>
            </circle>
          </svg>
        </div>

        {/* EMMI wordmark */}
        <div style={{ textAlign:'center', marginBottom:28, animation:'fadeUp 0.5s ease 0.25s both' }}>
          <h1 style={{
            fontFamily:"'Syne',sans-serif",
            fontSize:44, fontWeight:800, letterSpacing:12,
            color:'#f0a500',
            textShadow:'0 0 30px rgba(240,165,0,0.55),0 0 60px rgba(240,165,0,0.2)',
            margin:0, lineHeight:1,
          }}>EMMI</h1>
          <p style={{
            fontFamily:"'JetBrains Mono',monospace",
            fontSize:9, letterSpacing:3.5,
            color:'rgba(255,255,255,0.3)',
            marginTop:8, textTransform:'uppercase',
          }}>Electrical Maintenance Intelligence</p>
        </div>

        {/* Boot console */}
        <div style={{
          width:'100%',
          background:'rgba(0,0,0,0.4)',
          border:'1px solid rgba(240,165,0,0.12)',
          borderRadius:8,
          padding:'10px 14px',
          marginBottom:20,
          animation:'fadeUp 0.5s ease 0.5s both',
          minHeight:76,
        }}>
          <div className="boot-line">▸ Initialising EMMI core…</div>
          <div className="boot-line">▸ Loading equipment database…</div>
          <div className="boot-line">▸ Connecting AI fault engine…</div>
          <div className="boot-line">✓ System ready<span className="cursor"/></div>
        </div>

        {/* Progress bar */}
        <div style={{ width:'100%', animation:'fadeUp 0.5s ease 0.55s both' }}>
          <div style={{
            width:'100%', height:3,
            background:'rgba(255,255,255,0.06)',
            borderRadius:4, overflow:'hidden',
          }}>
            <div style={{
              height:'100%',
              background:'linear-gradient(90deg,#c87800,#f0a500,#ffdd66)',
              borderRadius:4,
              animation:'bar-fill 2.8s cubic-bezier(0.4,0,0.2,1) 0.4s both, bar-glow 1.4s ease-in-out 0.4s infinite',
            }}/>
          </div>
        </div>

      </div>
    </div>
  );
}
