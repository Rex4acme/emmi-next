'use client';
// app/faults/[id]/page.tsx — Fault Detail with AI Analysis + Chat Memory

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getFaultById, getResolutions, updateFault, deleteFault } from '@/lib/db';
import { analyzeFault, askQuestion, type ChatMessage } from '@/lib/ai';
import { fmtDatetime, fmtRelative, severityDot, statusLabel, fmtDuration } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Edit, Trash2, Loader2, ArrowLeft, Brain, Plus,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  Send, Trash, Zap,
} from 'lucide-react';
import type { Fault, Resolution } from '@/types';

export default function FaultDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [fault,       setFault]       = useState<Fault | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deleting,    setDeleting]    = useState(false);
  const [showPhotos,  setShowPhotos]  = useState(false);

  // AI state
  const [aiResult,     setAiResult]     = useState<any>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [chatHistory,  setChatHistory]  = useState<ChatMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user'|'ai'; text: string }[]>([]);
  const [followUp,     setFollowUp]     = useState('');
  const [chatLoading,  setChatLoading]  = useState(false);

  useEffect(() => {
    async function load() {
      const [f, r] = await Promise.all([
        getFaultById(supabase, id),
        getResolutions(supabase, id),
      ]);
      setFault(f);
      setResolutions(r);
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Run AI analysis ───────────────────────────────────────
  async function handleAnalyse() {
    if (!fault) return;
    setAiLoading(true);
    const result = await analyzeFault(fault);
    setAiResult(result);
    // Seed chat history with fault context so follow-up questions have memory
    if (result.ok) {
      setChatHistory([{
        role: 'assistant',
        content: `I have analysed this fault: "${fault.title}". Summary: ${result.summary}. Probable causes include: ${result.probable_causes?.map((c: any) => c.cause).join(', ')}.`
      }]);
    }
    setAiLoading(false);
  }

  // ── Follow-up question with memory ────────────────────────
  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followUp.trim() || chatLoading) return;

    const q = followUp.trim();
    setFollowUp('');
    setChatLoading(true);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);

    try {
      const context = fault ? `Fault: ${fault.title}, Equipment: ${fault.equipment?.name}, Severity: ${fault.severity}` : '';
      const result  = await askQuestion(q, context, chatHistory);

      const aiText = result.ok
        ? [result.summary, result.key_points?.length ? '• ' + result.key_points.join('\n• ') : '', result.safety_note ? '⚠ ' + result.safety_note : '', result.next_step ? '→ ' + result.next_step : ''].filter(Boolean).join('\n\n')
        : result.error || 'AI unavailable';

      setChatMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      setChatHistory(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: aiText }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + err.message }]);
    }
    setChatLoading(false);
  }

  // ── Clear AI + chat ───────────────────────────────────────
  function clearAI() {
    setAiResult(null);
    setChatMessages([]);
    setChatHistory([]);
  }

  // ── Status change ─────────────────────────────────────────
  async function changeStatus(status: Fault['status']) {
    if (!fault) return;
    const updated = await updateFault(supabase, fault.id, { status });
    setFault(updated);
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (!fault || !confirm('Delete this fault?')) return;
    setDeleting(true);
    await deleteFault(supabase, fault.id);
    router.push('/faults');
  }

  if (loading) return <AppShell title="Fault"><div className="flex justify-center py-12"><div className="loading-dots"><span/><span/><span/></div></div></AppShell>;
  if (!fault)  return <AppShell title="Not Found"><div className="card text-center py-12"><p style={{ color: 'var(--text-2)' }}>Fault not found</p><Link href="/faults"><button className="mt-3 text-sm" style={{ color: 'var(--amber)' }}>← Back</button></Link></div></AppShell>;

  const severityColor = { low: 'var(--green)', medium: 'var(--amber)', high: '#f0a500', critical: 'var(--red)' }[fault.severity];

  return (
    <AppShell
      title="Fault Detail"
      action={
        <div className="flex items-center gap-2">
          <Link href={`/faults/${fault.id}/edit`}>
            <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}><Edit size={15}/></button>
          </Link>
          <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg"
            style={{ color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}>
            {deleting ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
          </button>
        </div>
      }
    >
      <Link href="/faults" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> All Faults
      </Link>

      {/* Fault header */}
      <div className="card mb-4" style={{ borderLeft: `3px solid ${severityColor}` }}>
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="tag-chip font-mono">{fault.fault_code || fault.id.slice(0,8).toUpperCase()}</span>
              <span>{severityDot(fault.severity)}</span>
            </div>
            <h2 className="text-base font-bold leading-snug">{fault.title}</h2>
            {fault.equipment && <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{fault.equipment.tag_id} — {fault.equipment.name}</p>}
          </div>
        </div>

        {/* Quick status change */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(['open','under_investigation','resolved','recurring'] as const).map(s => (
            <button key={s} onClick={() => changeStatus(s)} className="chip text-xs transition-all"
              style={{
                background: fault.status === s ? 'rgba(240,165,0,0.2)' : 'var(--surface)',
                color:      fault.status === s ? 'var(--amber)' : 'var(--text-2)',
                border:     fault.status === s ? '1px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                fontWeight: fault.status === s ? '700' : '500',
              }}>
              {statusLabel(s)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Detected', value: fmtDatetime(fault.detected_at) },
            { label: 'Detected By', value: fault.detected_by },
            { label: 'Location', value: fault.fault_location },
            { label: 'Circuit', value: fault.affected_circuit },
            { label: 'Safety', value: fault.safety_impact },
            { label: 'Downtime', value: fault.downtime_minutes ? fmtDuration(fault.downtime_minutes) : null },
          ].filter(i => i.value).map(({ label, value }) => (
            <div key={label}>
              <p style={{ color: 'var(--text-3)' }}>{label}</p>
              <p className="font-medium mt-0.5" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        {fault.description && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{fault.description}</p>
          </div>
        )}
      </div>

      {/* ── AI Analysis + Follow-up Chat ─────────────────────── */}
      <div className="card mb-4" style={{ border: '1px solid rgba(163,113,247,0.2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(163,113,247,0.15)' }}>
              <Zap size={14} style={{ color: 'var(--purple)' }}/>
            </div>
            <span className="text-sm font-bold">AI Fault Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            {(aiResult || chatMessages.length > 0) && (
              <button onClick={clearAI} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                <Trash size={10}/> Clear
              </button>
            )}
            <button onClick={handleAnalyse} disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
              {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12}/>}
              {aiResult ? 'Re-analyse' : 'Analyse'}
            </button>
          </div>
        </div>

        {aiLoading && (
          <div className="flex items-center gap-2 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--purple)' }}/>
            Analysing fault with AI…
          </div>
        )}

        {!aiResult && !aiLoading && (
          <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>
            Tap Analyse to get AI-powered root cause analysis and recommended actions.
          </p>
        )}

        {aiResult && !aiLoading && (
          <div className="space-y-3 text-xs">
            {aiResult.ok ? (
              <>
                <div className="p-3 rounded-lg" style={{ background: 'rgba(163,113,247,0.06)', border: '1px solid rgba(163,113,247,0.15)' }}>
                  <p style={{ color: 'var(--text)' }}>{aiResult.summary}</p>
                  {aiResult.confidence && (
                    <p className="mt-1.5 font-semibold" style={{ color: 'var(--purple)' }}>Confidence: {aiResult.confidence}</p>
                  )}
                </div>

                {aiResult.probable_causes?.length > 0 && (
                  <div>
                    <p className="font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)', fontSize: 10 }}>Probable Causes</p>
                    {aiResult.probable_causes.map((c: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-2 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                        <span className="font-bold mt-0.5 flex-shrink-0" style={{ color: c.likelihood === 'high' ? 'var(--red)' : c.likelihood === 'medium' ? 'var(--amber)' : 'var(--green)' }}>
                          {c.likelihood === 'high' ? '●' : c.likelihood === 'medium' ? '◐' : '○'}
                        </span>
                        <div><p className="font-semibold">{c.cause}</p><p style={{ color: 'var(--text-2)' }}>{c.explanation}</p></div>
                      </div>
                    ))}
                  </div>
                )}

                {aiResult.recommended_actions?.length > 0 && (
                  <div>
                    <p className="font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)', fontSize: 10 }}>Recommended Actions</p>
                    {aiResult.recommended_actions.map((a: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-2 p-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'rgba(240,165,0,0.2)', color: 'var(--amber)', fontSize: 10 }}>{a.step}</span>
                        <div><p className="font-semibold">{a.action}</p><p style={{ color: 'var(--text-2)' }}>{a.detail}</p>{a.tools && <p className="mt-0.5" style={{ color: 'var(--text-3)' }}>🔧 {a.tools}</p>}</div>
                      </div>
                    ))}
                  </div>
                )}

                {aiResult.safety_warnings?.length > 0 && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)' }}>
                    <p className="font-bold mb-1" style={{ color: 'var(--red)' }}>⚠ Safety Warnings</p>
                    {aiResult.safety_warnings.map((w: string, i: number) => <p key={i} style={{ color: 'var(--text-2)' }}>• {w}</p>)}
                  </div>
                )}

                {aiResult.prevention_tip && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(52,208,88,0.08)', border: '1px solid rgba(52,208,88,0.2)' }}>
                    <p className="font-bold mb-1" style={{ color: 'var(--green)' }}>Prevention</p>
                    <p style={{ color: 'var(--text-2)' }}>{aiResult.prevention_tip}</p>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--red)' }}>⚠ {aiResult.error}</p>
            )}
          </div>
        )}

        {/* Follow-up chat with memory */}
        {aiResult && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-3)' }}>ASK FOLLOW-UP</p>
            {chatMessages.length > 0 && (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-xs rounded-2xl px-3 py-2 text-xs" style={{
                      background:   m.role === 'user' ? 'rgba(240,165,0,0.15)' : 'var(--surface)',
                      border:       m.role === 'user' ? '1px solid rgba(240,165,0,0.3)' : '1px solid var(--border)',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      whiteSpace:   'pre-wrap',
                    }}>{m.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="loading-dots"><span/><span/><span/></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>
            )}
            <form onSubmit={handleFollowUp} className="flex gap-2">
              <input value={followUp} onChange={e => setFollowUp(e.target.value)}
                placeholder="Ask more about this fault…" className="flex-1 form-input" style={{ fontSize: 12 }}/>
              <button type="submit" disabled={chatLoading || !followUp.trim()}
                className="p-2 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(163,113,247,0.2)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
                {chatLoading ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Photos */}
      {fault.photo_urls && fault.photo_urls.length > 0 && (
        <div className="card mb-4">
          <button onClick={() => setShowPhotos(!showPhotos)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}>
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

      {/* Resolutions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle size={14} style={{ color: 'var(--green)' }}/>
            Resolutions ({resolutions.length})
          </h3>
          <Link href={`/faults/${fault.id}/resolution/new`}>
            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
              <Plus size={11}/>Add Resolution
            </button>
          </Link>
        </div>
        {resolutions.length === 0 ? (
          <p className="text-xs px-1" style={{ color: 'var(--text-3)' }}>No resolution recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {resolutions.map(r => (
              <div key={r.id} className="card" style={{ padding: '10px 12px' }}>
                <p className="text-xs font-bold">{r.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{r.root_cause}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{fmtRelative(r.resolved_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </AppShell>
  );
}
