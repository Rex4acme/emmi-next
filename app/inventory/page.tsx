'use client';
// app/inventory/page.tsx — Full Inventory & Procurement System
// Features:
// - Spare parts tracking with quantity, min stock, location, cost
// - Local Purchase Order (LPO) creation
// - Comparative analysis (compare 3 suppliers before buying)
// - Approval workflow (Senior/Admin approves LPOs)
// - Goods receipt — confirm delivery and auto-update stock
// - Low stock alerts

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import {
  Package, Plus, Search, AlertTriangle, CheckCircle,
  X, Loader2, Edit2, Trash2, Tag, ShoppingCart,
  FileText, TrendingDown, BarChart3, CheckSquare,
  ChevronDown, ChevronUp, Clock, Truck,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
interface SparePart {
  id: string; user_id: string; org_id?: string;
  name: string; part_number?: string; category: string;
  equipment_tag?: string; quantity: number; minimum_qty: number;
  unit: string; location?: string; supplier?: string;
  unit_cost?: number; notes?: string;
  created_at: string; updated_at: string;
}

interface LPO {
  id: string; user_id: string; org_id?: string;
  lpo_number: string; title: string; supplier: string;
  items: LPOItem[]; total_amount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'received' | 'cancelled';
  requested_by_name: string; approved_by_name?: string;
  approved_at?: string; notes?: string;
  created_at: string; updated_at: string;
}

interface LPOItem {
  part_name: string; part_number?: string; quantity: number;
  unit: string; unit_price: number; total_price: number;
}

interface ComparativeItem {
  description: string; quantity: number; unit: string;
  suppliers: { name: string; unit_price: number; delivery_days: number; notes?: string; }[];
}

const CATEGORIES = ['All','Bearings','Cables & Wiring','Circuit Breakers','Contactors',
  'Drives & VFDs','Fuses','Motors','Relays','Sensors','Switches','Transformers','Other'];
const UNITS = ['pcs','metres','kg','litres','rolls','sets','pairs','boxes'];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',            color: 'var(--text-3)' },
  pending_approval: { label: 'Pending Approval', color: 'var(--amber)'  },
  approved:         { label: 'Approved',          color: 'var(--blue)'  },
  ordered:          { label: 'Ordered',           color: 'var(--purple)'},
  received:         { label: 'Received',          color: 'var(--green)' },
  cancelled:        { label: 'Cancelled',         color: 'var(--red)'   },
};

type View = 'parts' | 'lpo' | 'comparative';

const BLANK_PART = {
  name: '', part_number: '', category: 'Other', equipment_tag: '',
  quantity: 0, minimum_qty: 1, unit: 'pcs', location: '', supplier: '', unit_cost: undefined as number | undefined, notes: '',
};

export default function InventoryPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [view,         setView]         = useState<View>('parts');
  const [parts,        setParts]        = useState<SparePart[]>([]);
  const [lpos,         setLpos]         = useState<LPO[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [userId,       setUserId]       = useState('');
  const [orgId,        setOrgId]        = useState<string|null>(null);
  const [userRole,     setUserRole]     = useState('engineer');
  const [myName,       setMyName]       = useState('');
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('All');
  const [showLowOnly,  setShowLow]      = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPart,  setEditingPart]  = useState<SparePart|null>(null);
  const [partForm,     setPartForm]     = useState({...BLANK_PART});
  const [saving,       setSaving]       = useState(false);

  // LPO state
  const [showLPOForm,  setShowLPOForm]  = useState(false);
  const [lpoTitle,     setLpoTitle]     = useState('');
  const [lpoSupplier,  setLpoSupplier]  = useState('');
  const [lpoNotes,     setLpoNotes]     = useState('');
  const [lpoItems,     setLpoItems]     = useState<LPOItem[]>([
    { part_name: '', part_number: '', quantity: 1, unit: 'pcs', unit_price: 0, total_price: 0 }
  ]);

  // Comparative analysis state
  const [compItems,    setCompItems]    = useState<ComparativeItem[]>([
    { description: '', quantity: 1, unit: 'pcs', suppliers: [
      { name: '', unit_price: 0, delivery_days: 0, notes: '' },
      { name: '', unit_price: 0, delivery_days: 0, notes: '' },
      { name: '', unit_price: 0, delivery_days: 0, notes: '' },
    ]},
  ]);
  const [compTitle,    setCompTitle]    = useState('');
  const [savingComp,   setSavingComp]   = useState(false);
  const [compSaved,    setCompSaved]    = useState(false);

  // Goods receipt state
  const [receivingLPO, setReceivingLPO] = useState<LPO|null>(null);
  const [receiptNotes, setReceiptNotes] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles').select('org_id, role, full_name').eq('id', user.id).single();
      setOrgId(profile?.org_id || null);
      setUserRole(profile?.role || 'engineer');
      setMyName(profile?.full_name || 'Engineer');

      await fetchParts(user.id, profile?.org_id);
      await fetchLPOs(user.id, profile?.org_id);
    }
    load();
  }, []);

  async function fetchParts(uid: string, oid?: string|null) {
    setLoading(true);
    let q = supabase.from('spare_parts').select('*').order('name');
    q = oid ? q.eq('org_id', oid) : q.eq('user_id', uid);
    const { data } = await q;
    setParts(data || []);
    setLoading(false);
  }

  async function fetchLPOs(uid: string, oid?: string|null) {
    let q = supabase.from('lpos').select('*').order('created_at', { ascending: false });
    q = oid ? q.eq('org_id', oid) : q.eq('user_id', uid);
    const { data } = await q;
    setLpos(data || []);
  }

  // ── Part CRUD ─────────────────────────────────────────────
  function openAddPart() { setEditingPart(null); setPartForm({...BLANK_PART}); setShowPartForm(true); }
  function openEditPart(p: SparePart) {
    setEditingPart(p);
    setPartForm({ name: p.name, part_number: p.part_number||'', category: p.category,
      equipment_tag: p.equipment_tag||'', quantity: p.quantity, minimum_qty: p.minimum_qty,
      unit: p.unit, location: p.location||'', supplier: p.supplier||'',
      unit_cost: p.unit_cost, notes: p.notes||'' });
    setShowPartForm(true);
  }

  async function savePart(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: any = { ...partForm, user_id: userId, org_id: orgId||null,
      name: partForm.name.trim(), updated_at: new Date().toISOString() };
    if (editingPart) {
      await supabase.from('spare_parts').update(payload).eq('id', editingPart.id);
    } else {
      await supabase.from('spare_parts').insert({ ...payload, created_at: new Date().toISOString() });
    }
    setSaving(false); setShowPartForm(false); setEditingPart(null);
    await fetchParts(userId, orgId);
  }

  async function deletePart(id: string) {
    if (!confirm('Delete this spare part?')) return;
    await supabase.from('spare_parts').delete().eq('id', id);
    setParts(p => p.filter(x => x.id !== id));
  }

  async function adjustQty(part: SparePart, delta: number) {
    const q = Math.max(0, part.quantity + delta);
    await supabase.from('spare_parts').update({ quantity: q, updated_at: new Date().toISOString() }).eq('id', part.id);
    setParts(p => p.map(x => x.id === part.id ? {...x, quantity: q} : x));
  }

  // ── LPO ───────────────────────────────────────────────────
  function updateLPOItem(i: number, field: keyof LPOItem, val: any) {
    setLpoItems(items => {
      const next = [...items];
      next[i] = { ...next[i], [field]: val };
      if (field === 'quantity' || field === 'unit_price') {
        next[i].total_price = (field === 'quantity' ? val : next[i].quantity) *
          (field === 'unit_price' ? val : next[i].unit_price);
      }
      return next;
    });
  }

  async function submitLPO(e: React.FormEvent, status: 'draft'|'pending_approval'|'approved') {
    e.preventDefault();
    const isAdmin = ['admin','senior_engineer'].includes(userRole);
    const finalStatus = isAdmin ? 'approved' : status;
    const total = lpoItems.reduce((s, i) => s + i.total_price, 0);
    const lpoNum = `LPO-${Date.now().toString().slice(-8)}`;

    const { error } = await supabase.from('lpos').insert({
      user_id: userId, org_id: orgId||null, lpo_number: lpoNum,
      title: lpoTitle.trim(), supplier: lpoSupplier.trim(),
      items: lpoItems.filter(i => i.part_name.trim()),
      total_amount: total, status: finalStatus,
      requested_by_name: myName,
      approved_by_name: isAdmin ? myName : null,
      approved_at: isAdmin ? new Date().toISOString() : null,
      notes: lpoNotes.trim() || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });

    if (error) { alert('Failed: ' + error.message); return; }
    setShowLPOForm(false);
    setLpoTitle(''); setLpoSupplier(''); setLpoNotes('');
    setLpoItems([{ part_name:'', part_number:'', quantity:1, unit:'pcs', unit_price:0, total_price:0 }]);
    await fetchLPOs(userId, orgId);
  }

  async function updateLPOStatus(id: string, status: LPO['status'], extra: any = {}) {
    await supabase.from('lpos').update({
      status, updated_at: new Date().toISOString(),
      ...(['approved'].includes(status) ? { approved_by_name: myName, approved_at: new Date().toISOString() } : {}),
      ...extra,
    }).eq('id', id);
    setLpos(prev => prev.map(l => l.id === id ? { ...l, status, ...extra } : l));
  }

  async function receiveGoods(lpo: LPO) {
    // Mark LPO received and add items to spare parts stock
    await updateLPOStatus(lpo.id, 'received');
    for (const item of lpo.items) {
      if (!item.part_name.trim()) continue;
      // Check if part already exists
      const { data: existing } = await supabase.from('spare_parts')
        .select('id, quantity').ilike('name', item.part_name.trim())
        .eq(orgId ? 'org_id' : 'user_id', orgId || userId).single();
      if (existing) {
        await supabase.from('spare_parts').update({
          quantity: existing.quantity + item.quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('spare_parts').insert({
          user_id: userId, org_id: orgId||null,
          name: item.part_name.trim(), part_number: item.part_number||null,
          quantity: item.quantity, minimum_qty: 1, unit: item.unit,
          unit_cost: item.unit_price, supplier: lpo.supplier,
          category: 'Other', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
      }
    }
    setReceivingLPO(null); setReceiptNotes('');
    await fetchParts(userId, orgId);
    await fetchLPOs(userId, orgId);
  }

  // ── Comparative analysis PDF-style export ─────────────────
  async function saveComparativeAnalysis(e: React.FormEvent) {
    e.preventDefault(); setSavingComp(true);
    const { error } = await supabase.from('comparative_analyses').insert({
      user_id: userId, org_id: orgId||null,
      title: compTitle.trim() || 'Comparative Analysis',
      items: compItems, requested_by_name: myName,
      created_at: new Date().toISOString(),
    });
    setSavingComp(false);
    if (error) { alert('Failed: ' + error.message); return; }
    setCompSaved(true);
    setTimeout(() => setCompSaved(false), 3000);
  }

  // ── Filtered parts ────────────────────────────────────────
  const filtered = parts.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.part_number||'').toLowerCase().includes(search.toLowerCase())
      || (p.equipment_tag||'').toLowerCase().includes(search.toLowerCase());
    const mc = category === 'All' || p.category === category;
    const ml = !showLowOnly || p.quantity <= p.minimum_qty;
    return ms && mc && ml;
  });

  const lowCount   = parts.filter(p => p.quantity <= p.minimum_qty).length;
  const totalValue = parts.reduce((s, p) => s + (p.unit_cost ? p.unit_cost * p.quantity : 0), 0);
  const isAdmin    = ['admin','senior_engineer'].includes(userRole);
  const pendingLPOs = lpos.filter(l => l.status === 'pending_approval').length;

  // ── Recommended supplier from comparative ─────────────────
  function getBestSupplier(item: ComparativeItem) {
    const valid = item.suppliers.filter(s => s.name && s.unit_price > 0);
    if (!valid.length) return null;
    return valid.reduce((best, s) => s.unit_price < best.unit_price ? s : best);
  }

  return (
    <AppShell title="Inventory">
      <div className="max-w-3xl">

        {/* View tabs */}
        <div className="flex mb-5 p-1 rounded-xl gap-1" style={{ background: 'var(--surface)' }}>
          {([
            { key: 'parts',       label: '📦 Parts',       badge: lowCount > 0 ? lowCount : 0 },
            { key: 'lpo',         label: '📋 Purchase Orders', badge: pendingLPOs },
            { key: 'comparative', label: '📊 Comparative',  badge: 0 },
          ] as { key: View; label: string; badge: number }[]).map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all relative"
              style={{
                background: view === v.key ? 'var(--card)' : 'transparent',
                color:      view === v.key ? 'var(--amber)' : 'var(--text-2)',
                border:     view === v.key ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              {v.label}
              {v.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: 'var(--red)', color: '#fff', fontSize: 8 }}>{v.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            SPARE PARTS
        ══════════════════════════════════════════ */}
        {view === 'parts' && (
          <div>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="card text-center py-3">
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--blue)' }}>{parts.length}</p>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>Part Types</p>
              </div>
              <button className="card text-center py-3" onClick={() => setShowLow(v => !v)}
                style={{ border: lowCount > 0 ? '1px solid rgba(248,81,73,0.3)' : '' }}>
                <p className="text-2xl font-bold font-mono" style={{ color: lowCount > 0 ? 'var(--red)' : 'var(--green)' }}>{lowCount}</p>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>Low Stock</p>
              </button>
              <div className="card text-center py-3">
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--amber)', fontSize: totalValue > 999999 ? 14 : undefined }}>
                  {totalValue > 0 ? `₦${totalValue >= 1000000 ? (totalValue/1000000).toFixed(1)+'M' : totalValue.toLocaleString()}` : '—'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>Est. Value</p>
              </div>
            </div>

            {/* Search + filter + add */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 form-input" style={{ minWidth: 160, padding: '0 12px' }}>
                <Search size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name, part no, equipment…"
                  style={{ background: 'none', border: 'none', outline: 'none', width: '100%', color: 'var(--text)', fontSize: 13 }}/>
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={12}/></button>}
              </div>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="form-input" style={{ minWidth: 120, fontSize: 12 }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={openAddPart}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'var(--amber)', color: '#000', flexShrink: 0 }}>
                <Plus size={15}/> Add Part
              </button>
            </div>

            {/* Low stock banner */}
            {showLowOnly && (
              <div className="card mb-4 flex items-center gap-3" style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0 }}/>
                <p className="text-xs" style={{ color: 'var(--red)' }}>Showing {lowCount} low-stock item{lowCount !== 1 ? 's' : ''}. Tap again to show all.</p>
                <button onClick={() => setShowLow(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={13}/></button>
              </div>
            )}

            {/* Parts list */}
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 72 }}/>)}</div>
            ) : filtered.length === 0 ? (
              <div className="card text-center py-12">
                <Package size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>{parts.length === 0 ? 'No spare parts yet' : 'No results'}</p>
                {parts.length === 0 && (
                  <button onClick={openAddPart} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--amber)', color: '#000' }}>+ Add First Part</button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(part => {
                  const isLow = part.quantity <= part.minimum_qty;
                  return (
                    <div key={part.id} className="card" style={{ borderLeft: `3px solid ${isLow ? 'var(--red)' : 'var(--green)'}` }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {isLow ? <AlertTriangle size={14} style={{ color: 'var(--red)' }}/> : <CheckCircle size={14} style={{ color: 'var(--green)' }}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{part.name}</p>
                            {part.part_number && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>{part.part_number}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{part.category}</span>
                            {part.equipment_tag && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--amber)' }}><Tag size={10}/>{part.equipment_tag}</span>}
                            {part.location && <span className="text-xs" style={{ color: 'var(--text-3)' }}>📍 {part.location}</span>}
                            {part.unit_cost && <span className="text-xs" style={{ color: 'var(--text-3)' }}>₦{part.unit_cost.toLocaleString()}/{part.unit}</span>}
                          </div>
                        </div>
                        {/* Qty adjuster */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustQty(part, -1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>−</button>
                            <div className="text-center" style={{ minWidth: 36 }}>
                              <p className="text-base font-bold font-mono" style={{ color: isLow ? 'var(--red)' : 'var(--text)', lineHeight: 1 }}>{part.quantity}</p>
                              <p style={{ fontSize: 9, color: 'var(--text-3)' }}>{part.unit}</p>
                            </div>
                            <button onClick={() => adjustQty(part, 1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>+</button>
                          </div>
                          {isLow && <p style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700 }}>Min: {part.minimum_qty}</p>}
                        </div>
                        {/* Edit/Delete */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => openEditPart(part)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}><Edit2 size={11}/></button>
                          <button onClick={() => deletePart(part.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', color: 'var(--red)' }}><Trash2 size={11}/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            PURCHASE ORDERS (LPO)
        ══════════════════════════════════════════ */}
        {view === 'lpo' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Local Purchase Orders</h2>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Create LPOs, get approval, receive goods → stock auto-updates</p>
              </div>
              <button onClick={() => setShowLPOForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'var(--amber)', color: '#000' }}>
                <Plus size={13}/> New LPO
              </button>
            </div>

            {/* LPO stats */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { label: 'Total',    value: lpos.length,                                   color: 'var(--blue)'  },
                { label: 'Pending',  value: pendingLPOs,                                    color: 'var(--amber)' },
                { label: 'Ordered',  value: lpos.filter(l=>l.status==='ordered').length,    color: 'var(--purple)'},
                { label: 'Received', value: lpos.filter(l=>l.status==='received').length,   color: 'var(--green)' },
              ].map(s => (
                <div key={s.label} className="card text-center py-2.5">
                  <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-2)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {lpos.length === 0 ? (
              <div className="card text-center py-12">
                <ShoppingCart size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>No purchase orders yet</p>
                <button onClick={() => setShowLPOForm(true)} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--amber)', color: '#000' }}>Create First LPO</button>
              </div>
            ) : (
              <div className="space-y-3">
                {lpos.map(lpo => {
                  const cfg = STATUS_CONFIG[lpo.status];
                  const canApprove = isAdmin && lpo.status === 'pending_approval';
                  const canOrder   = isAdmin && lpo.status === 'approved';
                  const canReceive = lpo.status === 'ordered';
                  return (
                    <div key={lpo.id} className="card" style={{ borderLeft: `3px solid ${cfg.color}` }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs font-bold" style={{ color: 'var(--amber)' }}>{lpo.lpo_number}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>{cfg.label}</span>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{lpo.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Supplier: {lpo.supplier} · {lpo.items?.length || 0} items · ₦{lpo.total_amount?.toLocaleString()}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>By: {lpo.requested_by_name} · {new Date(lpo.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</p>
                          {lpo.approved_by_name && <p className="text-xs" style={{ color: 'var(--green)' }}>✓ Approved by {lpo.approved_by_name}</p>}
                        </div>
                      </div>

                      {/* Items preview */}
                      {lpo.items?.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {lpo.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded" style={{ background: 'var(--surface)' }}>
                              <span style={{ color: 'var(--text-2)' }}>{item.part_name} × {item.quantity} {item.unit}</span>
                              <span style={{ color: 'var(--text-3)' }}>₦{item.total_price?.toLocaleString()}</span>
                            </div>
                          ))}
                          {lpo.items.length > 3 && <p style={{ fontSize: 10, color: 'var(--text-3)', paddingLeft: 8 }}>+{lpo.items.length - 3} more items</p>}
                        </div>
                      )}

                      {/* Action buttons */}
                      {(canApprove || canOrder || canReceive) && (
                        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                          {canApprove && (
                            <>
                              <button onClick={() => updateLPOStatus(lpo.id, 'approved')}
                                className="flex-1 py-2 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(52,208,88,0.15)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.3)' }}>
                                ✓ Approve LPO
                              </button>
                              <button onClick={() => updateLPOStatus(lpo.id, 'cancelled')}
                                className="flex-1 py-2 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                                ✗ Reject
                              </button>
                            </>
                          )}
                          {canOrder && (
                            <button onClick={() => updateLPOStatus(lpo.id, 'ordered')}
                              className="flex-1 py-2 rounded-lg text-xs font-bold"
                              style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
                              <Truck size={12} style={{ display:'inline', marginRight: 4 }}/>Mark as Ordered
                            </button>
                          )}
                          {canReceive && (
                            <button onClick={() => setReceivingLPO(lpo)}
                              className="flex-1 py-2 rounded-lg text-xs font-bold"
                              style={{ background: 'rgba(52,208,88,0.15)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.3)' }}>
                              <CheckSquare size={12} style={{ display:'inline', marginRight: 4 }}/>Receive Goods
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            COMPARATIVE ANALYSIS
        ══════════════════════════════════════════ */}
        {view === 'comparative' && (
          <div>
            <div className="card mb-4" style={{ background: 'rgba(74,158,255,0.05)', border: '1px solid rgba(74,158,255,0.2)' }}>
              <div className="flex items-start gap-3">
                <BarChart3 size={20} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 2 }}/>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>Supplier Comparative Analysis</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Get at least 3 quotations before purchasing. Enter each supplier's price to automatically identify the best value. Save as a formal comparative document.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={saveComparativeAnalysis} className="space-y-4">
              <div>
                <label className="form-label">Analysis Title</label>
                <input value={compTitle} onChange={e => setCompTitle(e.target.value)}
                  placeholder="e.g. Bearing 6205 Q1 2025 Procurement" className="form-input"/>
              </div>

              {/* Items */}
              {compItems.map((item, ii) => (
                <div key={ii} className="card" style={{ background: 'rgba(240,165,0,0.03)', border: '1px solid rgba(240,165,0,0.15)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold" style={{ color: 'var(--amber)' }}>Item {ii + 1}</p>
                    {compItems.length > 1 && (
                      <button type="button" onClick={() => setCompItems(c => c.filter((_,i) => i !== ii))}
                        style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13}/></button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="col-span-2">
                      <label className="form-label">Description</label>
                      <input value={item.description} onChange={e => setCompItems(c => c.map((x,i) => i===ii ? {...x, description: e.target.value} : x))}
                        placeholder="Part name / description" className="form-input"/>
                    </div>
                    <div>
                      <label className="form-label">Qty</label>
                      <input type="number" value={item.quantity} onChange={e => setCompItems(c => c.map((x,i) => i===ii ? {...x, quantity: parseInt(e.target.value)||1} : x))}
                        className="form-input"/>
                    </div>
                  </div>

                  {/* Supplier quotes */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>Supplier Quotes</p>
                    {item.suppliers.map((sup, si) => {
                      const isBest = getBestSupplier(item)?.name === sup.name && sup.name !== '';
                      return (
                        <div key={si} className="rounded-xl p-3" style={{
                          background: isBest ? 'rgba(52,208,88,0.08)' : 'var(--surface)',
                          border: isBest ? '1px solid rgba(52,208,88,0.3)' : '1px solid var(--border)',
                        }}>
                          {isBest && <p style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>★ BEST VALUE</p>}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supplier {si+1}</label>
                              <input value={sup.name} onChange={e => setCompItems(c => c.map((x,i) => i===ii ? {...x, suppliers: x.suppliers.map((s,j) => j===si ? {...s, name: e.target.value} : s)} : x))}
                                placeholder="Company name" className="form-input" style={{ fontSize: 11 }}/>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit Price (₦)</label>
                              <input type="number" value={sup.unit_price || ''} onChange={e => setCompItems(c => c.map((x,i) => i===ii ? {...x, suppliers: x.suppliers.map((s,j) => j===si ? {...s, unit_price: parseFloat(e.target.value)||0} : s)} : x))}
                                placeholder="0" className="form-input" style={{ fontSize: 11 }}/>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery (days)</label>
                              <input type="number" value={sup.delivery_days || ''} onChange={e => setCompItems(c => c.map((x,i) => i===ii ? {...x, suppliers: x.suppliers.map((s,j) => j===si ? {...s, delivery_days: parseInt(e.target.value)||0} : s)} : x))}
                                placeholder="0" className="form-input" style={{ fontSize: 11 }}/>
                            </div>
                          </div>
                          {sup.name && sup.unit_price > 0 && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                              Total for {item.quantity}: ₦{(sup.unit_price * item.quantity).toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {item.suppliers.length < 5 && (
                      <button type="button" onClick={() => setCompItems(c => c.map((x,i) => i===ii ? {...x, suppliers: [...x.suppliers, {name:'', unit_price:0, delivery_days:0, notes:''}]} : x))}
                        className="text-xs" style={{ color: 'var(--text-3)' }}>+ Add supplier</button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setCompItems(c => [...c, { description:'', quantity:1, unit:'pcs', suppliers:[{name:'',unit_price:0,delivery_days:0,notes:''},{name:'',unit_price:0,delivery_days:0,notes:''},{name:'',unit_price:0,delivery_days:0,notes:''}]}])}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                + Add Another Item
              </button>

              {compSaved ? (
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: 'rgba(52,208,88,0.1)', border: '1px solid rgba(52,208,88,0.3)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--green)' }}/>
                  <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>Analysis saved</p>
                </div>
              ) : (
                <button type="submit" disabled={savingComp}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: savingComp ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
                  {savingComp ? <Loader2 size={15} className="animate-spin"/> : <FileText size={15}/>}
                  {savingComp ? 'Saving…' : 'Save Comparative Analysis'}
                </button>
              )}
            </form>
          </div>
        )}

        {/* ══ ADD/EDIT PART MODAL ══ */}
        {showPartForm && (
          <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowPartForm(false); }}>
            <div style={{ width:'100%', maxWidth:520, margin:'0 auto', background:'var(--base)', borderRadius:'20px 20px 0 0', padding:'20px 20px 36px', maxHeight:'90vh', overflowY:'auto' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold" style={{ color: '#fff' }}>{editingPart ? 'Edit Part' : 'Add Spare Part'}</h2>
                <button onClick={() => setShowPartForm(false)} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:6, cursor:'pointer', color:'var(--text-2)' }}><X size={16}/></button>
              </div>
              <form onSubmit={savePart} className="space-y-3">
                <div>
                  <label className="form-label">Part Name <span style={{ color:'var(--red)' }}>*</span></label>
                  <input value={partForm.name} onChange={e => setPartForm(f => ({...f, name:e.target.value}))} placeholder="e.g. Deep Groove Bearing 6205" required className="form-input"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="form-label">Part Number</label><input value={partForm.part_number} onChange={e => setPartForm(f => ({...f, part_number:e.target.value}))} placeholder="6205-2RS" className="form-input"/></div>
                  <div><label className="form-label">Category</label><select value={partForm.category} onChange={e => setPartForm(f => ({...f, category:e.target.value}))} className="form-input">{CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="form-label">Equipment Tag</label><input value={partForm.equipment_tag} onChange={e => setPartForm(f => ({...f, equipment_tag:e.target.value}))} placeholder="MTR-001" className="form-input"/></div>
                  <div><label className="form-label">Store Location</label><input value={partForm.location} onChange={e => setPartForm(f => ({...f, location:e.target.value}))} placeholder="Store A, Shelf 3" className="form-input"/></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="form-label">In Stock</label><input type="number" value={partForm.quantity} onChange={e => setPartForm(f => ({...f, quantity:parseInt(e.target.value)||0}))} className="form-input"/></div>
                  <div><label className="form-label">Min Qty</label><input type="number" value={partForm.minimum_qty} onChange={e => setPartForm(f => ({...f, minimum_qty:parseInt(e.target.value)||1}))} className="form-input"/></div>
                  <div><label className="form-label">Unit</label><select value={partForm.unit} onChange={e => setPartForm(f => ({...f, unit:e.target.value}))} className="form-input">{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="form-label">Supplier</label><input value={partForm.supplier} onChange={e => setPartForm(f => ({...f, supplier:e.target.value}))} placeholder="Vendor name" className="form-input"/></div>
                  <div><label className="form-label">Unit Cost (₦)</label><input type="number" value={partForm.unit_cost||''} onChange={e => setPartForm(f => ({...f, unit_cost:parseFloat(e.target.value)||undefined}))} placeholder="0" className="form-input"/></div>
                </div>
                <div><label className="form-label">Notes</label><textarea value={partForm.notes} onChange={e => setPartForm(f => ({...f, notes:e.target.value}))} className="form-input" rows={2} placeholder="Compatible models, storage notes…"/></div>
                <button type="submit" disabled={saving || !partForm.name.trim()}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: saving ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
                  {saving ? <><Loader2 size={15} className="animate-spin"/> Saving…</> : `${editingPart ? 'Save Changes' : 'Add Spare Part'}`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══ NEW LPO MODAL ══ */}
        {showLPOForm && (
          <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowLPOForm(false); }}>
            <div style={{ width:'100%', maxWidth:560, margin:'0 auto', background:'var(--base)', borderRadius:'20px 20px 0 0', padding:'20px 20px 36px', maxHeight:'92vh', overflowY:'auto' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold" style={{ color: '#fff' }}>New Local Purchase Order</h2>
                <button onClick={() => setShowLPOForm(false)} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:6, cursor:'pointer', color:'var(--text-2)' }}><X size={16}/></button>
              </div>
              <form onSubmit={e => submitLPO(e, isAdmin ? 'approved' : 'pending_approval')} className="space-y-4">
                <div><label className="form-label">LPO Title <span style={{ color:'var(--red)' }}>*</span></label><input value={lpoTitle} onChange={e => setLpoTitle(e.target.value)} placeholder="e.g. Bearing procurement Q1 2025" required className="form-input"/></div>
                <div><label className="form-label">Supplier / Vendor <span style={{ color:'var(--red)' }}>*</span></label><input value={lpoSupplier} onChange={e => setLpoSupplier(e.target.value)} placeholder="Supplier company name" required className="form-input"/></div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label" style={{ marginBottom: 0 }}>Items</label>
                    <button type="button" onClick={() => setLpoItems(i => [...i, { part_name:'', part_number:'', quantity:1, unit:'pcs', unit_price:0, total_price:0 }])}
                      className="text-xs px-2 py-1 rounded-lg" style={{ background:'rgba(240,165,0,0.1)', color:'var(--amber)' }}>+ Add Item</button>
                  </div>
                  <div className="space-y-2">
                    {lpoItems.map((item, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div><input value={item.part_name} onChange={e => updateLPOItem(i,'part_name',e.target.value)} placeholder="Part name *" className="form-input" style={{ fontSize:12 }}/></div>
                              <div><input value={item.part_number} onChange={e => updateLPOItem(i,'part_number',e.target.value)} placeholder="Part no." className="form-input" style={{ fontSize:12 }}/></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div><input type="number" value={item.quantity} onChange={e => updateLPOItem(i,'quantity',parseInt(e.target.value)||1)} className="form-input" style={{ fontSize:12 }}/></div>
                              <div><select value={item.unit} onChange={e => updateLPOItem(i,'unit',e.target.value)} className="form-input" style={{ fontSize:12 }}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
                              <div><input type="number" value={item.unit_price||''} onChange={e => updateLPOItem(i,'unit_price',parseFloat(e.target.value)||0)} placeholder="Unit ₦" className="form-input" style={{ fontSize:12 }}/></div>
                            </div>
                            {item.unit_price > 0 && <p style={{ fontSize:11, color:'var(--text-3)' }}>Total: ₦{item.total_price.toLocaleString()}</p>}
                          </div>
                          {lpoItems.length > 1 && (
                            <button type="button" onClick={() => setLpoItems(l => l.filter((_,j) => j!==i))} style={{ color:'var(--red)', background:'none', border:'none', cursor:'pointer', marginTop:2 }}><X size={14}/></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {lpoItems.length > 0 && (
                    <p className="text-xs mt-2 text-right" style={{ color:'var(--amber)' }}>
                      Total: ₦{lpoItems.reduce((s,i) => s + i.total_price, 0).toLocaleString()}
                    </p>
                  )}
                </div>

                <div><label className="form-label">Notes</label><textarea value={lpoNotes} onChange={e => setLpoNotes(e.target.value)} placeholder="Delivery instructions, budget code, urgency…" className="form-input" rows={2}/></div>

                <div className="flex gap-2">
                  <button type="button" onClick={e => submitLPO(e as any, 'draft')}
                    className="flex-1 py-3 rounded-xl text-sm font-bold"
                    style={{ background:'var(--surface)', color:'var(--text-2)', border:'1px solid var(--border)' }}>
                    Save as Draft
                  </button>
                  <button type="submit"
                    className="flex-1 py-3 rounded-xl text-sm font-bold"
                    style={{ background:'var(--amber)', color:'#000' }}>
                    {isAdmin ? 'Issue LPO' : 'Submit for Approval'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ RECEIVE GOODS MODAL ══ */}
        {receivingLPO && (
          <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ width:'100%', maxWidth:400, background:'var(--base)', borderRadius:20, padding:24 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color:'#fff' }}>Receive Goods</h3>
                <button onClick={() => setReceivingLPO(null)} style={{ color:'var(--text-3)', background:'none', border:'none', cursor:'pointer' }}><X size={16}/></button>
              </div>
              <div className="card mb-4" style={{ background:'rgba(52,208,88,0.06)', border:'1px solid rgba(52,208,88,0.2)' }}>
                <p className="text-xs font-bold mb-2" style={{ color:'var(--green)' }}>Items to receive:</p>
                {receivingLPO.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-1" style={{ borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text-2)' }}>{item.part_name}</span>
                    <span style={{ color:'var(--green)', fontWeight:700 }}>+{item.quantity} {item.unit}</span>
                  </div>
                ))}
                <p className="text-xs mt-2" style={{ color:'var(--text-3)' }}>Stock will be updated automatically.</p>
              </div>
              <div className="mb-4">
                <label className="form-label">Delivery Notes</label>
                <textarea value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} placeholder="Condition of goods, short deliveries, etc." className="form-input" rows={2}/>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setReceivingLPO(null)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background:'var(--surface)', color:'var(--text-2)', border:'1px solid var(--border)' }}>Cancel</button>
                <button onClick={() => receiveGoods(receivingLPO)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background:'var(--green)', color:'#000' }}>
                  <CheckCircle size={14} style={{ display:'inline', marginRight:6 }}/>Confirm Receipt
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}