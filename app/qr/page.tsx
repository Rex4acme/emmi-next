'use client';
// app/qr/page.tsx — QR Code Scanner
// Scans equipment QR codes to instantly open equipment profile.
// Also generates QR codes for any equipment tag.
// Uses jsQR library loaded via CDN — no install needed.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import { Scan, QrCode, Camera, X, Loader2, CheckCircle, Search } from 'lucide-react';

// Types
interface Equipment {
  id: string;
  tag_id: string;
  name: string;
  status: string;
  location?: string;
}

interface ScannedEquipment extends Equipment {
  location: string;
}

// QR code generation via QRServer API (free, no key)
function QRImage({ value, size = 200 }: { value: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=1a2030&color=f0a500&format=svg`;
  return (
    <img
      src={url}
      alt={`QR Code for ${value}`}
      width={size}
      height={size}
      style={{ borderRadius: 12, border: '2px solid rgba(240,165,0,0.3)' }}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
        console.error('Failed to load QR code');
      }}
    />
  );
}

export default function QRPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);

  const [mode,       setMode]       = useState<'scan' | 'generate'>('scan');
  const [scanning,   setScanning]   = useState(false);
  const [found,      setFound]      = useState<ScannedEquipment | null>(null);
  const [error,      setError]      = useState('');
  const [equipment,  setEquipment]  = useState<Equipment[]>([]);
  const [selected,   setSelected]   = useState<string>('');
  const [tagSearch,  setTagSearch]  = useState('');
  const [jsQR,       setJsQR]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);

  // Load jsQR dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    script.onload = () => setJsQR(() => (window as any).jsQR);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    async function loadEquipment() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('equipment')
          .select('id, tag_id, name, status')
          .eq('user_id', user.id)
          .order('tag_id');
        if (error) throw error;
        setEquipment(data || []);
      } catch (err) {
        console.error('Failed to load equipment:', err);
        setError('Failed to load equipment list.');
      } finally {
        setLoading(false);
      }
    }
    loadEquipment();
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setFound(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API not supported on this device.');
      return;
    }
    if (!window.isSecureContext) {
      setError('Camera access requires a secure connection (HTTPS). Please access the app via HTTPS.');
      return;
    }
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permission in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported on this device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another application.');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !jsQR || !scanning) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code?.data) {
      // Vibrate on success if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
      stopCamera();
      handleScanned(code.data);
    } else {
      // Throttle scanning to ~10fps to reduce CPU usage
      setTimeout(() => {
        if (scanning) {
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      }, 100);
    }
  }, [jsQR, scanning, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function handleScanned(value: string) {
    // QR value format: emmi://equipment/{tag_id} OR just the tag_id
    const tagId = value.replace('emmi://equipment/', '').trim().toUpperCase();
    const { data } = await supabase
      .from('equipment').select('id, tag_id, name, status, location').eq('tag_id', tagId).single();

    if (data) {
      setFound(data);
    } else {
      setError(`No equipment found with tag: ${tagId}`);
    }
  }

  const filteredEq = equipment.filter(eq =>
    !tagSearch || eq.tag_id.toLowerCase().includes(tagSearch.toLowerCase()) ||
    eq.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const selectedEq = equipment.find(eq => eq.id === selected);

  return (
    <AppShell title="QR Scanner">
      <div className="max-w-lg">

        {/* Mode toggle */}
        <div className="flex mb-5 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
          {[
            { key: 'scan',     label: '📷 Scan QR',     icon: Scan },
            { key: 'generate', label: '🔲 Generate QR',  icon: QrCode },
          ].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key as any); stopCamera(); setFound(null); setError(''); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: mode === m.key ? 'var(--card)' : 'transparent',
                color:      mode === m.key ? 'var(--amber)' : 'var(--text-2)',
                border:     mode === m.key ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* ── SCAN MODE ── */}
        {mode === 'scan' && (
          <div>
            {!scanning && !found && (
              <div className="card text-center py-10 mb-4">
                <Scan size={48} style={{ color: 'var(--amber)', margin: '0 auto 12px', opacity: 0.6 }}/>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Scan Equipment QR Code</p>
                <p className="text-xs mb-5" style={{ color: 'var(--text-2)' }}>
                  Point your camera at a QR code on any EMMI-tagged equipment to instantly open its profile.
                </p>
                <button onClick={startCamera}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold mx-auto"
                  style={{ background: 'var(--amber)', color: '#000' }}>
                  <Camera size={16}/> Open Camera
                </button>
              </div>
            )}

            {/* Camera view */}
            {scanning && (
              <div className="card mb-4" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ position: 'relative', background: '#000' }}>
                  <video ref={videoRef} playsInline muted
                    style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}/>
                  {/* Scan frame overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 200, height: 200, border: '2px solid var(--amber)',
                      borderRadius: 12, boxShadow: '0 0 0 1000px rgba(0,0,0,0.4)',
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '3px solid var(--amber)', borderLeft: '3px solid var(--amber)', borderRadius: '12px 0 0 0' }}/>
                      <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTop: '3px solid var(--amber)', borderRight: '3px solid var(--amber)', borderRadius: '0 12px 0 0' }}/>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '3px solid var(--amber)', borderLeft: '3px solid var(--amber)', borderRadius: '0 0 0 12px' }}/>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottom: '3px solid var(--amber)', borderRight: '3px solid var(--amber)', borderRadius: '0 0 12px 0' }}/>
                    </div>
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }}/>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-xs animate-pulse" style={{ color: 'var(--amber)' }}>Scanning…</p>
                  <button onClick={stopCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    <X size={12}/> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Found equipment */}
            {found && (
              <div className="card mb-4" style={{ border: '1px solid rgba(52,208,88,0.3)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Equipment Found</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>QR code scanned successfully</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface)' }}>
                  <p className="text-base font-bold mb-1" style={{ color: '#fff' }}>{found.name}</p>
                  <p className="font-mono text-sm" style={{ color: 'var(--amber)' }}>{found.tag_id}</p>
                  {found.location && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>📍 {found.location}</p>}
                </div>
                <div className="flex gap-2">
                  <Link href={`/equipment/${found.id}`} className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: 'var(--amber)', color: '#000' }}>
                      Open Equipment →
                    </button>
                  </Link>
                  <Link href={`/faults/new?equipment=${found.id}`} className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: 'rgba(248,81,73,0.15)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                      ⚡ Log Fault
                    </button>
                  </Link>
                </div>
                <button onClick={() => { setFound(null); startCamera(); }}
                  className="w-full mt-2 py-2 text-xs"
                  style={{ color: 'var(--text-3)' }}>
                  Scan another →
                </button>
              </div>
            )}

            {error && (
              <div className="card p-3 mb-4 flex items-center gap-2"
                style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <X size={14} style={{ color: 'var(--red)', flexShrink: 0 }}/>
                <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>
                <button onClick={() => { setError(''); startCamera(); }} className="ml-auto text-xs"
                  style={{ color: 'var(--amber)' }}>Retry</button>
              </div>
            )}
          </div>
        )}

        {/* ── GENERATE MODE ── */}
        {mode === 'generate' && (
          <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              Select equipment to generate its QR code. Print it and attach to the physical equipment.
            </p>

            {/* Search */}
            <div className="flex items-center gap-2 form-input mb-4" style={{ padding: '0 12px' }}>
              <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
              <input value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                placeholder="Search by tag or name…"
                style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: 'var(--text)', fontSize: 13 }}/>
            </div>

            {!selected ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" style={{ color: 'var(--amber)' }}/>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>Loading equipment...</p>
                  </div>
                ) : filteredEq.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {tagSearch ? 'No equipment found matching your search.' : 'No equipment available.'}
                    </p>
                  </div>
                ) : (
                  filteredEq.map(eq => (
                    <button
                      key={eq.id}
                      onClick={() => setSelected(eq.id)}
                      className="w-full card flex items-center gap-3 hover:border-white/20 transition-all text-left"
                      style={{ padding: '10px 14px' }}
                      aria-label={`Select equipment ${eq.name} with tag ${eq.tag_id}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <QrCode size={14} style={{ color: 'var(--amber)' }}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{eq.name}</p>
                        <p className="font-mono text-xs" style={{ color: 'var(--amber)' }}>{eq.tag_id}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div>
                <button onClick={() => setSelected('')}
                  className="flex items-center gap-1.5 text-xs mb-4"
                  style={{ color: 'var(--text-3)' }}>
                  ← Back to list
                </button>
                <div className="card text-center">
                  <p className="text-base font-bold mb-1" style={{ color: '#fff' }}>{selectedEq?.name}</p>
                  <p className="font-mono text-sm mb-4" style={{ color: 'var(--amber)' }}>{selectedEq?.tag_id}</p>
                  <div className="flex justify-center mb-4">
                    <QRImage value={`emmi://equipment/${selectedEq?.tag_id}`} size={200}/>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
                    QR encodes: <span className="font-mono">emmi://equipment/{selectedEq?.tag_id}</span>
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Screenshot and print this QR code to attach to the physical equipment.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}