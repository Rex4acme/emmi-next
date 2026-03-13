'use client';

// app/splash-client.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Boot sequence splash screen.
// Receives destination from the server component and navigates after sequence.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  destination: string;
}

// ─── Boot sequence steps ──────────────────────────────────────────────────────
const STEPS = [
  { id: 0, text: 'Initialising core',  startAt: 600,  endAt: 1280 },
  { id: 1, text: 'Loading database',   startAt: 1500, endAt: 2400 },
  { id: 2, text: 'Connecting AI',      startAt: 2650, endAt: 3700 },
  { id: 3, text: 'System ready',       startAt: 3950, endAt: null  }, // cursor stays
];

const REDIRECT_AT = 4900; // ms — navigate after "System ready" has been visible

export default function SplashClient({ destination }: Props) {
  const router = useRouter();

  type StepState = { id: number; text: string; phase: 'running' | 'done' };
  const [stepStates, setStepStates]   = useState<StepState[]>([]);
  const [logoIn, setLogoIn]           = useState(false);
  const [glitch, setGlitch]           = useState(false);
  const [nameIn, setNameIn]           = useState(false);
  const [termIn, setTermIn]           = useState(false);
  const [scanOn, setScanOn]           = useState(false);
  const [systemReady, setSystemReady] = useState(false);
  const [particles, setParticles]     = useState<
    { id: number; x: number; sz: number; spd: number; op: number; dl: number }[]
  >([]);

  // ── particles (client only, avoids SSR mismatch) ─────────────────────────
  useEffect(() => {
    setParticles(
      Array.from({ length: 26 }, (_, i) => ({
        id:  i,
        x:   parseFloat((Math.random() * 100).toFixed(2)),
        sz:  parseFloat((Math.random() * 2.4 + 0.7).toFixed(2)),
        spd: parseFloat((Math.random() * 17 + 13).toFixed(1)),
        op:  parseFloat((Math.random() * 0.4 + 0.08).toFixed(2)),
        dl:  parseFloat((Math.random() * 9).toFixed(1)),
      }))
    );
  }, []);

  // ── entrance sequence ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = [
      setTimeout(() => setLogoIn(true),  160),
      setTimeout(() => setGlitch(true),  330),
      setTimeout(() => setGlitch(false), 670),
      setTimeout(() => setNameIn(true),  720),
      setTimeout(() => setTermIn(true),  1080),
      setTimeout(() => setScanOn(true),  1250),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  // ── step sequencer ────────────────────────────────────────────────────────
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step) => {
      // start
      timers.push(setTimeout(() => {
        setStepStates(prev =>
          prev.find(s => s.id === step.id)
            ? prev
            : [...prev, { id: step.id, text: step.text, phase: 'running' }]
        );
      }, step.startAt));

      // complete (null = stays as blinking cursor)
      if (step.endAt !== null) {
        timers.push(setTimeout(() => {
          setStepStates(prev =>
            prev.map(s => s.id === step.id ? { ...s, phase: 'done' } : s)
          );
        }, step.endAt));
      }
    });

    // show ready state
    timers.push(setTimeout(() => setSystemReady(true), 3950));

    // navigate
    timers.push(setTimeout(() => router.push(destination), REDIRECT_AT));

    return () => timers.forEach(clearTimeout);
  }, [router, destination]);

  // ── progress ──────────────────────────────────────────────────────────────
  const doneCount = stepStates.filter(s => s.phase === 'done').length;
  const progress  = systemReady
    ? 100
    : Math.min(Math.round((doneCount / STEPS.length) * 86), 86);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@500;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          background: #09090E;
          overflow: hidden;
        }

        /* ── root container ── */
        .sp {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: #09090E;
          font-family: 'Share Tech Mono', monospace;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* ── deep glow behind logo ── */
        .glow-orb {
          position: absolute;
          width: 480px; height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%);
          pointer-events: none;
          animation: orb-breathe 4s ease-in-out infinite;
        }
        @keyframes orb-breathe {
          0%,100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(1.12); opacity: 0.7; }
        }

        /* ── grid ── */
        .grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(245,166,35,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,166,35,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* ── CRT horizontal lines ── */
        .crt {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.055) 2px, rgba(0,0,0,0.055) 4px
          );
        }

        /* ── vignette ── */
        .vig {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 100% 100% at 50% 50%,
            transparent 40%, rgba(0,0,0,0.55) 100%);
        }

        /* ── scan line ── */
        .scanline {
          position: absolute; left: 0; right: 0;
          height: 160px; pointer-events: none;
          background: linear-gradient(to bottom,
            transparent,
            rgba(245,166,35,0.035) 35%,
            rgba(245,166,35,0.08)  50%,
            rgba(245,166,35,0.035) 65%,
            transparent
          );
          top: -160px;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .scanline.on {
          opacity: 1;
          animation: scan 5.5s linear infinite;
        }
        @keyframes scan { 0% { top: -160px } 100% { top: 100% } }

        /* ── floating gold particles ── */
        .pt {
          position: absolute; bottom: -8px; border-radius: 50%;
          background: #F5A623; pointer-events: none;
          animation: rise linear infinite;
        }
        @keyframes rise {
          0%   { transform: translateY(0) scale(1);        opacity: 0; }
          7%   { opacity: 1; }
          93%  { opacity: 1; }
          100% { transform: translateY(-108vh) scale(0.2); opacity: 0; }
        }

        /* ── corner brackets ── */
        .corn {
          position: absolute; width: 24px; height: 24px;
          border-color: rgba(245,166,35,0.2); border-style: solid;
        }
        .c1 { top: 18px; left: 18px;   border-width: 1px 0 0 1px; }
        .c2 { top: 18px; right: 18px;  border-width: 1px 1px 0 0; }
        .c3 { bottom: 18px; left: 18px;  border-width: 0 0 1px 1px; }
        .c4 { bottom: 18px; right: 18px; border-width: 0 1px 1px 0; }

        /* ── logo wrapper ── */
        .logo-w {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 30px;
          opacity: 0;
          transform: scale(0.5) translateY(30px);
          transition:
            opacity  0.7s cubic-bezier(.16,1,.3,1),
            transform 0.75s cubic-bezier(.16,1,.3,1);
        }
        .logo-w.in { opacity: 1; transform: scale(1) translateY(0); }

        /* outer static rings */
        .ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(245,166,35,0.1);
          animation: ringpulse 3.5s ease-in-out infinite;
        }
        .rg1 { width: 172px; height: 172px; }
        .rg2 { width: 196px; height: 196px; animation-delay: 0.7s; }
        .rg3 { width: 222px; height: 222px; animation-delay: 1.4s; border-color: rgba(245,166,35,0.05); }
        @keyframes ringpulse {
          0%,100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(1.04); opacity: 0.35; }
        }

        /* spinning conic ring */
        .ring-spin {
          position: absolute;
          width: 150px; height: 150px; border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            rgba(245,166,35,0)    0deg,
            rgba(245,166,35,0.5)  55deg,
            rgba(255,215,100,0.9) 90deg,
            rgba(245,166,35,0.5)  125deg,
            rgba(245,166,35,0)    175deg
          );
          animation: spinring 3.8s linear infinite;
          -webkit-mask: radial-gradient(circle at center, transparent 65px, black 67px);
                  mask: radial-gradient(circle at center, transparent 65px, black 67px);
        }
        @keyframes spinring { to { transform: rotate(360deg); } }

        /* inner circle */
        .logo-c {
          width: 124px; height: 124px; border-radius: 50%;
          background: radial-gradient(circle at 37% 30%, #1e1b08, #09090E 72%);
          border: 1.5px solid rgba(245,166,35,0.28);
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
          box-shadow:
            0 0 32px rgba(245,166,35,0.1),
            0 0 64px rgba(245,166,35,0.05),
            inset 0 0 22px rgba(245,166,35,0.04);
        }

        /* bolt */
        .bolt {
          width: 50px; height: 60px;
          filter:
            drop-shadow(0 0 9px rgba(245,166,35,0.9))
            drop-shadow(0 0 25px rgba(245,166,35,0.45));
          animation: boltpulse 3s ease-in-out infinite;
        }
        @keyframes boltpulse {
          0%,100% {
            filter: drop-shadow(0 0 9px rgba(245,166,35,.9)) drop-shadow(0 0 25px rgba(245,166,35,.42));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(245,166,35,1)) drop-shadow(0 0 44px rgba(245,166,35,.65));
          }
        }

        /* glitch on logo */
        .logo-w.gl .bolt {
          animation: glbolt 0.34s steps(3) forwards;
        }
        @keyframes glbolt {
          0%   { transform: translate(0,0);      filter: drop-shadow(0 0 9px #F5A623); }
          22%  { transform: translate(-6px, 3px); filter: drop-shadow(-5px 0 0 #ff0040) drop-shadow(5px 0 0 #00f7ff) brightness(2); }
          44%  { transform: translate(6px,-3px);  filter: drop-shadow(5px 0 0 #ff0040) drop-shadow(-5px 0 0 #00f7ff) brightness(2.2); }
          66%  { transform: translate(-3px, 1px); filter: brightness(1.6) drop-shadow(0 0 18px #FFD166); }
          88%  { transform: translate(2px,-1px);  filter: brightness(1.2) drop-shadow(0 0 12px #F5A623); }
          100% { transform: translate(0,0);      filter: drop-shadow(0 0 9px rgba(245,166,35,.9)) drop-shadow(0 0 25px rgba(245,166,35,.42)); }
        }

        /* ── app name ── */
        .appname {
          font-family: 'Rajdhani', sans-serif;
          font-size: clamp(2.1rem, 9vw, 3rem);
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #ffffff;
          text-align: center;
          line-height: 1;
          margin-bottom: 7px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .appname.in { opacity: 1; transform: translateY(0); }
        .appname .dot { color: #F5A623; }

        /* ── tagline ── */
        .tagline {
          font-size: clamp(0.53rem, 2vw, 0.62rem);
          letter-spacing: 0.35em;
          color: rgba(245,166,35,0.42);
          text-transform: uppercase;
          margin-bottom: 48px;
          opacity: 0;
          transition: opacity 0.6s ease 0.3s;
        }
        .tagline.in { opacity: 1; }

        /* ── terminal card ── */
        .term {
          width: min(375px, 90vw);
          background: rgba(6,6,11,0.9);
          border: 1px solid rgba(245,166,35,0.12);
          border-radius: 7px;
          overflow: hidden;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.45s ease, transform 0.45s ease;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow:
            0 0 0 1px rgba(245,166,35,0.04),
            0 28px 56px rgba(0,0,0,0.7),
            0 0 80px rgba(245,166,35,0.035);
        }
        .term.in { opacity: 1; transform: translateY(0); }

        /* gold top line */
        .term::before {
          content: '';
          display: block; height: 1px;
          background: linear-gradient(
            90deg,
            transparent 4%,
            rgba(245,166,35,0.5)  35%,
            rgba(255,215,100,0.8) 50%,
            rgba(245,166,35,0.5)  65%,
            transparent 96%
          );
        }

        /* title bar */
        .tbar {
          display: flex; align-items: center; gap: 7px;
          padding: 11px 16px;
          border-bottom: 1px solid rgba(245,166,35,0.07);
        }
        .td { width: 9px; height: 9px; border-radius: 50%; }
        .td1 { background: #FF5F57; }
        .td2 { background: #FEBC2E; }
        .td3 { background: #28C840; }
        .ttitle {
          flex: 1; text-align: center; margin-right: 26px;
          font-size: 0.59rem;
          color: rgba(245,166,35,0.27);
          letter-spacing: 0.16em;
        }

        /* body */
        .tbody { padding: 15px 20px 17px; }

        /* each boot line */
        .bline {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.75rem;
          line-height: 2;
          opacity: 0; transform: translateX(-10px);
          animation: slidein 0.24s ease forwards;
        }
        @keyframes slidein { to { opacity: 1; transform: translateX(0); } }

        .prompt { color: rgba(245,166,35,0.35); flex-shrink: 0; font-size: 0.68rem; }
        .btext  { color: rgba(225,228,240,0.7); flex: 1; }

        /* spinner */
        .spinner {
          flex-shrink: 0;
          width: 13px; height: 13px;
          border: 1.5px solid #F5A623;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* checkmark */
        .chk {
          flex-shrink: 0;
          color: #F5A623; font-size: 0.76rem; line-height: 1;
          animation: popin 0.2s cubic-bezier(.175,.885,.32,1.5) forwards;
        }
        @keyframes popin {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg);   opacity: 1; }
        }

        /* ── ready line ── */
        .rline {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.75rem; line-height: 2;
          color: #F5A623; font-weight: 600;
          opacity: 0; transform: translateX(-10px);
          animation: slidein 0.24s ease forwards;
        }
        .rchk { color: #28C840; font-size: 0.8rem; }

        /* blinking block cursor */
        .cursor {
          display: inline-block;
          width: 8px; height: 14px;
          background: #F5A623;
          margin-left: 3px;
          vertical-align: middle;
          animation: blink 1.1s step-end infinite;
        }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

        /* ── progress bar ── */
        .pbar {
          margin: 10px 20px 15px;
          height: 2px;
          background: rgba(245,166,35,0.07);
          border-radius: 1px;
          overflow: hidden;
        }
        .pfill {
          height: 100%;
          background: linear-gradient(90deg, #F5A623 0%, #FFD166 50%, #F5A623 100%);
          background-size: 200% 100%;
          border-radius: 1px;
          animation: shimmer 2s linear infinite;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 8px #F5A623, 0 0 20px rgba(245,166,35,0.3);
        }
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── version tag ── */
        .ver {
          position: absolute; bottom: 26px;
          font-size: 0.58rem;
          color: rgba(245,166,35,0.16);
          letter-spacing: 0.2em;
          opacity: 0;
          transition: opacity 0.6s ease 1.8s;
        }
        .ver.in { opacity: 1; }
      `}</style>

      <div className="sp">
        {/* layers */}
        <div className="glow-orb" />
        <div className="grid" />
        <div className="crt" />
        <div className="vig" />
        <div className={`scanline${scanOn ? ' on' : ''}`} />

        {/* corner brackets */}
        <div className="corn c1" /><div className="corn c2" />
        <div className="corn c3" /><div className="corn c4" />

        {/* particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="pt"
            style={{
              left:                  `${p.x}%`,
              width:                 `${p.sz}px`,
              height:                `${p.sz}px`,
              opacity:               p.op,
              animationDuration:     `${p.spd}s`,
              animationDelay:        `${p.dl}s`,
            }}
          />
        ))}

        {/* ── Logo ── */}
        <div className={`logo-w${logoIn ? ' in' : ''}${glitch ? ' gl' : ''}`}>
          <div className="ring rg3" />
          <div className="ring rg2" />
          <div className="ring rg1" />
          <div className="ring-spin" />
          <div className="logo-c">
            <svg className="bolt" viewBox="0 0 58 68" fill="none">
              <path
                d="M34 2L4 38H26L24 66L54 30H32L34 2Z"
                fill="url(#lg)"
                stroke="rgba(255,215,80,0.22)"
                strokeWidth="0.75"
              />
              <defs>
                <linearGradient id="lg" x1="29" y1="2" x2="29" y2="66" gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stopColor="#FFD166" />
                  <stop offset="100%" stopColor="#F5A623" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* ── Name ── */}
        <div className={`appname${nameIn ? ' in' : ''}`}>
          EMMI<span className="dot">·</span>NEXT
        </div>
        <div className={`tagline${nameIn ? ' in' : ''}`}>
          Electrical Intelligence Platform
        </div>

        {/* ── Terminal ── */}
        <div className={`term${termIn ? ' in' : ''}`}>
          <div className="tbar">
            <div className="td td1" />
            <div className="td td2" />
            <div className="td td3" />
            <span className="ttitle">SYSTEM BOOT — emmi-next</span>
          </div>

          <div className="tbody">
            {stepStates.map(step => (
              <div key={step.id} className="bline">
                <span className="prompt">&gt;_</span>
                <span className="btext">{step.text}</span>
                {step.phase === 'running' && step.id < 3 && (
                  <div className="spinner" />
                )}
                {step.phase === 'done' && (
                  <span className="chk">✓</span>
                )}
              </div>
            ))}

            {systemReady && (
              <div className="rline">
                <span className="prompt">&gt;_</span>
                <span>System ready</span>
                <span className="rchk">✓</span>
                <span className="cursor" />
              </div>
            )}
          </div>

          <div className="pbar">
            <div className="pfill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className={`ver${termIn ? ' in' : ''}`}>
          EMMI-NEXT &nbsp;·&nbsp; ELECTRICAL INTELLIGENCE PLATFORM
        </div>
      </div>
    </>
  );
}
