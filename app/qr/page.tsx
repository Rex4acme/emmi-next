'use client';
// app/qr/page.tsx — Smart Equipment Scanner
// Mode 1: Scan QR code or barcode → find equipment in EMMI
// Mode 2: Photograph nameplate → AI reads all specs
// Mode 3: Generate QR code for any equipment

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import {
  Scan, QrCode, Camera, X, Loader2,
  CheckCircle, Search, Barcode, FileImage,
  Zap, AlertTriangle, ChevronRight, Copy,
  Plus, Info,
} from 'lucide-react';

// ── QR image generator ────────────────────────────────────────
function QRImage({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=1a2030&color=f0a500&format=svg`}
      alt="QR Code" width={size} height={size}
      style={{ borderRadius: 12, border: '2px solid rgba(240,165,0,0.3)' }}
    />
  );
}

// ── Nameplate spec row ─────────────────────────────────────────
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

// ── Main page ─────────────────────────────────────────────────
export default function ScannerPage() {
  const supabase = createBrowserClient();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const photoRef   = useRef<HTMLInputElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);

  type Mode = 'scan' | 'nameplate' | 'generate';
  const [mode,       setMode]       = useState<Mode>('scan');
  const [scanning,   setScanning]   = useState(false);
  const [found,      setFound]      = useState<any>(null);
  const [error,      setError]      = useState('');
  const [equipment,  setEquipment]  = useState<any[]>([]);
  const [selected,   setSelected]   = useState('');
  const [tagSearch,  setTagSearch]  = useState('');

  // Nameplate state
  const [capturedImg,  setCapturedImg]  = useState<string | null>(null); // base64
  const [imgMime,      setImgMime]      = useState('image/jpeg');
  const [analysing,    setAnalysing]    = useState(false);
  const [nameplateData,setNameplateData]= useState<any>(null);
  const [nameplateErr, setNameplateErr] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveOk,       setSaveOk]       = useState(false);

  // Libraries loaded flag
  const [libsReady, setLibsReady] = useState(false);

  // ── Load jsQR + ZXing for barcode ──────────────────────────
  useEffect(() => {
    let loaded = 0;
    const check = () => { loaded++; if (loaded === 2) setLibsReady(true); };

    const s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    s1.onload = check; s1.onerror = check;
    document.head.appendChild(s1);

    // ZXing for barcodes (EAN-13, Code 128, Code 39, etc.)
    const s2 = document.createElement('script');
    s2.src = 'https://unpkg.com/@zxing/browser@0.1.1/umd/index.min.js';
    s2.onload = check; s2.onerror = check;
    document.head.appendChild(s2);

    return () => stopCamera();
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('equipment').select('id, tag_id, name, status, location, manufacturer, model, voltage_rating, power_rating')
        .eq('user_id', user.id).order('tag_id');
      setEquipment(data || []);
    }
    load();
  }, []);

  // ── Camera helpers ──────────────────────────────────────────
  async function startCamera() {
    setError(''); setFound(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch {
      setError('Camera permission denied. Please allow camera access in your browser settings.');
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  // ── Scan frame — tries QR first, then barcode ───────────────
  function scanFrame() {
    if (!videoRef.current || !canvasRef.current) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try QR code first (jsQR)
    const jsQR = (window as any).jsQR;
    if (jsQR) {
      const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (qr?.data) { stopCamera(); handleCodeScanned(qr.data, 'QR'); return; }
    }

    // Try barcode (ZXing)
    try {
      const ZXing = (window as any).ZXingBrowser;
      if (ZXing) {
        const hints = new Map();
        const formats = [
          ZXing.BarcodeFormat?.EAN_13,
          ZXing.BarcodeFormat?.CODE_128,
          ZXing.BarcodeFormat?.CODE_39,
          ZXing.BarcodeFormat?.ITF,
          ZXing.BarcodeFormat?.DATA_MATRIX,
        ].filter(Boolean);
        if (formats.length) hints.set(ZXing.DecodeHintType?.POSSIBLE_FORMATS, formats);

        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);
        const luminance = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const binary    = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
        const result    = reader.decode(binary);
        if (result?.getText()) {
          stopCamera();
          handleCodeScanned(result.getText(), result.getBarcodeFormat?.() || 'Barcode');
          return;
        }
      }
    } catch {
      // ZXing throws when no barcode found — ignore and continue scanning
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }

  // ── Handle scanned code ─────────────────────────────────────
  async function handleCodeScanned(value: string, codeType: string) {
    // Strip EMMI deep-link prefix if present
    const tagId = value.replace('emmi://equipment/', '').trim().toUpperCase();

    // Try to find in EMMI database by tag_id first
    const { data: byTag } = await supabase
      .from('equipment').select('*').eq('tag_id', tagId).single();

    if (byTag) { setFound({ ...byTag, scanType: codeType }); return; }

    // If not found by tag_id, try searching by serial number or model
    const { data: bySerial } = await supabase
      .from('equipment').select('*').eq('serial_number', tagId).single();

    if (bySerial) { setFound({ ...bySerial, scanType: codeType }); return; }

    // Not in database — show the raw scanned value so engineer can manually search
    setError(`${codeType} scanned: "${value}" — not found in your equipment list. You can add it or search manually below.`);
    setFound({ notFound: true, rawValue: value, scanType: codeType });
  }

  // ── Nameplate capture ───────────────────────────────────────
  async function handleNameplateCapture(files: FileList | null) {
    if (!files?.[0]) return;
    const file = files[0];
    setNameplateData(null); setNameplateErr(''); setCapturedImg(null); setSaveOk(false);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl   = e.target?.result as string;
      const base64    = dataUrl.split(',')[1];
      const mime      = file.type || 'image/jpeg';
      setCapturedImg(dataUrl);
      setImgMime(mime);
      await analyseNameplate(base64, mime);
    };
    reader.readAsDataURL(file);
  }

  async function analyseNameplate(base64: string, mime: string) {
    setAnalysing(true); setNameplateErr('');
    try {
      const res = await fetch('/api/nameplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNameplateErr(data.error || 'Failed to read nameplate.');
      } else {
        setNameplateData(data.specs);
      }
    } catch (err: any) {
      setNameplateErr('Network error. Please try again.');
    } finally {
      setAnalysing(false);
    }
  }

  // ── Save nameplate data as new equipment ────────────────────
  async function saveAsEquipment() {
    if (!nameplateData) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();

    const payload = {
      user_id:      user.id,
      tag_id:       `EQ-${Date.now().toString().slice(-6)}`, // auto-generate tag
      name:         nameplateData.equipment_name || 'New Equipment',
      manufacturer: nameplateData.manufacturer   || null,
      model:        nameplateData.model          || null,
      serial_number: nameplateData.serial_number || null,
      voltage_rating: nameplateData.voltage_rating || null,
      power_rating:  nameplateData.power_rating  || null,
      notes: [
        nameplateData.current_rating   ? `Current: ${nameplateData.current_rating}` : null,
        nameplateData.speed_rpm        ? `Speed: ${nameplateData.speed_rpm} RPM`    : null,
        nameplateData.ip_rating        ? `IP: ${nameplateData.ip_rating}`            : null,
        nameplateData.insulation_class ? `Insulation: ${nameplateData.insulation_class}` : null,
        nameplateData.frequency        ? `Freq: ${nameplateData.frequency}`          : null,
        nameplateData.efficiency       ? `Efficiency: ${nameplateData.efficiency}`   : null,
        nameplateData.standards        ? `Standards: ${nameplateData.standards}`     : null,
        ...(nameplateData.additional_specs || []),
      ].filter(Boolean).join(' | '),
      status:     'operational',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('equipment').insert(payload);
    setSaving(false);
    if (error) { alert('Save failed: ' + error.message); return; }
    setSaveOk(true);
    // Refresh equipment list
    const { data: eq } = await supabase.from('equipment').select('id, tag_id, name, status').eq('user_id', user.id).order('tag_id');
    setEquipment(eq || []);
  }

  function switchMode(m: Mode) {
    setMode(m); stopCamera();
    setFound(null); setError('');
    setCapturedImg(null); setNameplateData(null); setNameplateErr(''); setSaveOk(false);
  }

  const filteredEq = equipment.filter(eq =>
    !tagSearch ||
    eq.tag_id.toLowerCase().includes(tagSearch.toLowerCase()) ||
    eq.name.toLowerCase().includes(tagSearch.toLowerCase())
  );
  const selectedEq = equipment.find(eq => eq.id === selected);

  // ── Render ──────────────────────────────────────────────────
  return (
    <AppShell title="Smart Scanner">
      <div className="max-w-lg">

        {/* Mode tabs */}
        <div className="flex mb-5 p-1 rounded-xl gap-1" style={{ background: 'var(--surface)' }}>
          {[
            { key: 'scan',      emoji: '📷', label: 'Scan Code'   },
            { key: 'nameplate', emoji: '🔍', label: 'Nameplate AI' },
            { key: 'generate',  emoji: '🔲', label: 'Generate QR'  },
          ].map(m => (
            <button key={m.key} onClick={() => switchMode(m.key as Mode)}
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

        {/* ════════════════════════════════════════════════
            MODE 1 — SCAN QR / BARCODE
        ════════════════════════════════════════════════ */}
        {mode === 'scan' && (
          <div>
            {/* Info card */}
            {!scanning && !found && (
              <div className="card mb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
                    <Scan size={20} style={{ color: 'var(--amber)' }}/>
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Scan QR Code or Barcode</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      Supports QR codes, EAN-13, Code 128, Code 39, ITF, Data Matrix and other barcodes on equipment tags, packaging, and labels.
                    </p>
                  </div>
                </div>
                <button onClick={startCamera}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--amber)', color: '#000' }}>
                  <Camera size={16}/> Open Camera to Scan
                </button>
              </div>
            )}

            {/* Camera viewfinder */}
            {scanning && (
              <div className="card mb-4" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ position: 'relative', background: '#000' }}>
                  <video ref={videoRef} playsInline muted
                    style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }}/>

                  {/* Viewfinder overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {/* QR square guide */}
                    <div style={{ position: 'relative', width: 200, height: 200 }}>
                      <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 1000px rgba(0,0,0,0.45)', borderRadius: 8 }}/>
                      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
                        <div key={`${v}${h}`} style={{
                          position: 'absolute',
                          [v]: 0, [h]: 0,
                          width: 20, height: 20,
                          borderTop:    v === 'top'    ? '3px solid #f0a500' : 'none',
                          borderBottom: v === 'bottom' ? '3px solid #f0a500' : 'none',
                          borderLeft:   h === 'left'   ? '3px solid #f0a500' : 'none',
                          borderRight:  h === 'right'  ? '3px solid #f0a500' : 'none',
                        }}/>
                      ))}
                    </div>
                  </div>

                  {/* Barcode guide line below square */}
                  <div style={{ position: 'absolute', bottom: 60, left: '10%', right: '10%', height: 40,
                    border: '1.5px dashed rgba(240,165,0,0.4)', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: 9, color: 'rgba(240,165,0,0.6)', letterSpacing: '0.1em' }}>BARCODE ZONE</span>
                  </div>

                  <canvas ref={canvasRef} style={{ display: 'none' }}/>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-bold animate-pulse" style={{ color: 'var(--amber)' }}>Scanning…</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>QR code or barcode</p>
                  </div>
                  <button onClick={stopCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    <X size={12}/> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Found in EMMI */}
            {found && !found.notFound && (
              <div className="card mb-4" style={{ border: '1px solid rgba(52,208,88,0.3)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0 }}/>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Equipment Found</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{found.scanType} scanned successfully</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-3 space-y-1" style={{ background: 'var(--surface)' }}>
                  <p className="text-base font-bold" style={{ color: '#fff' }}>{found.name}</p>
                  <p className="font-mono text-sm" style={{ color: 'var(--amber)' }}>{found.tag_id}</p>
                  {found.location     && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>📍 {found.location}</p>}
                  {found.manufacturer && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>🏭 {found.manufacturer}</p>}
                  {found.model        && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>🔩 {found.model}</p>}
                  {found.voltage_rating && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>⚡ {found.voltage_rating}</p>}
                </div>
                <div className="flex gap-2 mb-2">
                  <Link href={`/equipment/${found.id}`} className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: 'var(--amber)', color: '#000' }}>
                      Open Full Profile →
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
                  className="w-full py-2 text-xs" style={{ color: 'var(--text-3)' }}>
                  Scan another →
                </button>
              </div>
            )}

            {/* Scanned but not in EMMI */}
            {found?.notFound && (
              <div className="card mb-4" style={{ border: '1px solid rgba(240,165,0,0.3)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Info size={16} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
                  <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
                    {found.scanType} Scanned — Not in EMMI
                  </p>
                </div>
                <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface)' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Scanned value</p>
                  <p className="font-mono text-sm font-bold" style={{ color: '#fff' }}>{found.rawValue}</p>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
                  This code is not linked to any equipment yet. You can photograph the nameplate to extract specs and add it to your equipment list.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => switchMode('nameplate')}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.3)' }}>
                    📷 Read Nameplate
                  </button>
                  <Link href="/equipment/new" className="flex-1">
                    <button className="w-full py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                      + Add Equipment
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !found && (
              <div className="card p-3 mb-4" style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--red)' }}>{error}</p>
                <button onClick={() => { setError(''); startCamera(); }}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)' }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            MODE 2 — NAMEPLATE AI
        ════════════════════════════════════════════════ */}
        {mode === 'nameplate' && (
          <div>
            {/* Instructions */}
            <div className="card mb-4" style={{ background: 'rgba(74,158,255,0.05)', border: '1px solid rgba(74,158,255,0.2)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.25)' }}>
                  <FileImage size={18} style={{ color: 'var(--blue)' }}/>
                </div>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>AI Nameplate Reader</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Photograph the equipment nameplate and the AI will extract: manufacturer, model, serial number, voltage, power rating, speed, IP rating, insulation class and all other visible specs.
                  </p>
                  <p className="text-xs mt-1.5 font-semibold" style={{ color: 'var(--blue)' }}>
                    💡 Tip: Use good lighting. Get close. Avoid reflections.
                  </p>
                </div>
              </div>
            </div>

            {/* Photo capture buttons */}
            {!capturedImg && !analysing && (
              <div className="flex gap-3 mb-4">
                <button onClick={() => photoRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl font-bold"
                  style={{ background: 'var(--card)', border: '2px dashed rgba(240,165,0,0.3)', color: 'var(--amber)' }}>
                  <Camera size={28}/>
                  <span className="text-xs">Take Photo</span>
                </button>
                <button onClick={() => {
                  const inp = document.createElement('input');
                  inp.type = 'file'; inp.accept = 'image/*';
                  inp.onchange = (e) => handleNameplateCapture((e.target as HTMLInputElement).files);
                  inp.click();
                }}
                  className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl font-bold"
                  style={{ background: 'var(--card)', border: '2px dashed rgba(74,158,255,0.3)', color: 'var(--blue)' }}>
                  <FileImage size={28}/>
                  <span className="text-xs">Choose Photo</span>
                </button>
              </div>
            )}

            {/* Hidden camera input */}
            <input
              ref={photoRef} type="file" accept="image/*" capture="environment"
              className="hidden"
              onChange={e => handleNameplateCapture(e.target.files)}
            />

            {/* Analysing spinner */}
            {analysing && (
              <div className="card text-center py-10 mb-4">
                <Loader2 size={36} className="animate-spin mx-auto mb-3" style={{ color: 'var(--blue)' }}/>
                <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Reading Nameplate…</p>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>AI is extracting all specs. Usually takes 3–6 seconds.</p>
              </div>
            )}

            {/* Nameplate error */}
            {nameplateErr && (
              <div className="card mb-4" style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{nameplateErr}</p>
                <button onClick={() => { setCapturedImg(null); setNameplateErr(''); }}
                  className="text-xs px-3 py-2 rounded-lg font-bold"
                  style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)' }}>
                  Try Again
                </button>
              </div>
            )}

            {/* Results */}
            {nameplateData && !analysing && (
              <div>
                {/* Captured image thumbnail */}
                {capturedImg && (
                  <div className="flex items-center gap-3 card mb-4" style={{ padding: '10px 14px' }}>
                    <img src={capturedImg} alt="Nameplate" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: '#fff' }}>Nameplate captured</p>
                      <p style={{ fontSize: 10, color: nameplateData.confidence === 'high' ? 'var(--green)' : nameplateData.confidence === 'medium' ? 'var(--amber)' : 'var(--red)' }}>
                        Confidence: {nameplateData.confidence}
                      </p>
                    </div>
                    <button onClick={() => { setCapturedImg(null); setNameplateData(null); setSaveOk(false); }}
                      style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={16}/>
                    </button>
                  </div>
                )}

                {/* Extracted specs */}
                <div className="card mb-4">
                  <p className="text-sm font-bold mb-3" style={{ color: 'var(--amber)' }}>📋 Extracted Nameplate Data</p>
                  <SpecRow label="Equipment Type"    value={nameplateData.equipment_name}    />
                  <SpecRow label="Manufacturer"      value={nameplateData.manufacturer}       />
                  <SpecRow label="Model"             value={nameplateData.model}              />
                  <SpecRow label="Serial Number"     value={nameplateData.serial_number}      />
                  <SpecRow label="Voltage Rating"    value={nameplateData.voltage_rating}     />
                  <SpecRow label="Current Rating"    value={nameplateData.current_rating}     />
                  <SpecRow label="Power Rating"      value={nameplateData.power_rating}       />
                  <SpecRow label="Frequency"         value={nameplateData.frequency}          />
                  <SpecRow label="Speed (RPM)"       value={nameplateData.speed_rpm}          />
                  <SpecRow label="Power Factor"      value={nameplateData.power_factor}       />
                  <SpecRow label="Efficiency"        value={nameplateData.efficiency}         />
                  <SpecRow label="IP Rating"         value={nameplateData.ip_rating}          />
                  <SpecRow label="Insulation Class"  value={nameplateData.insulation_class}   />
                  <SpecRow label="Duty Cycle"        value={nameplateData.duty_cycle}         />
                  <SpecRow label="Standards"         value={nameplateData.standards}          />
                  <SpecRow label="Weight"            value={nameplateData.weight_kg ? `${nameplateData.weight_kg} kg` : null} />
                  <SpecRow label="Country of Origin" value={nameplateData.country_of_origin}  />
                  <SpecRow label="Year of Manufacture" value={nameplateData.year_of_manufacture} />
                  <SpecRow label="Additional Specs"  value={nameplateData.additional_specs}   />
                  {nameplateData.notes && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Note: {nameplateData.notes}</p>
                    </div>
                  )}
                </div>

                {/* Save button */}
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
                  className="w-full py-2 text-xs" style={{ color: 'var(--text-3)' }}>
                  ← Scan another nameplate
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            MODE 3 — GENERATE QR CODE
        ════════════════════════════════════════════════ */}
        {mode === 'generate' && (
          <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              Select equipment to generate its QR code. Print and stick on the physical equipment.
            </p>

            <div className="flex items-center gap-2 form-input mb-4" style={{ padding: '0 12px' }}>
              <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
              <input value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                placeholder="Search by tag or name…"
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
                    {equipment.length === 0 ? 'No equipment added yet' : 'No matches found'}
                  </p>
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
                  <p className="text-base font-bold mb-0.5" style={{ color: '#fff' }}>{selectedEq?.name}</p>
                  <p className="font-mono text-sm mb-4" style={{ color: 'var(--amber)' }}>{selectedEq?.tag_id}</p>
                  <div className="flex justify-center mb-4">
                    <QRImage value={`emmi://equipment/${selectedEq?.tag_id}`} size={220}/>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                    Encodes: <span className="font-mono">emmi://equipment/{selectedEq?.tag_id}</span>
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Screenshot → print → stick on equipment. Scan with EMMI scanner to instantly open this equipment.
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