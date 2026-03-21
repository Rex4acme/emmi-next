'use client';
// app/feed/page.tsx — Plant Activity Feed
// Engineers can post updates, safety alerts, AND raise parts/equipment requests
// directly from the feed. All posts visible to entire org in real time.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getPlantFeed, getEquipment } from '@/lib/db';
import { fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Moon, RefreshCw, User, Zap, Users, Sun, Sunset,
  Send, Loader2, MessageSquare, X, Package, ShoppingCart,
  AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2,
} from 'lucide-react';
import type { FeedItem } from '@/types';

// ── Severity colours ──────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: '#d29922', low: 'var(--green)',
};
const FAULT_STATUS_COLOR: Record<string, string> = {
  open: 'var(--red)', under_investigation: 'var(--amber)',
  resolved: 'var(--green)', recurring: '#a371f7',
};
const ACT_STATUS_COLOR: Record<string, string> = {
  planned: 'var(--blue)', in_progress: 'var(--amber)',
  completed: 'var(--green)', cancelled: 'var(--text-3)',
};
const SHIFT_ICON: Record<string, React.ReactNode> = {
  day: <Sun size={13}/>, afternoon: <Sunset size={13}/>, night: <Moon size={13}/>,
};

// ── Post categories ───────────────────────────────────────────
const POST_CATEGORIES = [
  { value: 'update',      label: '📢 Update',          color: 'var(--blue)'   },
  { value: 'safety',      label: '⚠️ Safety Alert',     color: 'var(--red)'    },
  { value: 'observation', label: '🔍 Observation',      color: 'var(--amber)'  },
  { value: 'handover',    label: '🔄 Handover',         color: 'var(--purple)' },
  { value: 'milestone',   label: '🏆 Achievement',      color: 'var(--green)'  },
  { value: 'reminder',    label: '🔔 Reminder',         color: '#d29922'       },
  { value: 'parts_req',   label: '🔩 Parts Request',    color: '#79c0ff'       },
  { value: 'equip_req',   label: '⚙️ Equipment Request', color: '#bc8cff'      },
];

// ── Part request line item ────────────────────────────────────
interface PartLine { id: string; name: string; qty: string; partNo: string; urgency: string; }

function genId() { return Math.random().toString(36).slice(2, 8); }

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ profile, size = 32 }: { profile?: any; size?: number }) {
  if (profile?.avatar_url) {
    return (
      <Image src={profile.avatar_url} alt={profile.full_name || ''} width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, border: '1.5px solid var(--border)' }}/>
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <User size={size * 0.45} style={{ color: 'var(--amber)' }}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// POST COMPOSER
// ══════════════════════════════════════════════════════════════
function PostComposer({
  profile, orgId, equipment, onPosted,
}: { profile: any; orgId: string; equipment: any[]; onPosted: () => void }) {
  const supabase   = createBrowserClient();
  const [open,     setOpen]     = useState(false);
  const [text,     setText]     = useState('');
  const [category, setCategory] = useState('update');
  const [posting,  setPosting]  = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Parts request fields
  const [partLines,     setPartLines]     = useState<PartLine[]>([{ id: genId(), name: '', qty: '1', partNo: '', urgency: 'medium' }]);
  const [equipTag,      setEquipTag]      = useState('');
  const [partsReason,   setPartsReason]   = useState('');

  // Equipment request fields
  const [equipReqName,  setEquipReqName]  = useState('');
  const [equipReqSpec,  setEquipReqSpec]  = useState('');
  const [equipReqReason,setEquipReqReason]= useState('');
  const [equipReqUrgency,setEquipReqUrgency] = useState('medium');

  useEffect(() => { if (open && taRef.current) taRef.current.focus(); }, [open]);

  function addPartLine() {
    setPartLines(p => [...p, { id: genId(), name: '', qty: '1', partNo: '', urgency: 'medium' }]);
  }
  function removePartLine(id: string) {
    setPartLines(p => p.filter(l => l.id !== id));
  }
  function updatePartLine(id: string, field: keyof PartLine, value: string) {
    setPartLines(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  const isPartsReq = category === 'parts_req';
  const isEquipReq = category === 'equip_req';

  // Build the summary string stored in shift_log.summary
  function buildSummary(): string {
    if (isPartsReq) {
      const lines = partLines.filter(l => l.name.trim());
      const partsList = lines.map(l =>
        `• ${l.qty}× ${l.name.trim()}${l.partNo ? ` [${l.partNo}]` : ''} (${l.urgency})`
      ).join('\n');
      const equipInfo = equipTag ? `\nFor equipment: ${equipTag}` : '';
      const reasonInfo = partsReason.trim() ? `\nReason: ${partsReason.trim()}` : '';
      return `[parts_req] Parts Replacement/Purchase Request\n${partsList}${equipInfo}${reasonInfo}`;
    }
    if (isEquipReq) {
      const spec = equipReqSpec.trim() ? `\nSpec/Model: ${equipReqSpec.trim()}` : '';
      const reason = equipReqReason.trim() ? `\nReason: ${equipReqReason.trim()}` : '';
      const urg = `\nUrgency: ${equipReqUrgency}`;
      return `[equip_req] Equipment Purchase Request: ${equipReqName.trim()}${spec}${reason}${urg}`;
    }
    return `[${category}] ${text.trim()}`;
  }

  function isValid(): boolean {
    if (isPartsReq) return partLines.some(l => l.name.trim());
    if (isEquipReq) return !!equipReqName.trim();
    return !!text.trim();
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid() || !orgId) return;
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('shift_logs').insert({
        user_id:        user.id,
        org_id:         orgId,
        shift_type:     'day',
        shift_date:     new Date().toISOString().split('T')[0],
        summary:        buildSummary(),
        logged_by_name: profile?.full_name || 'Engineer',
      });
      // Reset
      setText(''); setCategory('update');
      setPartLines([{ id: genId(), name: '', qty: '1', partNo: '', urgency: 'medium' }]);
      setEquipTag(''); setPartsReason('');
      setEquipReqName(''); setEquipReqSpec(''); setEquipReqReason(''); setEquipReqUrgency('medium');
      setOpen(false);
      onPosted();
    } catch (err: any) {
      alert('Post failed: ' + err.message);
    }
    setPosting(false);
  }

  const cat = POST_CATEGORIES.find(c => c.value === category) || POST_CATEGORIES[0];

  return (
    <div className="mb-4">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-left transition-all"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <Avatar profile={profile} size={28}/>
          <span className="flex-1">Post update, parts request, safety alert…</span>
          <MessageSquare size={16} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
        </button>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid rgba(240,165,0,0.25)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Avatar profile={profile} size={26}/>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {profile?.full_name || 'Post to plant feed'}
              </span>
            </div>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--text-3)' }}><X size={16}/></button>
          </div>

          <form onSubmit={handlePost}>
            {/* Category pills */}
            <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
              {POST_CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: category === c.value ? `${c.color}25` : 'var(--surface)',
                    color:      category === c.value ? c.color : 'var(--text-3)',
                    border:     category === c.value ? `1px solid ${c.color}50` : '1px solid var(--border)',
                  }}>
                  {c.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-2">

              {/* ── Parts Request fields ─────────────────── */}
              {isPartsReq && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-bold" style={{ color: '#79c0ff' }}>
                    🔩 Parts Replacement / Purchase Request
                  </p>
                  {/* Part lines */}
                  {partLines.map((line, idx) => (
                    <div key={line.id} className="p-3 rounded-xl space-y-2"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>Item {idx + 1}</span>
                        {partLines.length > 1 && (
                          <button type="button" onClick={() => removePartLine(line.id)} style={{ color: 'var(--text-3)' }}>
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                      <input
                        className="form-input text-sm"
                        placeholder="Part name / description *"
                        value={line.name}
                        onChange={e => updatePartLine(line.id, 'name', e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="form-label" style={{ fontSize: 10 }}>Qty</label>
                          <input type="number" min="1" className="form-input text-sm font-mono"
                            placeholder="1" value={line.qty}
                            onChange={e => updatePartLine(line.id, 'qty', e.target.value)}/>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 10 }}>Part No.</label>
                          <input className="form-input text-sm font-mono" placeholder="Optional"
                            value={line.partNo}
                            onChange={e => updatePartLine(line.id, 'partNo', e.target.value)}/>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 10 }}>Urgency</label>
                          <select className="form-input text-sm" value={line.urgency}
                            onChange={e => updatePartLine(line.id, 'urgency', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addPartLine}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(121,192,255,0.1)', color: '#79c0ff', border: '1px solid rgba(121,192,255,0.25)' }}>
                    <Plus size={12}/> Add Another Part
                  </button>
                  {/* Related equipment */}
                  <div>
                    <label className="form-label">Related Equipment (optional)</label>
                    <select className="form-input text-sm" value={equipTag}
                      onChange={e => setEquipTag(e.target.value)}>
                      <option value="">— Select equipment —</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.tag_id}>{eq.tag_id} — {eq.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Reason / Justification</label>
                    <textarea className="form-input text-sm" rows={2}
                      placeholder="Why is this part needed? Fault reference, planned maintenance, etc."
                      value={partsReason} onChange={e => setPartsReason(e.target.value)}/>
                  </div>
                </div>
              )}

              {/* ── Equipment Request fields ─────────────── */}
              {isEquipReq && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-bold" style={{ color: '#bc8cff' }}>
                    ⚙️ New Equipment Purchase Request
                  </p>
                  <div>
                    <label className="form-label req">Equipment Name / Type</label>
                    <input className="form-input text-sm" placeholder="e.g. 100kVA Transformer, 22kW VFD drive"
                      value={equipReqName} onChange={e => setEquipReqName(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Specification / Model</label>
                    <input className="form-input text-sm"
                      placeholder="e.g. 11kV/415V, Dyn11, ONAN, 100kVA — Schneider Electric"
                      value={equipReqSpec} onChange={e => setEquipReqSpec(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Reason / Justification</label>
                    <textarea className="form-input text-sm" rows={2}
                      placeholder="Why is this equipment needed? Replacement, new installation, capacity upgrade…"
                      value={equipReqReason} onChange={e => setEquipReqReason(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Urgency</label>
                    <select className="form-input text-sm" value={equipReqUrgency}
                      onChange={e => setEquipReqUrgency(e.target.value)}>
                      <option value="low">Low — planned procurement</option>
                      <option value="medium">Medium — needed within a month</option>
                      <option value="high">High — needed within a week</option>
                      <option value="critical">Critical — immediate replacement needed</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ── Regular text post ────────────────────── */}
              {!isPartsReq && !isEquipReq && (
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={
                    category === 'safety'      ? 'Describe the safety concern or hazard…' :
                    category === 'observation' ? 'What did you observe? Equipment, location, reading…' :
                    category === 'handover'    ? 'Key points for the incoming shift…' :
                    category === 'milestone'   ? 'What was achieved? Equipment restored, job completed…' :
                    category === 'reminder'    ? 'What should colleagues remember or check?…' :
                    'Share an update with your plant colleagues…'
                  }
                  rows={4}
                  className="w-full text-sm leading-relaxed resize-none mt-2"
                  style={{ background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text)', caretColor: 'var(--amber)' }}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1"
              style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${cat.color}18`, color: cat.color, border: `1px solid ${cat.color}30` }}>
                {cat.label}
              </span>
              <button type="submit" disabled={!isValid() || posting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: !isValid() || posting ? 'var(--surface)' : 'var(--amber)',
                  color:      !isValid() || posting ? 'var(--text-3)' : '#000',
                }}>
                {posting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FEED CARDS
// ══════════════════════════════════════════════════════════════
function FeedCard({ item, currentUserId }: { item: FeedItem; currentUserId: string }) {
  const isOwn = item.user_id === currentUserId;
  const name  = item.profile?.full_name || 'Engineer';
  const title = item.profile?.title || '';

  if (item.type === 'fault' && item.fault) {
    const f = item.fault;
    return (
      <Link href={`/faults/${f.id}`}>
        <div className="card hover:border-white/20 transition-all"
          style={{ borderLeft: `3px solid ${SEV_COLOR[f.severity] || 'var(--border)'}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{isOwn ? 'You' : name}</span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="chip" style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)',
              border: '1px solid rgba(248,81,73,0.2)', fontSize: 9, padding: '1px 6px' }}>⚡ FAULT</span>
            <span className="chip" style={{ background: `${SEV_COLOR[f.severity]}18`, color: SEV_COLOR[f.severity],
              border: `1px solid ${SEV_COLOR[f.severity]}40`, fontSize: 9, padding: '1px 6px', textTransform: 'uppercase' }}>
              {f.severity}
            </span>
          </div>
          <p className="text-sm font-semibold mb-1">{f.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {f.equipment && <span className="tag-chip text-xs">{f.equipment.tag_id}</span>}
            {(f.fault_category as any) && <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {(f.fault_category as any).icon} {(f.fault_category as any).name}
            </span>}
            <span className="ml-auto text-xs font-medium" style={{ color: FAULT_STATUS_COLOR[f.status] || 'var(--text-3)' }}>
              {f.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'activity' && item.activity) {
    const a = item.activity;
    const sc = ACT_STATUS_COLOR[a.status] || 'var(--text-3)';
    return (
      <Link href={`/activities/${a.id}`}>
        <div className="card hover:border-white/20 transition-all" style={{ borderLeft: `3px solid ${sc}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{isOwn ? 'You' : name}</span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="chip" style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)',
              border: '1px solid rgba(74,158,255,0.2)', fontSize: 9, padding: '1px 6px' }}>🔧 ACTIVITY</span>
          </div>
          <p className="text-sm font-semibold mb-1">
            {(a.activity_type as any)?.icon || '🔧'} {a.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {a.equipment && <span className="tag-chip text-xs">{a.equipment.tag_id}</span>}
            {a.activity_type && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{(a.activity_type as any).name}</span>}
            <span className="ml-auto text-xs font-medium" style={{ color: sc }}>{a.status.replace('_', ' ')}</span>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'shift_log' && item.shift_log) {
    const s = item.shift_log;

    // ── Parts request post ─────────────────────────────────
    if (s.summary?.startsWith('[parts_req]')) {
      const body = s.summary.replace('[parts_req]', '').trim();
      const lines = body.split('\n');
      const heading = lines[0];
      const parts   = lines.slice(1).filter(l => l.startsWith('•'));
      const meta    = lines.slice(1).filter(l => !l.startsWith('•'));
      return (
        <div className="card" style={{ borderLeft: '3px solid #79c0ff' }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {isOwn ? 'You' : (s.logged_by_name || name)}
              </span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="chip" style={{ background: 'rgba(121,192,255,0.12)', color: '#79c0ff',
              border: '1px solid rgba(121,192,255,0.3)', fontSize: 9, padding: '1px 7px' }}>
              🔩 PARTS REQUEST
            </span>
          </div>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--text)' }}>{heading}</p>
          {parts.length > 0 && (
            <div className="rounded-xl p-2.5 mb-2 space-y-1"
              style={{ background: 'rgba(121,192,255,0.06)', border: '1px solid rgba(121,192,255,0.15)' }}>
              {parts.map((line, i) => {
                const urgMatch = line.match(/\((\w+)\)$/);
                const urgency  = urgMatch ? urgMatch[1] : 'medium';
                const urgColor = urgency === 'critical' ? 'var(--red)' : urgency === 'high' ? 'var(--amber)' : urgency === 'low' ? 'var(--green)' : '#d29922';
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {line.replace(/\s*\(\w+\)$/, '')}
                    </span>
                    <span className="chip flex-shrink-0" style={{ background: `${urgColor}18`, color: urgColor,
                      border: `1px solid ${urgColor}30`, fontSize: 8, padding: '1px 5px', textTransform: 'uppercase' }}>
                      {urgency}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {meta.map((line, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--text-3)' }}>{line}</p>
          ))}
        </div>
      );
    }

    // ── Equipment request post ─────────────────────────────
    if (s.summary?.startsWith('[equip_req]')) {
      const body   = s.summary.replace('[equip_req]', '').trim();
      const lines  = body.split('\n');
      const heading = lines[0];
      const meta   = lines.slice(1);
      const urgLine = meta.find(l => l.startsWith('Urgency:'));
      const urgency = urgLine?.replace('Urgency: ', '') || 'medium';
      const urgColor = urgency === 'critical' ? 'var(--red)' : urgency === 'high' ? 'var(--amber)' : urgency === 'low' ? 'var(--green)' : '#d29922';
      return (
        <div className="card" style={{ borderLeft: '3px solid #bc8cff' }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {isOwn ? 'You' : (s.logged_by_name || name)}
              </span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="chip" style={{ background: 'rgba(188,140,255,0.12)', color: '#bc8cff',
              border: '1px solid rgba(188,140,255,0.3)', fontSize: 9, padding: '1px 7px' }}>
              ⚙️ EQUIPMENT REQUEST
            </span>
            <span className="chip" style={{ background: `${urgColor}18`, color: urgColor,
              border: `1px solid ${urgColor}30`, fontSize: 9, padding: '1px 6px', textTransform: 'uppercase' }}>
              {urgency}
            </span>
          </div>
          <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{heading}</p>
          {meta.filter(l => !l.startsWith('Urgency:')).map((line, i) => (
            <p key={i} className="text-xs mb-0.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{line}</p>
          ))}
        </div>
      );
    }

    // ── General post (update, safety, observation, etc.) ───
    const postMatch = s.summary?.match(/^\[(\w+)\]\s*([\s\S]+)/);
    if (postMatch) {
      const [, catKey, postText] = postMatch;
      const cat = POST_CATEGORIES.find(c => c.value === catKey) || POST_CATEGORIES[0];
      return (
        <div className="card" style={{ borderLeft: `3px solid ${cat.color}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {isOwn ? 'You' : (s.logged_by_name || name)}
              </span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="chip" style={{ background: `${cat.color}18`, color: cat.color,
              border: `1px solid ${cat.color}30`, fontSize: 9, padding: '1px 7px' }}>
              {cat.label}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {postText}
          </p>
        </div>
      );
    }

    // ── Regular shift log ──────────────────────────────────
    return (
      <div className="card" style={{ borderLeft: '3px solid var(--purple)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Avatar profile={item.profile} size={28}/>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {isOwn ? 'You' : (s.logged_by_name || name)}
            </span>
            {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="chip" style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)',
            border: '1px solid rgba(163,113,247,0.2)', fontSize: 9, padding: '1px 6px' }}>
            {SHIFT_ICON[s.shift_type]} SHIFT LOG
          </span>
          <span className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>
            {s.shift_type} shift · {new Date(s.shift_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        {s.summary && <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.summary}</p>}
        {s.handover_notes && (
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(163,113,247,0.08)', border: '1px solid rgba(163,113,247,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--purple)' }}>Handover Note →</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.handover_notes}</p>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function FeedPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [feed,          setFeed]          = useState<FeedItem[]>([]);
  const [profile,       setProfile]       = useState<any>(null);
  const [equipment,     setEquipment]     = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [orgId,         setOrgId]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState<'all'|'posts'|'requests'|'faults'|'activities'|'shifts'>('all');

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    setCurrentUserId(user.id);
    const [p, eq, items] = await Promise.all([
      getProfile(supabase, user.id),
      getEquipment(supabase, user.id),
      getPlantFeed(supabase, 50),
    ]);
    setProfile(p);
    setEquipment(eq || []);
    setOrgId((p as any)?.org_id || null);
    setFeed(items);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  // Real-time
  useEffect(() => {
    const ch = supabase.channel('plant-feed-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faults' },     () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Filter logic
  const filtered = feed.filter(item => {
    if (filter === 'all')        return true;
    if (filter === 'faults')     return item.type === 'fault';
    if (filter === 'activities') return item.type === 'activity';
    if (filter === 'shifts') {
      return item.type === 'shift_log' && !item.shift_log?.summary?.match(/^\[.*\]/);
    }
    if (filter === 'posts') {
      const sum = item.shift_log?.summary || '';
      return item.type === 'shift_log' && !!sum.match(/^\[(update|safety|observation|handover|milestone|reminder)\]/);
    }
    if (filter === 'requests') {
      const sum = item.shift_log?.summary || '';
      return item.type === 'shift_log' && (sum.startsWith('[parts_req]') || sum.startsWith('[equip_req]'));
    }
    return true;
  });

  const requestCount = feed.filter(i => {
    const sum = i.shift_log?.summary || '';
    return i.type === 'shift_log' && (sum.startsWith('[parts_req]') || sum.startsWith('[equip_req]'));
  }).length;

  return (
    <AppShell
      title="Plant Feed"
      action={
        <button onClick={() => load(true)} disabled={refreshing}
          className="p-2 rounded-lg"
          style={{ color: 'var(--text-2)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
        </button>
      }
    >
      {/* Org banner */}
      {!orgId ? (
        <div className="card mb-4 flex items-start gap-3"
          style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <Users size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}/>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--amber)' }}>Set Plant ID to see colleagues</p>
            <p className="text-xs mb-2" style={{ color: 'var(--text-2)' }}>
              Add your Plant ID in your profile to see the full plant feed and post to colleagues.
            </p>
            <Link href="/profile">
              <button className="text-xs px-3 py-1.5 rounded-lg font-bold"
                style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                Set Plant ID →
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="card mb-4 flex items-center gap-2 py-2.5"
          style={{ background: 'rgba(52,208,88,0.05)', border: '1px solid rgba(52,208,88,0.15)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)', flexShrink: 0 }}/>
          <p className="text-xs" style={{ color: 'var(--green)' }}>
            Live — Plant <span className="font-bold font-mono">{orgId}</span>
          </p>
          <Link href="/shift-log/new" className="ml-auto">
            <button className="text-xs px-2.5 py-1 rounded-lg font-bold"
              style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.25)' }}>
              + Shift Log
            </button>
          </Link>
        </div>
      )}

      {/* Post composer — always visible when in an org */}
      {orgId && (
        <PostComposer
          profile={profile}
          orgId={orgId}
          equipment={equipment}
          onPosted={load}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'all',        label: 'All' },
          { key: 'requests',   label: `🔩 Requests${requestCount > 0 ? ` (${requestCount})` : ''}` },
          { key: 'posts',      label: '💬 Posts' },
          { key: 'faults',     label: '⚡ Faults' },
          { key: 'activities', label: '🔧 Activities' },
          { key: 'shifts',     label: '📋 Shifts' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
            style={{
              background: filter === f.key ? 'var(--amber)' : 'var(--card)',
              color:      filter === f.key ? '#000'         : 'var(--text-2)',
              border:     filter === f.key ? 'none'         : '1px solid var(--border)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 100 }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Zap size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-2)' }}>No entries yet</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {!orgId ? 'Set your Plant ID first' : 'Be the first to post above ↑'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <FeedCard key={`${item.type}-${item.id}`} item={item} currentUserId={currentUserId}/>
          ))}
        </div>
      )}
    </AppShell>
  );
}
