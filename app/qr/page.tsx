'use client';
// app/qr/page.tsx — Smart Equipment Scanner
// FIXES:
// - Dropped ZXing UMD bundle which caused React #425/#422 and
//   "Cannot access 'c' before initialization" errors in Next.js
// - Now uses QuaggaJS for barcodes (compatible with Next.js bundler)
// - jsQR for QR codes (unchanged, works fine)
// - Camera stream assigned via useEffect after video element mounts

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import {
  Scan, QrCode, Camera, X, Loader2,
  CheckCircle, Search, FileImage, ChevronRight, Plus, Info,
} from 'lucide-react';

function QRImage({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=1a2030&color=f0a500&format=svg`}
      alt="QR Code" width={size} height={size}
      style={{ borderRadius: 12, border: '2px solid rgba(240,165,0,0.3)' }}
    />
  );
}

function SpecRow({ label, value }: { label: string; value: any }) {
  if (!value || value === 'null' || value === null) return null;
  const display = Array.isArray(value) ? value.join(', ') : String(value);
  if (!display.trim() || display === 'null') return null;
  return (
    <div className="py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{display}</p>
    </div>
  );
}

type Mode = 'scan' | 'nameplate' | 'generate';

export default function ScannerPage() {
  const supabase  = createBrowserClient();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef  = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const scanningRef = useRef(false);

  const [mode,          setMode]          = useState<Mode>('scan');
  const [scanning,      setScanning]      = useState(false);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [found,         setFound]         = useState<any>(null);
  const [error,         setError]         = useState('');
  const [equipment,     setEquipment]     = useState<any[]>([]);
  const [selected,      setSelected]      = useState('');
  const [tagSearch,     setTagSearch]     = useState('');
  const [capturedImg,   setCapturedImg]   = useState<string | null>(null);
  const [analysing,     setAnalysing]     = useState(false);
  const [nameplateData, setNameplateData] = useState<any>(null);
  const [nameplateErr,  setNameplateErr]  = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saveOk,        setSaveOk]        = useState(false);

  // ── Load scanning + OCR libraries ──────────────────────────
  useEffect(() => {
    const loadScript = (src: string, id: string) => {
      if (document.getElementById(id)) return;
      const s = document.createElement('script');
      s.id = id; s.src = src; s.async = true;
      document.head.appendChild(s);
    };
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', 'jsqr-lib');
    loadScript('https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js', 'quagga-lib');
    // Tesseract.js — offline OCR, runs in browser, no internet needed after first load
    loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'tesseract-lib');
    return () => stopCamera();
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('equipment')
        .select('id, tag_id, name, status, location, manufacturer, model, voltage_rating, power_rating, serial_number')
        .eq('user_id', user.id).order('tag_id');
      setEquipment(data || []);
    }
    load();
  }, []);

  // ── Assign stream after <video> is in DOM ───────────────────
  useEffect(() => {
    if (!scanning || !streamRef.current) return;

    const tryPlay = () => {
      const video = videoRef.current;
      if (!video) { setTimeout(tryPlay, 100); return; }

      video.srcObject = streamRef.current;
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');

      video.play()
        .then(() => { setCameraReady(true); startScanLoop(); })
        .catch(() => {
          setTimeout(() => {
            video.play()
              .then(() => { setCameraReady(true); startScanLoop(); })
              .catch(e => { setError('Could not start camera. ' + e.message); stopCamera(); });
          }, 300);
        });
    };
    tryPlay();
  }, [scanning]);

  async function startCamera() {
    setError(''); setFound(null); setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this browser.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current  = stream;
      scanningRef.current = true;
      setScanning(true); // renders <video> → useEffect above fires
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'   ? 'Camera permission denied. Allow camera access in browser settings.' :
        err.name === 'NotFoundError'     ? 'No camera found on this device.' :
        err.name === 'NotReadableError'  ? 'Camera is in use by another app. Close other apps and try again.' :
        `Camera error: ${err.message || err.name}`;
      setError(msg);
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setCameraReady(false);
  }

  function startScanLoop() {
    const tick = () => {
      if (!scanningRef.current) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick); return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // ── Try jsQR for QR codes ──────────────────────────────
      const jsQR = (window as any).jsQR;
      if (jsQR) {
        const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (qr?.data) { stopCamera(); handleCodeScanned(qr.data, 'QR Code'); return; }
      }

      // ── Try Quagga2 for barcodes ───────────────────────────
      // Quagga2 works via callback model — we decode from image data
      const Quagga = (window as any).Quagga;
      if (Quagga?.decodeSingle) {
        try {
          Quagga.decodeSingle({
            decoder: { readers: ['ean_reader','code_128_reader','code_39_reader','upc_reader','itf_reader','codabar_reader'] },
            locate:  true,
            src:     canvas.toDataURL('image/jpeg', 0.8),
          }, (result: any) => {
            if (result?.codeResult?.code) {
              stopCamera();
              handleCodeScanned(result.codeResult.code, result.codeResult.format || 'Barcode');
            }
          });
        } catch {
          // no barcode found — continue
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function handleCodeScanned(value: string, codeType: string) {
    const tagId = value.replace('emmi://equipment/', '').trim().toUpperCase();
    const { data: byTag } = await supabase.from('equipment').select('*').ilike('tag_id', tagId).single();
    if (byTag) { setFound({ ...byTag, scanType: codeType }); return; }
    const { data: bySerial } = await supabase.from('equipment').select('*').ilike('serial_number', tagId).single();
    if (bySerial) { setFound({ ...bySerial, scanType: codeType }); return; }
    setFound({ notFound: true, rawValue: value, scanType: codeType });
  }

  async function handleNameplateCapture(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];
    setNameplateData(null); setNameplateErr(''); setCapturedImg(null); setSaveOk(false);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setCapturedImg(dataUrl);
      await runOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // ── Tesseract.js OCR — runs 100% in browser, NO internet needed ──
  // Reads all text from nameplate image then parses known electrical fields
  async function runOCR(dataUrl: string) {
    setAnalysing(true); setNameplateErr('');
    try {
      const Tesseract = (window as any).Tesseract;
      if (!Tesseract) {
        setNameplateErr('OCR library still loading. Please wait a moment and try again.');
        setAnalysing(false); return;
      }

      // Run OCR — Tesseract downloads its language model (~8MB) on first use only
      const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: () => {}, // suppress console logs
      });

      if (!text || text.trim().length < 10) {
        setNameplateErr('Could not read text from image. Try better lighting, hold steady, and get closer to the nameplate.');
        setAnalysing(false); return;
      }

      // Parse the raw OCR text into structured equipment fields
      const parsed = parseNameplateText(text);
      parsed.raw_text = text.trim();
      setNameplateData(parsed);

    } catch (err: any) {
      setNameplateErr('OCR failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAnalysing(false);
    }
  }

  // ── Smart field parser — extracts electrical specs from raw OCR text ──
  // Handles common nameplate formats: ABB, Siemens, WEG, Leroy-Somer, etc.
  function parseNameplateText(text: string): Record<string, any> {
    const t = text.toUpperCase();
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

    const find = (patterns: RegExp[]): string | null => {
      for (const p of patterns) {
        const m = t.match(p);
        if (m?.[1]) return m[1].trim().replace(/[^\w\s\.\-\/]/g, '').trim();
      }
      return null;
    };

    // Equipment type — usually on the first 1-3 lines
    const typeKeywords: Record<string, string> = {
      'INDUCTION MOTOR': 'Induction Motor', 'SQUIRREL CAGE': 'Squirrel Cage Motor',
      'TRANSFORMER': 'Transformer', 'CIRCUIT BREAKER': 'Circuit Breaker',
      'MOTOR': 'Electric Motor', 'GENERATOR': 'Generator', 'PUMP': 'Pump',
      'COMPRESSOR': 'Compressor', 'VFD': 'Variable Frequency Drive',
      'SWITCHGEAR': 'Switchgear', 'CONTACTOR': 'Contactor', 'RELAY': 'Relay',
    };
    let equipmentName = null;
    for (const [kw, label] of Object.entries(typeKeywords)) {
      if (t.includes(kw)) { equipmentName = label; break; }
    }

    return {
      equipment_name:    equipmentName || (lines[0]?.length < 40 ? lines[0] : 'Equipment'),
      manufacturer:      find([/(?:MFR|MANUFACTURER|BRAND|MADE BY)[:\s]+([A-Z\s]+)(?:\n|\d)/,
                               /^([A-Z]{2,}(?:\s[A-Z]+)?)\s+(?:LTD|INC|CORP|GMBH|S\.A)/m]) ||
                         guessManufacturer(t),
      model:             find([/(?:MODEL|TYPE|FRAME)[:\s]+([\w\-\/]+)/,
                               /(?:MOD\.|TYP\.)[:\s]+([\w\-\/]+)/]),
      serial_number:     find([/(?:S\.?N\.?|SER(?:IAL)?(?:\s+NO\.?)?)[:\s]+([\w\-]+)/,
                               /(?:SERIAL|S\/N)[:\s]+([\w\-]+)/]),
      voltage_rating:    find([/(\d+(?:\.\d+)?\s*(?:KV|V))(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:KV|V))?/,
                               /(?:VOLT|VOLTAGE|VOLTS|RATED\s+V)[:\s]+(\d[\d\/\s]*V)/]),
      current_rating:    find([/(\d+(?:\.\d+)?\s*A(?:MPS?)?)(?:\s*\/\s*\d+(?:\.\d+)?\s*A)?/,
                               /(?:CURRENT|AMPS|AMP)[:\s]+(\d+(?:\.\d+)?)/]),
      power_rating:      find([/(\d+(?:\.\d+)?\s*(?:KW|MW|HP|KVA|VA))(?!\s*(?:HZ|V|A))/,
                               /(?:POWER|RATED\s+(?:KW|HP))[:\s]+(\d+(?:\.\d+)?\s*(?:KW|HP|KVA))/]),
      frequency:         find([/(\d+\s*HZ)/,
                               /(?:FREQ(?:UENCY)?)[:\s]+(\d+\s*HZ)/]),
      speed_rpm:         find([/(\d+\s*(?:R\.?P\.?M|RPM))/,
                               /(?:SPEED|RPM|N|NS)[:\s]+(\d+)/]),
      power_factor:      find([/(?:P\.?F\.?|COS\s*[Φφ]|POWER\s+FACTOR)[:\s]+([\d\.]+)/]),
      efficiency:        find([/(?:EFF|EFFICIENCY|\u03B7)[:\s]+([\d\.]+\s*%?)/,
                               /(\d{2,3}(?:\.\d+)?\s*%)(?=.*(?:EFF|ETA))/]),
      ip_rating:         find([/(IP\s*\d{2}[A-Z]?)/]),
      insulation_class:  find([/(?:INS(?:ULATION)?(?:\s+CLASS)?|CLASS)[:\s]+([A-H](?:\s*\d+)?)/,
                               /CLASS[:\s]+([A-H])/]),
      duty_cycle:        find([/(?:DUTY|S\d)[:\s]+([\w\d\s]+)/]),
      standards:         find([/(IEC|IEEE|BS|DIN|NEMA|AS)[\s\-]*[\d\.]+/]),
      weight_kg:         find([/(?:WT|WEIGHT|MASS)[:\s]+(\d+(?:\.\d+)?\s*KG)/,
                               /(\d+(?:\.\d+)?\s*KG)(?=\s|$)/]),
      country_of_origin: find([/(?:MADE IN|ORIGIN|MFD IN)[:\s]+([A-Z\s]+?)(?:\n|\d)/]),
      year_of_manufacture: find([/(?:YEAR|YR|DATE OF MFR)[:\s]+(\d{4})/,
                                 /(?:MFD|MANUFACTURED)[:\s]+(\d{4})/]),
      confidence:        'medium',
    };
  }

  function guessManufacturer(text: string): string | null {
    const brands = ['ABB','SIEMENS','WEG','LEROY-SOMER','LEROY SOMER','BROOK CROMPTON',
      'MARATHON','BALDOR','NIDEC','TOSHIBA','MITSUBISHI','SCHNEIDER','EATON','GE','ABB',
      'FLENDER','CROMPTON','THREEBOND','WABTEC','BROOK','PARSUN','WUXI'];
    for (const b of brands) { if (text.includes(b)) return b; }
    return null;
  }

  async function saveAsEquipment() {
    if (!nameplateData) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('equipment').insert({
      user_id:       user.id,
      tag_id:        `EQ-${Date.now().toString().slice(-6)}`,
      name:          nameplateData.equipment_name || 'New Equipment',
      manufacturer:  nameplateData.manufacturer   || null,
      model:         nameplateData.model          || null,
      serial_number: nameplateData.serial_number  || null,
      voltage_rating: nameplateData.voltage_rating || null,
      power_rating:  nameplateData.power_rating   || null,
      notes: [
        nameplateData.current_rating && `Current: ${nameplateData.current_rating}`,
        nameplateData.speed_rpm && `Speed: ${nameplateData.speed_rpm} RPM`,
        nameplateData.ip_rating && `IP: ${nameplateData.ip_rating}`,
        nameplateData.insulation_class && `Insulation: ${nameplateData.insulation_class}`,
        nameplateData.frequency && `Freq: ${nameplateData.frequency}`,
        nameplateData.efficiency && `Efficiency: ${nameplateData.efficiency}`,
        nameplateData.standards && `Standards: ${nameplateData.standards}`,
        ...(nameplateData.additional_specs || []),
      ].filter(Boolean).join(' | '),
      status: 'operational', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { alert('Save failed: ' + error.message); return; }
    setSaveOk(true);
    const { data: eq } = await supabase.from('equipment').select('id, tag_id, name, status').eq('user_id', user.id).order('tag_id');
    setEquipment(eq || []);
  }

  function switchMode(m: Mode) {
    setMode(m); stopCamera(); setFound(null); setError('');
    setCapturedImg(null); setNameplateData(null); setNameplateErr(''); setSaveOk(false);
  }

  const filteredEq = equipment.filter(eq =>
    !tagSearch || eq.tag_id.toLowerCase().includes(tagSearch.toLowerCase()) || eq.name.toLowerCase().includes(tagSearch.toLowerCase())
  );
  const selectedEq = equipment.find(eq => eq.id === selected);

  return (
    <AppShell title="Smart Scanner">
      <div className="max-w-lg">

        {/* Mode tabs */}
        <div className="flex mb-5 p-1 rounded-xl gap-1" style={{ background: 'var(--surface)' }}>
          {([
            { key: 'scan',      emoji: '📷', label: 'Scan Code'    },
            { key: 'nameplate', emoji: '🔍', label: 'Nameplate AI'  },
            { key: 'generate',  emoji: '🔲', label: 'Generate QR'   },
          ] as { key: Mode; emoji: string; label: string }[]).map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === m.key ? 'var(--card)' : 'transparent',
                color:      mode === m.key ? 'var(--amber)' : 'var(--text-2)',
                border:     mode === m.key ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* ══ SCAN MODE ══ */}
        {mode === 'scan' && (
          <div>
            {!scanning && !found && (
              <div className="card text-center py-10 mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
                  <Scan size={32} style={{ color: 'var(--amber)' }}/>
                </div>
                <p className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Scan QR Code or Barcode</p>
                <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  Supports QR codes, EAN-13, Code 128, Code 39, UPC and other standard barcodes on equipment labels.
                </p>
                <button onClick={startCamera}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--amber)', color: '#000' }}>
                  <Camera size={16}/> Open Camera
                </button>
              </div>
            )}

            {scanning && (
              <div className="mb-4" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', background: '#000', minHeight: 280 }}>
                  <video ref={videoRef} autoPlay muted playsInline
                    style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover', background: '#000' }}/>

                  {!cameraReady && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090E' }}>
                      <Loader2 size={28} className="animate-spin mb-2" style={{ color: 'var(--amber)' }}/>
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Starting camera…</p>
                    </div>
                  )}

                  {cameraReady && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {/* QR frame */}
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -58%)', width: 180, height: 180 }}>
                        <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 1000px rgba(0,0,0,0.45)' }}/>
                        {[{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}].map((pos, i) => (
                          <div key={i} style={{
                            position: 'absolute', width: 20, height: 20,
                            top:    (pos as any).t === 0 ? 0 : undefined,
                            bottom: (pos as any).b === 0 ? 0 : undefined,
                            left:   (pos as any).l === 0 ? 0 : undefined,
                            right:  (pos as any).r === 0 ? 0 : undefined,
                            borderTop:    (pos as any).t === 0 ? '3px solid #f0a500' : undefined,
                            borderBottom: (pos as any).b === 0 ? '3px solid #f0a500' : undefined,
                            borderLeft:   (pos as any).l === 0 ? '3px solid #f0a500' : undefined,
                            borderRight:  (pos as any).r === 0 ? '3px solid #f0a500' : undefined,
                          }}/>
                        ))}
                      </div>
                      {/* Barcode zone */}
                      <div style={{ position: 'absolute', bottom: 52, left: '8%', right: '8%', height: 36, border: '1.5px dashed rgba(240,165,0,0.5)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 9, color: 'rgba(240,165,0,0.7)', letterSpacing: '0.12em' }}>BARCODE ZONE</span>
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }}/>
                </div>

                <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--card)' }}>
                  <div>
                    <p className="text-xs font-bold animate-pulse" style={{ color: 'var(--amber)' }}>
                      {cameraReady ? 'Scanning for QR / Barcode…' : 'Starting camera…'}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>Hold steady, good lighting helps</p>
                  </div>
                  <button onClick={stopCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    <X size={12}/> Cancel
                  </button>
                </div>
              </div>
            )}

            {found && !found.notFound && (
              <div className="card mb-4" style={{ border: '1px solid rgba(52,208,88,0.3)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Equipment Found</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{found.scanType} scanned</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-3 space-y-1" style={{ background: 'var(--surface)' }}>
                  <p className="text-base font-bold" style={{ color: '#fff' }}>{found.name}</p>
                  <p className="font-mono text-sm" style={{ color: 'var(--amber)' }}>{found.tag_id}</p>
                  {found.location      && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>📍 {found.location}</p>}
                  {found.manufacturer  && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>🏭 {found.manufacturer}</p>}
                  {found.voltage_rating && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>⚡ {found.voltage_rating}</p>}
                  {found.power_rating  && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>🔋 {found.power_rating}</p>}
                </div>
                <div className="flex gap-2 mb-2">
                  <Link href={`/equipment/${found.id}`} className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--amber)', color: '#000' }}>
                      Open Full Profile →
                    </button>
                  </Link>
                  <Link href={`/faults/new?equipment=${found.id}`} className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(248,81,73,0.15)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                      ⚡ Log Fault
                    </button>
                  </Link>
                </div>
                <button onClick={() => { setFound(null); startCamera(); }} className="w-full py-2 text-xs" style={{ color: 'var(--text-3)' }}>
                  Scan another →
                </button>
              </div>
            )}

            {found?.notFound && (
              <div className="card mb-4" style={{ border: '1px solid rgba(240,165,0,0.3)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Info size={16} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
                  <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Not in EMMI</p>
                </div>
                <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface)' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Scanned ({found.scanType})</p>
                  <p className="font-mono text-sm font-bold" style={{ color: '#fff' }}>{found.rawValue}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => switchMode('nameplate')}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.3)' }}>
                    📷 Read Nameplate
                  </button>
                  <Link href="/equipment/new" className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                      + Add Manually
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {error && !found && (
              <div className="card p-4 mb-4" style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--red)' }}>{error}</p>
                <button onClick={() => { setError(''); startCamera(); }}
                  className="text-xs px-3 py-2 rounded-lg font-bold" style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)' }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ NAMEPLATE AI MODE ══ */}
        {mode === 'nameplate' && (
          <div>
            <div className="card mb-4" style={{ background: 'rgba(74,158,255,0.05)', border: '1px solid rgba(74,158,255,0.2)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.25)' }}>
                  <FileImage size={18} style={{ color: 'var(--blue)' }}/>
                </div>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Nameplate Reader — Offline OCR</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Takes a photo of the equipment nameplate and reads all specs using on-device OCR — works without internet, no API key needed.
                  </p>
                  <p className="text-xs mt-1.5 font-semibold" style={{ color: 'var(--green)' }}>
                    ✓ 100% offline — no internet required after first load
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    💡 Good lighting + close-up = best results
                  </p>
                </div>
              </div>
            </div>

            {!capturedImg && !analysing && (
              <div className="flex gap-3 mb-4">
                <button onClick={() => photoRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl"
                  style={{ background: 'var(--card)', border: '2px dashed rgba(240,165,0,0.3)', color: 'var(--amber)' }}>
                  <Camera size={28}/><span className="text-xs font-bold">Take Photo</span>
                </button>
                <button onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=(e)=>handleNameplateCapture((e.target as HTMLInputElement).files); i.click(); }}
                  className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl"
                  style={{ background: 'var(--card)', border: '2px dashed rgba(74,158,255,0.3)', color: 'var(--blue)' }}>
                  <FileImage size={28}/><span className="text-xs font-bold">From Gallery</span>
                </button>
              </div>
            )}
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleNameplateCapture(e.target.files)}/>

            {analysing && (
              <div className="card text-center py-10 mb-4">
                <Loader2 size={36} className="animate-spin mx-auto mb-3" style={{ color: 'var(--blue)' }}/>
                <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Reading Nameplate…</p>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>AI extracting specs — 3 to 6 seconds</p>
              </div>
            )}

            {nameplateErr && (
              <div className="card mb-4 p-4" style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{nameplateErr}</p>
                <button onClick={() => { setCapturedImg(null); setNameplateErr(''); }}
                  className="text-xs px-3 py-2 rounded-lg font-bold" style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)' }}>
                  Try Again
                </button>
              </div>
            )}

            {nameplateData && !analysing && (
              <div>
                {capturedImg && (
                  <div className="flex items-center gap-3 card mb-4" style={{ padding: '10px 14px' }}>
                    <img src={capturedImg} alt="Nameplate" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}/>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: '#fff' }}>Nameplate captured</p>
                      <p style={{ fontSize: 10, color: nameplateData.confidence === 'high' ? 'var(--green)' : nameplateData.confidence === 'medium' ? 'var(--amber)' : 'var(--red)' }}>
                        Confidence: {nameplateData.confidence}
                      </p>
                    </div>
                    <button onClick={() => { setCapturedImg(null); setNameplateData(null); setSaveOk(false); }} style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16}/></button>
                  </div>
                )}
                <div className="card mb-4">
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--amber)' }}>📋 Extracted Nameplate Data</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Fields auto-detected from OCR text. Edit equipment details after saving.</p>
                  {nameplateData.raw_text && (
                    <div className="mb-3 p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Raw OCR Text</p>
                      <p style={{ fontSize: 10, color: 'var(--text-2)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>{nameplateData.raw_text.slice(0, 400)}{nameplateData.raw_text.length > 400 ? '...' : ''}</p>
                    </div>
                  )}
                  <SpecRow label="Equipment Type"      value={nameplateData.equipment_name}      />
                  <SpecRow label="Manufacturer"        value={nameplateData.manufacturer}         />
                  <SpecRow label="Model"               value={nameplateData.model}                />
                  <SpecRow label="Serial Number"       value={nameplateData.serial_number}        />
                  <SpecRow label="Voltage Rating"      value={nameplateData.voltage_rating}       />
                  <SpecRow label="Current Rating"      value={nameplateData.current_rating}       />
                  <SpecRow label="Power Rating"        value={nameplateData.power_rating}         />
                  <SpecRow label="Frequency"           value={nameplateData.frequency}            />
                  <SpecRow label="Speed (RPM)"         value={nameplateData.speed_rpm}            />
                  <SpecRow label="Power Factor"        value={nameplateData.power_factor}         />
                  <SpecRow label="Efficiency"          value={nameplateData.efficiency}           />
                  <SpecRow label="IP Rating"           value={nameplateData.ip_rating}            />
                  <SpecRow label="Insulation Class"    value={nameplateData.insulation_class}     />
                  <SpecRow label="Duty Cycle"          value={nameplateData.duty_cycle}           />
                  <SpecRow label="Standards"           value={nameplateData.standards}            />
                  <SpecRow label="Country of Origin"   value={nameplateData.country_of_origin}    />
                  <SpecRow label="Year of Manufacture" value={nameplateData.year_of_manufacture}  />
                  <SpecRow label="Additional Specs"    value={nameplateData.additional_specs}     />
                </div>
                {!saveOk ? (
                  <button onClick={saveAsEquipment} disabled={saving}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-3"
                    style={{ background: saving ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
                    {saving ? <><Loader2 size={15} className="animate-spin"/> Saving…</> : <><Plus size={15}/> Save as New Equipment</>}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl mb-3"
                    style={{ background: 'rgba(52,208,88,0.1)', border: '1px solid rgba(52,208,88,0.3)' }}>
                    <CheckCircle size={16} style={{ color: 'var(--green)' }}/>
                    <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Saved to Equipment List</p>
                  </div>
                )}
                <button onClick={() => { setCapturedImg(null); setNameplateData(null); setSaveOk(false); }}
                  className="w-full py-2 text-xs" style={{ color: 'var(--text-3)' }}>← Scan another nameplate</button>
              </div>
            )}
          </div>
        )}

        {/* ══ GENERATE QR MODE ══ */}
        {mode === 'generate' && (
          <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              Select equipment to generate its QR code. Print and stick on the physical equipment.
            </p>
            <div className="flex items-center gap-2 form-input mb-4" style={{ padding: '0 12px' }}>
              <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
              <input value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="Search by tag or name…"
                style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: 'var(--text)', fontSize: 13 }}/>
            </div>
            {!selected ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredEq.map(eq => (
                  <button key={eq.id} onClick={() => setSelected(eq.id)}
                    className="w-full card flex items-center gap-3 hover:border-white/20 transition-all text-left"
                    style={{ padding: '10px 14px' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <QrCode size={14} style={{ color: 'var(--amber)' }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{eq.name}</p>
                      <p className="font-mono text-xs" style={{ color: 'var(--amber)' }}>{eq.tag_id}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
                  </button>
                ))}
                {filteredEq.length === 0 && (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>
                    {equipment.length === 0 ? 'No equipment added yet' : 'No matches'}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <button onClick={() => setSelected('')} className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                  ← Back to list
                </button>
                <div className="card text-center">
                  <p className="text-base font-bold mb-0.5" style={{ color: '#fff' }}>{selectedEq?.name}</p>
                  <p className="font-mono text-sm mb-4" style={{ color: 'var(--amber)' }}>{selectedEq?.tag_id}</p>
                  <div className="flex justify-center mb-4">
                    <QRImage value={`emmi://equipment/${selectedEq?.tag_id}`} size={220}/>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Screenshot → print → stick on equipment. Scan with EMMI to open this profile instantly.
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