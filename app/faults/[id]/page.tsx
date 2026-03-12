'use client';
// app/faults/[id]/page.tsx — Fault Detail Page
// Shows full fault info, AI analysis, photo gallery, linked resolutions
// and actions: edit, change status, add resolution, delete.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getFaultById, getResolutionsForFault, updateFault, deleteFault } from '@/lib/db';
import { analyzeFault } from '@/lib/ai';
import { fmtDatetime, fmtDuration, severityDot, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Edit, Trash2, Plus, Brain, AlertCircle, ChevronDown,
  ChevronUp, Loader2, CheckCircle, ArrowLeft
} from 'lucide-react';
import type { Fault, Resolution } from '@/types';

export default function FaultDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [fault,       setFault]       = useState<Fault | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [aiResult,    setAiResult]    = useState<any>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [showPhotos,  setShowPhotos]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  // ── Load fault + resolutions ──────────────────────────────
  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [f, r] = await Promise.all([
          getFaultById(supabase, id),
          getResolutionsForFault(supabase, id),
        ]);
        setFault(f);
        setResolutions(r || []);
      } catch (err) {
        console.error('Fault load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── AI Fault Analysis ─────────────────────────────────────
  async function handleAnalyze() {
    if (!fault) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await analyzeFault(fault);
      setAiResult(result);
    } catch (err: any) {
      setAiResult({ ok: false, error: err.message || 'AI unavailable. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  }

  // ── Quick status change ───────────────────────────────────
  async function changeStatus(status: Fault['status']) {
    if (!fault) return;
    const updated = await updateFault(supabase, fault.id, { status });
    setFault(updated);
  }

  // ── Delete fault ──────────────────────────────────────────
  async function handleDelete() {
    if (!fault || !confirm('Delete this fault? This cannot be undone.')) return;
    setDeleting(true);
    await deleteFault(supabase, fault.id);
    router.push('/faults');
  }

  if (loading) {
    return (
      <AppShell title="Fault Detail">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  if (!fault) {
    return (
      <AppShell title="Not Found">
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-2)' }}>Fault not found</p>
          <Link href="/faults"><button className="mt-3 text-sm" style={{ color: 'var(--amber)' }}>← Back</button></Link>
        </div>
      </AppShell>
    );
  }

  const severityBorderColor = {
    critical: 'var(--red)',
    high:     'var(--amber)',
    medium:   '#d29922',
    low:      'var(--green)',
  }[fault.severity];

  return (
    <AppShell
      title="Fault Detail"
      action={
        <div className="flex items-center gap-2">
          <Link href={`/faults/${fault.id}/edit`}>
            <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              <Edit size={15}/>
            </button>
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}>
            {deleting ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
          </button>
        </div>
      }
    >
      {/* Back link */}
      <Link href="/faults" className="flex items-center gap-1 text-xs mb-4"
        style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> All Faults
      </Link>

      {/* ── Fault header card ────────────────────────────── */}
      <div className="card mb-4" style={{ borderLeft: `3px solid ${severityBorderColor}` }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {fault.fault_code && (
              <span className="tag-chip mb-2 inline-block">{fault.fault_code}</span>
            )}
            <h2 className="text-lg font-bold leading-snug">{fault.title}</h2>
          </div>
          <span className="text-2xl">{severityDot(fault.severity)}</span>
        </div>

        {/* Status quick-change pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(['open', 'under_investigation', 'resolved', 'recurring'] as const).map(s => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className="chip text-xs transition-all"
              style={{
                background: fault.status === s ? 'rgba(240,165,0,0.2)' : 'var(--surface)',
                color:      fault.status === s ? 'var(--amber)' : 'var(--text-2)',
                border:     fault.status === s ? '1px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                fontWeight: fault.status === s ? '700' : '500',
              }}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>

        {/* Key metadata grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Equipment',    value: fault.equipment ? `${fault.equipment.tag_id} — ${fault.equipment.name}` : '—' },
            { label: 'Category',     value: fault.fault_category ? `${fault.fault_category.icon} ${fault.fault_category.name}` : '—' },
            { label: 'Detected',     value: fmtDatetime(fault.detected_at) },
            { label: 'Severity',     value: `${severityDot(fault.severity)} ${fault.severity}` },
            { label: 'Safety Impact',value: fault.safety_impact || '—' },
            { label: 'Downtime',     value: fmtDuration(fault.downtime_minutes) },
            { label: 'Detected By',  value: fault.detected_by || '—' },
            { label: 'Circuit',      value: fault.affected_circuit || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ color: 'var(--text-3)' }}>{label}</p>
              <p className="font-medium mt-0.5" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      {fault.description && (
        <div className="card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Description</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{fault.description}</p>
        </div>
      )}

      {/* Symptoms */}
      {fault.symptoms && fault.symptoms.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Symptoms Observed</h3>
          <div className="flex flex-wrap gap-2">
            {fault.symptoms.map((s, i) => (
              <span key={i} className="chip text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {fault.photo_urls && fault.photo_urls.length > 0 && (
        <div className="card mb-4">
          <button
            onClick={() => setShowPhotos(!showPhotos)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}
          >
            Photos ({fault.photo_urls.length})
            {showPhotos ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {showPhotos && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {fault.photo_urls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="aspect-square relative rounded-lg overflow-hidden block"
                  style={{ border: '1px solid var(--border)' }}>
                  <Image src={url} alt={`Photo ${i+1}`} fill className="object-cover" sizes="100px"/>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AI Analysis panel ─────────────────────────────── */}
      <div className="card mb-4" style={{ border: '1px solid rgba(163,113,247,0.25)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={16} style={{ color: 'var(--purple)' }}/>
            <span className="text-sm font-bold" style={{ color: 'var(--purple)' }}>AI Fault Analysis</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(163,113,247,0.2)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12}/>}
            {aiResult ? 'Re-analyse' : 'Analyse'}
          </button>
        </div>

        {aiLoading && (
          <div className="flex items-center gap-3 py-4">
            <div className="loading-dots"><span/><span/><span/></div>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>Analysing fault… (up to 30s)</span>
          </div>
        )}

        {!aiResult && !aiLoading && (
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Tap Analyse to get AI-powered root cause analysis and recommended actions.
          </p>
        )}

        {aiResult && !aiLoading && (
          <div className="space-y-4">
            {aiResult.ok ? (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Summary</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{aiResult.summary}</p>
                  {aiResult.confidence && (
                    <span className="text-xs mt-1 inline-block" style={{ color: 'var(--text-3)' }}>
                      Confidence: {aiResult.confidence}
                    </span>
                  )}
                </div>

                {aiResult.probable_causes?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Probable Causes</p>
                    <div className="space-y-2">
                      {aiResult.probable_causes.map((c: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{c.cause}</span>
                            <span className="text-xs" style={{
                              color: c.likelihood === 'high' ? 'var(--red)' : c.likelihood === 'medium' ? 'var(--amber)' : 'var(--text-2)'
                            }}>{c.likelihood}</span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-2)' }}>{c.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.recommended_actions?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Recommended Actions</p>
                    <div className="space-y-2">
                      {aiResult.recommended_actions.map((a: any) => (
                        <div key={a.step} className="flex gap-3 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--amber)', color: '#000' }}>{a.step}</span>
                          <div>
                            <p className="text-xs font-semibold">{a.action}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{a.detail}</p>
                            {a.tools && <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-3)' }}>Tools: {a.tools}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.safety_warnings?.length > 0 && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--red)' }}>⚠ Safety Warnings</p>
                    {aiResult.safety_warnings.map((w: string, i: number) => (
                      <p key={i} className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>• {w}</p>
                    ))}
                  </div>
                )}

                {aiResult.prevention_tip && (
                  <div className="p-2 rounded" style={{ background: 'rgba(52,208,88,0.08)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--green)' }}>Prevention</p>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{aiResult.prevention_tip}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} style={{ color: 'var(--red)' }}/>
                <p className="text-xs" style={{ color: 'var(--red)' }}>{aiResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Resolutions ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Resolutions ({resolutions.length})</h3>
          <Link href={`/faults/${fault.id}/resolution/new`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--green)', color: '#000' }}>
              <Plus size={12}/>Add Resolution
            </button>
          </Link>
        </div>

        {resolutions.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>No resolutions logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resolutions.map(res => (
              <div key={res.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={14} style={{ color: res.outcome === 'resolved' ? 'var(--green)' : 'var(--amber)' }}/>
                      <span className="text-sm font-semibold">{res.title}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {fmtDatetime(res.resolved_at)} · {res.resolved_by || 'Unknown'}
                    </p>
                    {res.root_cause && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-3)' }}>
                        Root cause: {res.root_cause.slice(0, 80)}…
                      </p>
                    )}
                  </div>
                  <span className="chip text-xs flex-shrink-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {res.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </AppShell>
  );
}
