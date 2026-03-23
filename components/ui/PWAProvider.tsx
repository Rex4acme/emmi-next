'use client';
// components/ui/PWAProvider.tsx
// 1. Registers the service worker for offline support
// 2. Shows a tasteful "Install App" banner when browser fires the install prompt
// Add <PWAProvider/> once inside your app/layout.tsx body

import { useEffect, useState } from 'react';
import { Zap, Download, X } from 'lucide-react';

export default function PWAProvider() {
  const [installPrompt,  setInstallPrompt]  = useState<any>(null);
  const [showBanner,     setShowBanner]     = useState(false);
  const [dismissed,      setDismissed]      = useState(false);
  const [installing,     setInstalling]     = useState(false);
  const [installed,      setInstalled]      = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    // Don't show banner if already dismissed this session
    if (sessionStorage.getItem('emmi-pwa-dismissed')) return;

    // Don't show if already running as PWA (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Capture the browser's install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner after 10 seconds — don't interrupt immediately
      setTimeout(() => setShowBanner(true), 10000);
    };

    window.addEventListener('beforeinstallprompt', handler as any);

    // Also detect if already installed
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setInstalled(true);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  function dismiss() {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem('emmi-pwa-dismissed', '1');
  }

  async function handleInstall() {
    if (!installPrompt) return;
    setInstalling(true);
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setShowBanner(false);
      setInstalled(true);
    }
  }

  if (!showBanner || dismissed) return null;

  return (
    <div style={{
      position:     'fixed',
      bottom:       72, // above bottom nav on mobile
      left:         12,
      right:        12,
      zIndex:       9000,
      background:   '#1a2030',
      border:       '1px solid rgba(240,165,0,0.3)',
      borderRadius: 16,
      padding:      '14px 16px',
      display:      'flex',
      alignItems:   'center',
      gap:          12,
      boxShadow:    '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(240,165,0,0.1)',
      animation:    'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
      maxWidth:     480,
      margin:       '0 auto',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Zap size={20} style={{ color: 'var(--amber)' }} strokeWidth={2.5}/>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', margin: 0 }}>
          Install EMMI
        </p>
        <p style={{ fontSize: 11, color: '#8b949e', margin: '2px 0 0' }}>
          Add to home screen for offline access
        </p>
      </div>

      {/* Install button */}
      <button onClick={handleInstall} disabled={installing}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          padding:      '8px 14px',
          background:   'var(--amber)',
          color:        '#000',
          border:       'none',
          borderRadius: 10,
          fontSize:     12,
          fontWeight:   700,
          cursor:       'pointer',
          flexShrink:   0,
          whiteSpace:   'nowrap',
        }}>
        <Download size={13}/>
        {installing ? 'Installing…' : 'Install'}
      </button>

      {/* Dismiss */}
      <button onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e7681', padding: 4, flexShrink: 0 }}>
        <X size={16}/>
      </button>
    </div>
  );
}
