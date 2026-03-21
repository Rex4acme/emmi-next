'use client';
// app/inventory/page.tsx
// Spare parts store + Purchase Order (LPO) lifecycle tracker.
// All data goes to/from Supabase. No localStorage.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import {
  getProfile, getEquipment,
  getSpareParts, createSparePart, updateSparePart, deleteSparePart,
  getPurchaseOrders, createPurchaseOrder, deletePurchaseOrder,
  advancePurchaseOrderStatus,
} from '@/lib/db';
import { fmtDate, fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import {
  Package, Plus, Search, X, Loader2, Save,
  AlertTriangle, CheckCircle, Truck, BarChart2,
  FileText, ArrowRight, TrendingDown, RefreshCw,
  ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import type {
  SparePart, StockStatus, PurchaseOrder, LPOStatus, LPOPriority,
} from '@/types';

// ── Constants ─────────────────────────────────────────────────
const STOCK_CATEGORIES = [
  'Circuit Breakers', 'Contactors & Relays', 'Fuses & MCBs',
  'Cables & Wiring', 'Motors & Drives', 'Transformers',
  'Sensors & Instruments', 'Control Equipment', 'Lighting',
  'Lubricants & Consumables', 'Safety Equipment', 'Tools',
  'Mechanical Parts', 'Gaskets & Seals', 'Bearings',
  'Batteries & UPS', 'Panel Components', 'Other',
];
const UNITS = ['pcs', 'sets', 'rolls', 'meters', 'litres', 'kg', 'boxes', 'pairs', 'lengths'];

const LPO_PIPELINE: { key: LPOStatus; label: string; color: string }[] = [
  { key: 'lpo_to_raise',         label: 'LPO to Raise',         color: '#6e7681'       },
  { key: 'lpo_raised',           label: 'LPO Raised',           color: 'var(--blue)'   },
  { key: 'comparative_analysis', label: 'Comparative Analysis', color: '#d29922'       },
  { key: 'po_approved',          label: 'PO Approved',          color: 'var(--green)'  },
  { key: 'in_transit',           label: 'Spares in Transit',    color: 'var(--amber)'  },
  { key: 'received',             label: 'Materials Received',   color: 'var(--purple)' },
  { key: 'job_completed',        label: 'Job Completed',        color: 'var(--green)'  },
];

const PRIORITY_COLOR: Record<LPOPriority, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: '#d29922', low: 'var(--green)',
};

// ── Helpers ───────────────────────────────────────────────────
function stockStatusConfig(status: StockStatus) {
  return {
    in_stock:     { label: 'In Stock',     bg: 'rgba(52,208,88,0.1)',  color: 'var(--green)', border: 'rgba(52,208,88,0.25)'  },
    low_stock:    { label: 'Low Stock',    bg: 'rgba(240,165,0,0.1)',  color: 'var(--amber)', border: 'rgba(240,165,0,0.25)'  },
    out_of_stock: { label: 'Out of Stock', bg: 'rgba(248,81,73,0.1)',  color: 'var(--red)',   border: 'rgba(248,81,73,0.25)'  },
    ordered:      { label: 'On Order',     bg: 'rgba(74,158,255,0.1)', color: 'var(--blue)',  border: 'rgba(74,158,255,0.25)' },
  }[status];
}

function lpoStage(status: LPOStatus) {
  return LPO_PIPELINE.find(s => s.key === status) ?? LPO_PIPELINE[0];
}

// ── Inline error banner ────────────────────────────────────────
function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl mb-3 text-sm"
      style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
      <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/>
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} style={{ color: 'var(--red)' }}><X size={14}/></button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function InventoryPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,    setUserId]    = useState('');
  const [orgId,     setOrgId]     = useState('');
  const [raisedByDefault, setRaisedByDefault] = useState('');
  const [equipment, setEquipment] = useState<Pick<import('@/types').Equipment, 'id'|'tag_id'|'name'>[]>([]);
  const [tab,       setTab]       = useState<'stock' | 'lpo' | 'outsourcing'>('stock');
  const [search,    setSearch]    = useState('');
  const [pageError, setPageError] = useState('');

  // Stock
  const [stockItems,   setStockItems]   = useState<SparePart[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [showNewStock, setShowNewStock] = useState(false);
  const [stockSaving,  setStockSaving]  = useState(false);
  const [stockError,   setStockError]   = useState('');

  // LPO
  const [lpoItems,    setLpoItems]    = useState<PurchaseOrder[]>([]);
  const [lpoLoading,  setLpoLoading]  = useState(true);
  const [showNewLPO,  setShowNewLPO]  = useState(false);
  const [lpoSaving,   setLpoSaving]   = useState(false);
  const [lpoError,    setLpoError]    = useState('');
  const [lpoFilter,   setLpoFilter]   = useState<LPOStatus | 'all'>('all');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [advancing,   setAdvancing]   = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  // ── Stock form state ───────────────────────────────────────
  const [sName,     setSName]     = useState('');
  const [sPartNum,  setSPartNum]  = useState('');
  const [sDesc,     setSDesc]     = useState('');
  const [sCategory, setSCategory] = useState('Other');
  const [sQty,      setSQty]      = useState('0');
  const [sMinQty,   setSMinQty]   = useState('1');
  const [sUnit,     setSUnit]     = useState('pcs');
  const [sLocation, setSLocation] = useState('');
  const [sSupplier, setSSupplier] = useState('');
  const [sCost,     setSCost]     = useState('');
  const [sNotes,    setSNotes]    = useState('');

  // ── LPO form state ─────────────────────────────────────────
  const [lTitle,       setLTitle]       = useState('');
  const [lDesc,        setLDesc]        = useState('');
  const [lStatus,      setLStatus]      = useState<LPOStatus>('lpo_to_raise');
  const [lPriority,    setLPriority]    = useState<LPOPriority>('medium');
  const [lSupplier,    setLSupplier]    = useState('');
  const [lEquipTag,    setLEquipTag]    = useState('');
  const [lItems,       setLItems]       = useState('');
  const [lCost,        setLCost]        = useState('');
  const [lCurrency,    setLCurrency]    = useState('NGN');
  const [lRaisedBy,    setLRaisedBy]    = useState('');
  const [lApprovedBy,  setLApprovedBy]  = useState('');
  const [lVendorQ,     setLVendorQ]     = useState('');
  const [lWaybill,     setLWaybill]     = useState('');
  const [lInvoice,     setLInvoice]     = useState('');
  const [lJobDesc,     setLJobDesc]     = useState('');
  const [lContractor,  setLContractor]  = useState('');
  const [lOutsourced,  setLOutsourced]  = useState(false);
  const [lNotes,       setLNotes]       = useState('');

  // ── Load initial data ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const [profile, eq] = await Promise.all([
        getProfile(supabase, user.id),
        getEquipment(supabase, user.id),
      ]);

      const oid = (profile as any)?.org_id || '';
      setOrgId(oid);
      setEquipment(eq || []);

      const name = profile?.full_name || '';
      setRaisedByDefault(name);
      setLRaisedBy(name);

      const [parts, pos] = await Promise.all([
        getSpareParts(supabase, user.id, oid || undefined),
        getPurchaseOrders(supabase, user.id, oid || undefined),
      ]);
      setStockItems(parts);
      setLpoItems(pos);
      setStockLoading(false);
      setLpoLoading(false);
    }
    init();
  }, []);

  // ── Refresh helpers ────────────────────────────────────────
  async function reloadStock() {
    const parts = await getSpareParts(supabase, userId, orgId || undefined);
    setStockItems(parts);
  }
  async function reloadLPO() {
    const pos = await getPurchaseOrders(supabase, userId, orgId || undefined);
    setLpoItems(pos);
  }

  // ══════════════════════════════════════════════════════════
  // STOCK CRUD
  // ══════════════════════════════════════════════════════════

  async function handleSaveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim()) return;
    setStockSaving(true); setStockError('');
    try {
      await createSparePart(supabase, userId, {
        org_id:       orgId || undefined,
        name:         sName.trim(),
        part_number:  sPartNum.trim() || undefined,
        description:  sDesc.trim()   || undefined,
        category:     sCategory,
        quantity:     parseInt(sQty)   || 0,
        min_quantity: parseInt(sMinQty) || 1,
        unit:         sUnit,
        location:     sLocation.trim() || undefined,
        supplier:     sSupplier.trim() || undefined,
        unit_cost:    sCost ? parseFloat(sCost) : undefined,
        status:       'in_stock', // recomputed inside createSparePart
        notes:        sNotes.trim() || undefined,
      });
      // Reset form
      setSName(''); setSPartNum(''); setSDesc(''); setSCategory('Other');
      setSQty('0'); setSMinQty('1'); setSUnit('pcs');
      setSLocation(''); setSSupplier(''); setSCost(''); setSNotes('');
      setShowNewStock(false);
      await reloadStock();
    } catch (err: any) {
      setStockError(err.message);
    }
    setStockSaving(false);
  }

  async function handleQtyChange(part: SparePart, delta: number) {
    const newQty = Math.max(0, part.quantity + delta);
    try {
      await updateSparePart(supabase, part.id, {
        quantity:     newQty,
        min_quantity: part.min_quantity,
      });
      await reloadStock();
    } catch (err: any) {
      setStockError(err.message);
    }
  }

  async function handleDeleteStock(id: string) {
    setDeleting(id);
    try {
      await deleteSparePart(supabase, id);
      await reloadStock();
    } catch (err: any) {
      setStockError(err.message);
    }
    setDeleting(null);
  }

  // ══════════════════════════════════════════════════════════
  // LPO CRUD
  // ══════════════════════════════════════════════════════════

  async function handleSaveLPO(e: React.FormEvent) {
    e.preventDefault();
    if (!lTitle.trim()) return;
    setLpoSaving(true); setLpoError('');
    try {
      await createPurchaseOrder(supabase, userId, {
        org_id:          orgId || undefined,
        title:           lTitle.trim(),
        description:     lDesc.trim()      || undefined,
        status:          lStatus,
        priority:        lPriority,
        supplier:        lSupplier.trim()  || undefined,
        equipment_tag:   lEquipTag         || undefined,
        items:           lItems.trim()     || undefined,
        total_cost:      lCost ? parseFloat(lCost) : undefined,
        currency:        lCurrency,
        raised_by:       lRaisedBy.trim()  || undefined,
        approved_by:     lApprovedBy.trim()|| undefined,
        date_raised:     lStatus !== 'lpo_to_raise' ? new Date().toISOString() : undefined,
        vendor_quotes:   lVendorQ.trim()   || undefined,
        waybill_number:  lWaybill.trim()   || undefined,
        invoice_number:  lInvoice.trim()   || undefined,
        job_description: lJobDesc.trim()   || undefined,
        is_outsourced:   lOutsourced,
        contractor:      lContractor.trim()|| undefined,
        notes:           lNotes.trim()     || undefined,
      });
      // Reset form
      setLTitle(''); setLDesc(''); setLStatus('lpo_to_raise'); setLPriority('medium');
      setLSupplier(''); setLEquipTag(''); setLItems(''); setLCost('');
      setLRaisedBy(raisedByDefault); setLApprovedBy('');
      setLVendorQ(''); setLWaybill(''); setLInvoice(''); setLJobDesc('');
      setLContractor(''); setLOutsourced(false); setLNotes('');
      setShowNewLPO(false);
      await reloadLPO();
    } catch (err: any) {
      setLpoError(err.message);
    }
    setLpoSaving(false);
  }

  async function handleAdvance(po: PurchaseOrder) {
    setAdvancing(po.id); setLpoError('');
    try {
      await advancePurchaseOrderStatus(supabase, po.id, po.status);
      await reloadLPO();
    } catch (err: any) {
      setLpoError(err.message);
    }
    setAdvancing(null);
  }

  async function handleDeleteLPO(id: string) {
    setDeleting(id); setLpoError('');
    try {
      await deletePurchaseOrder(supabase, id);
      await reloadLPO();
    } catch (err: any) {
      setLpoError(err.message);
    }
    setDeleting(null);
  }

  // ── Derived data ───────────────────────────────────────────
  const filteredStock = stockItems.filter(s => {
    const q = search.toLowerCase();
    return !q ||
      s.name.toLowerCase().includes(q) ||
      (s.part_number || '').toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q);
  });

  const lpoBase = lpoItems.filter(l =>
    tab === 'outsourcing' ? l.is_outsourced : !l.is_outsourced
  );
  const filteredLPO = lpoBase.filter(l => {
    const matchStatus = lpoFilter === 'all' || l.status === lpoFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.title.toLowerCase().includes(q) ||
      (l.lpo_number || '').toLowerCase().includes(q) ||
      (l.supplier || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const lowStockCount = stockItems.filter(s => s.status === 'low_stock' || s.status === 'out_of_stock').length;
  const openLPOCount  = lpoItems.filter(l => l.status !== 'job_completed' && !l.is_outsourced).length;
  const inTransit     = lpoItems.filter(l => l.status === 'in_transit').length;
  const openOutsource = lpoItems.filter(l => l.is_outsourced && l.status !== 'job_completed').length;

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <AppShell title="Inventory & Procurement">

      {pageError && <ErrorBanner msg={pageError} onDismiss={() => setPageError('')}/>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Stock Items',   value: stockItems.length, color: 'var(--blue)',   icon: <Package size={15}/> },
          { label: 'Low / Out',     value: lowStockCount,     color: 'var(--red)',    icon: <TrendingDown size={15}/> },
          { label: 'Open LPOs',     value: openLPOCount,      color: 'var(--amber)',  icon: <FileText size={15}/> },
          { label: 'In Transit',    value: inTransit,         color: 'var(--purple)', icon: <Truck size={15}/> },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div className="p-2 rounded-lg" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'stock',       label: '📦 Stock',       badge: lowStockCount },
          { key: 'lpo',         label: '📋 LPOs',        badge: openLPOCount },
          { key: 'outsourcing', label: '🔧 Outsourcing', badge: openOutsource },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as typeof tab); setSearch(''); setLpoFilter('all'); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: tab === t.key ? 'var(--amber)' : 'var(--card)',
              color:      tab === t.key ? '#000'         : 'var(--text-2)',
              border:     tab === t.key ? 'none'         : '1px solid var(--border)',
            }}>
            {t.label}
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: tab === t.key ? 'rgba(0,0,0,0.2)' : 'var(--red)', color: tab === t.key ? '#000' : '#fff', fontSize: 9 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'stock' ? 'Search name, part number, location…' : 'Search LPOs, suppliers…'}
          className="form-input pl-9"/>
      </div>

      {/* ════════════════════════════════════════════════════
          STOCK TAB
      ════════════════════════════════════════════════════ */}
      {tab === 'stock' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Spare Parts Store</h3>
            <button onClick={() => setShowNewStock(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--blue)', color: '#fff' }}>
              <Plus size={13}/> Add Item
            </button>
          </div>

          {stockError && <ErrorBanner msg={stockError} onDismiss={() => setStockError('')}/>}

          {lowStockCount > 0 && (
            <div className="card mb-4 flex items-start gap-3"
              style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }}/>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                <span className="font-bold" style={{ color: 'var(--red)' }}>{lowStockCount} item{lowStockCount > 1 ? 's' : ''}</span> below minimum level — raise an LPO to replenish.
              </p>
            </div>
          )}

          {/* New stock form */}
          {showNewStock && (
            <div className="card mb-4" style={{ border: '1px solid rgba(74,158,255,0.25)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: 'var(--blue)' }}>📦 Add Stock Item</p>
                <button onClick={() => setShowNewStock(false)} style={{ color: 'var(--text-3)' }}><X size={15}/></button>
              </div>
              <form onSubmit={handleSaveStock} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label req">Item Name</label>
                    <input className="form-input" placeholder="e.g. 32A MCB" required
                      value={sName} onChange={e => setSName(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Part Number</label>
                    <input className="form-input font-mono" placeholder="e.g. MCB-32A-SN"
                      value={sPartNum} onChange={e => setSPartNum(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={sCategory} onChange={e => setSCategory(e.target.value)}>
                    {STOCK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label req">Qty in Store</label>
                    <input type="number" min="0" className="form-input" required
                      value={sQty} onChange={e => setSQty(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Min Qty</label>
                    <input type="number" min="0" className="form-input"
                      value={sMinQty} onChange={e => setSMinQty(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Unit</label>
                    <select className="form-input" value={sUnit} onChange={e => setSUnit(e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Store Location</label>
                    <input className="form-input" placeholder="e.g. Shelf B3"
                      value={sLocation} onChange={e => setSLocation(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Supplier</label>
                    <input className="form-input" placeholder="Supplier name"
                      value={sSupplier} onChange={e => setSSupplier(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Unit Cost (₦)</label>
                  <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
                    value={sCost} onChange={e => setSCost(e.target.value)}/>
                </div>
                <div>
                  <label className="form-label">Description / Specification</label>
                  <textarea className="form-input" rows={2}
                    placeholder="Voltage rating, model, where used, etc."
                    value={sDesc} onChange={e => setSDesc(e.target.value)}/>
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} placeholder="Any additional notes"
                    value={sNotes} onChange={e => setSNotes(e.target.value)}/>
                </div>
                <button type="submit" disabled={stockSaving || !sName.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: stockSaving ? 'rgba(74,158,255,0.4)' : 'var(--blue)', color: '#fff' }}>
                  {stockSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  {stockSaving ? 'Saving…' : 'Save to Store'}
                </button>
              </form>
            </div>
          )}

          {/* Stock list */}
          {stockLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 90 }}/>)}
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="card text-center py-10">
              <Package size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {search ? 'No items match your search' : 'No stock items yet — add spare parts to your store'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStock.map(part => {
                const cfg = stockStatusConfig(part.status);
                const borderColor = part.status === 'out_of_stock' ? 'var(--red)' : part.status === 'low_stock' ? 'var(--amber)' : 'var(--green)';
                return (
                  <div key={part.id} className="card" style={{ borderLeft: `3px solid ${borderColor}` }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {part.part_number && <span className="tag-chip text-xs font-mono">{part.part_number}</span>}
                          <span className="chip text-xs"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: 10, padding: '2px 8px' }}>
                            {cfg.label}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{part.category}</span>
                        </div>
                        <p className="text-sm font-semibold">{part.name}</p>
                        {part.description && (
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{part.description}</p>
                        )}
                      </div>
                      <button onClick={() => handleDeleteStock(part.id)} disabled={deleting === part.id}
                        className="flex-shrink-0 p-1 rounded" style={{ color: 'var(--text-3)' }}>
                        {deleting === part.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                      </button>
                    </div>

                    {/* Qty stepper */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleQtyChange(part, -1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                          −
                        </button>
                        <div className="text-center" style={{ minWidth: 56 }}>
                          <p className="text-xl font-bold font-mono leading-none"
                            style={{ color: part.status === 'out_of_stock' ? 'var(--red)' : part.status === 'low_stock' ? 'var(--amber)' : 'var(--text)' }}>
                            {part.quantity}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{part.unit}</p>
                        </div>
                        <button onClick={() => handleQtyChange(part, 1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                          +
                        </button>
                      </div>
                      <div className="text-xs space-y-0.5" style={{ color: 'var(--text-3)' }}>
                        {part.location && <p>📍 {part.location}</p>}
                        {part.supplier && <p>🏭 {part.supplier}</p>}
                        {part.unit_cost != null && (
                          <p>₦{part.unit_cost.toLocaleString()} / {part.unit}</p>
                        )}
                      </div>
                      <p className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
                        Min: {part.min_quantity} {part.unit}
                      </p>
                    </div>
                    {part.notes && (
                      <p className="text-xs mt-2 pt-2 leading-snug"
                        style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
                        {part.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          LPO / OUTSOURCING TAB
      ════════════════════════════════════════════════════ */}
      {(tab === 'lpo' || tab === 'outsourcing') && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">
              {tab === 'lpo' ? 'Purchase Orders' : 'Outsourced Jobs'}
            </h3>
            <button onClick={() => setShowNewLPO(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--amber)', color: '#000' }}>
              <Plus size={13}/> New {tab === 'lpo' ? 'LPO' : 'Job'}
            </button>
          </div>

          {lpoError && <ErrorBanner msg={lpoError} onDismiss={() => setLpoError('')}/>}

          {/* Pipeline summary strip */}
          {tab === 'lpo' && (
            <div className="mb-4 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {LPO_PIPELINE.map((stage, i) => {
                  const count = lpoBase.filter(l => l.status === stage.key).length;
                  return (
                    <div key={stage.key} className="flex items-center gap-1">
                      <button
                        onClick={() => setLpoFilter(lpoFilter === stage.key ? 'all' : stage.key)}
                        className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all"
                        style={{
                          background: lpoFilter === stage.key ? `${stage.color}20` : 'var(--card)',
                          border: `1px solid ${lpoFilter === stage.key ? stage.color + '50' : 'var(--border)'}`,
                          minWidth: 68,
                        }}>
                        <span className="text-lg font-bold font-mono" style={{ color: stage.color }}>{count}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 9, textAlign: 'center', lineHeight: 1.3 }}>
                          {stage.label}
                        </span>
                      </button>
                      {i < LPO_PIPELINE.length - 1 && (
                        <ArrowRight size={11} style={{ color: 'var(--border)', flexShrink: 0 }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New LPO form */}
          {showNewLPO && (
            <div className="card mb-4" style={{ border: '1px solid rgba(240,165,0,0.25)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
                  {tab === 'outsourcing' ? '🔧 New Outsourced Job' : '📋 New Purchase Order'}
                </p>
                <button onClick={() => setShowNewLPO(false)} style={{ color: 'var(--text-3)' }}><X size={15}/></button>
              </div>
              <form onSubmit={handleSaveLPO} className="space-y-3">
                <div>
                  <label className="form-label req">Title</label>
                  <input className="form-input" required
                    placeholder="e.g. Procurement of 32A MCBs for MCC-01 panel"
                    value={lTitle} onChange={e => setLTitle(e.target.value)}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Priority</label>
                    <select className="form-input" value={lPriority}
                      onChange={e => setLPriority(e.target.value as LPOPriority)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Initial Stage</label>
                    <select className="form-input" value={lStatus}
                      onChange={e => setLStatus(e.target.value as LPOStatus)}>
                      {LPO_PIPELINE.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Items to Procure</label>
                  <textarea className="form-input" rows={3}
                    placeholder="e.g. 10× 32A MCB (Schneider), 5× 40A Contactor, 2× 16mm² cable reel"
                    value={lItems} onChange={e => setLItems(e.target.value)}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Estimated Cost</label>
                    <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
                      value={lCost} onChange={e => setLCost(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select className="form-input" value={lCurrency}
                      onChange={e => setLCurrency(e.target.value)}>
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Supplier / Vendor</label>
                    <input className="form-input" placeholder="Supplier name"
                      value={lSupplier} onChange={e => setLSupplier(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Related Equipment</label>
                    <select className="form-input" value={lEquipTag}
                      onChange={e => setLEquipTag(e.target.value)}>
                      <option value="">— None —</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.tag_id}>{eq.tag_id} — {eq.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Raised By</label>
                    <input className="form-input" value={lRaisedBy}
                      onChange={e => setLRaisedBy(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Approved By</label>
                    <input className="form-input" placeholder="Approver name"
                      value={lApprovedBy} onChange={e => setLApprovedBy(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Comparative Analysis / Vendor Quotes</label>
                  <textarea className="form-input" rows={2}
                    placeholder="Vendor A: ₦45,000 | Vendor B: ₦42,000 ✓ | Vendor C: ₦48,500"
                    value={lVendorQ} onChange={e => setLVendorQ(e.target.value)}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Waybill Number</label>
                    <input className="form-input font-mono" placeholder="WB-001"
                      value={lWaybill} onChange={e => setLWaybill(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Invoice Number</label>
                    <input className="form-input font-mono" placeholder="INV-001"
                      value={lInvoice} onChange={e => setLInvoice(e.target.value)}/>
                  </div>
                </div>

                {/* Outsourcing fields */}
                <div className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" id="lOutsourced" checked={lOutsourced}
                    onChange={e => setLOutsourced(e.target.checked)} className="w-4 h-4 accent-amber-400"/>
                  <label htmlFor="lOutsourced" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    This is an outsourced job / contract
                  </label>
                </div>
                {lOutsourced && (
                  <>
                    <div>
                      <label className="form-label">Contractor / Service Company</label>
                      <input className="form-input" placeholder="Contractor name"
                        value={lContractor} onChange={e => setLContractor(e.target.value)}/>
                    </div>
                    <div>
                      <label className="form-label">Scope of Work</label>
                      <textarea className="form-input" rows={3}
                        placeholder="Detailed scope, deliverables, timeline…"
                        value={lJobDesc} onChange={e => setLJobDesc(e.target.value)}/>
                    </div>
                  </>
                )}

                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} placeholder="Additional notes"
                    value={lNotes} onChange={e => setLNotes(e.target.value)}/>
                </div>
                <button type="submit" disabled={lpoSaving || !lTitle.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: lpoSaving ? 'rgba(240,165,0,0.4)' : 'var(--amber)', color: '#000' }}>
                  {lpoSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  {lpoSaving ? 'Saving…' : `Create ${tab === 'outsourcing' ? 'Job' : 'LPO'}`}
                </button>
              </form>
            </div>
          )}

          {/* LPO list */}
          {lpoLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 100 }}/>)}
            </div>
          ) : filteredLPO.length === 0 ? (
            <div className="card text-center py-10">
              <FileText size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {search || lpoFilter !== 'all' ? 'No entries match' : `No ${tab === 'outsourcing' ? 'outsourced jobs' : 'purchase orders'} yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLPO.map(po => {
                const stage    = lpoStage(po.status);
                const stageIdx = LPO_PIPELINE.findIndex(s => s.key === po.status);
                const isExpanded = expandedId === po.id;
                const isDone   = po.status === 'job_completed';
                const prioColor = PRIORITY_COLOR[po.priority];
                return (
                  <div key={po.id} className="card" style={{ borderLeft: `3px solid ${prioColor}` }}>
                    {/* Card header */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {po.lpo_number && (
                            <span className="tag-chip text-xs font-mono">{po.lpo_number}</span>
                          )}
                          <span className="chip text-xs"
                            style={{ background: `${prioColor}18`, color: prioColor,
                              border: `1px solid ${prioColor}30`, fontSize: 9, padding: '1px 7px', textTransform: 'uppercase' }}>
                            {po.priority}
                          </span>
                          {po.is_outsourced && (
                            <span className="chip text-xs"
                              style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)',
                                border: '1px solid rgba(163,113,247,0.25)', fontSize: 9, padding: '1px 7px' }}>
                              🔧 Outsourced
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold mb-1">{po.title}</p>
                        {/* Stage badge */}
                        <span className="chip text-xs flex items-center gap-1 inline-flex"
                          style={{ background: `${stage.color}18`, color: stage.color,
                            border: `1px solid ${stage.color}30`, fontSize: 10, padding: '2px 8px' }}>
                          {stage.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedId(isExpanded ? null : po.id)}
                          style={{ color: 'var(--text-3)', padding: 4 }}>
                          {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                        </button>
                        <button onClick={() => handleDeleteLPO(po.id)} disabled={deleting === po.id}
                          style={{ color: 'var(--text-3)', padding: 4 }}>
                          {deleting === po.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-0.5 mt-3">
                      {LPO_PIPELINE.map((s, i) => (
                        <div key={s.key} className="flex-1 rounded-full transition-all duration-500"
                          style={{ height: 4, background: i <= stageIdx ? stage.color : 'var(--border)' }}/>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                      Stage {stageIdx + 1} of {LPO_PIPELINE.length} · {fmtRelative(po.created_at)}
                    </p>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 space-y-2.5"
                        style={{ borderTop: '1px solid var(--border)' }}>
                        {po.items && (
                          <div>
                            <p className="form-label mb-0.5">ITEMS</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{po.items}</p>
                          </div>
                        )}
                        {po.vendor_quotes && (
                          <div>
                            <p className="form-label mb-0.5">COMPARATIVE ANALYSIS</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{po.vendor_quotes}</p>
                          </div>
                        )}
                        {po.job_description && (
                          <div>
                            <p className="form-label mb-0.5">SCOPE OF WORK</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{po.job_description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {po.supplier    && <p style={{ color: 'var(--text-3)' }}>Supplier: <span style={{ color: 'var(--text-2)' }}>{po.supplier}</span></p>}
                          {po.contractor  && <p style={{ color: 'var(--text-3)' }}>Contractor: <span style={{ color: 'var(--text-2)' }}>{po.contractor}</span></p>}
                          {po.total_cost  != null && (
                            <p style={{ color: 'var(--text-3)' }}>Cost: <span className="font-bold" style={{ color: 'var(--amber)' }}>{po.currency} {po.total_cost.toLocaleString()}</span></p>
                          )}
                          {po.raised_by   && <p style={{ color: 'var(--text-3)' }}>Raised by: <span style={{ color: 'var(--text-2)' }}>{po.raised_by}</span></p>}
                          {po.approved_by && <p style={{ color: 'var(--text-3)' }}>Approved by: <span style={{ color: 'var(--text-2)' }}>{po.approved_by}</span></p>}
                          {po.equipment_tag && <p style={{ color: 'var(--text-3)' }}>Equipment: <span className="tag-chip" style={{ fontSize: 10 }}>{po.equipment_tag}</span></p>}
                          {po.waybill_number && <p style={{ color: 'var(--text-3)' }}>Waybill: <span className="font-mono" style={{ color: 'var(--text-2)' }}>{po.waybill_number}</span></p>}
                          {po.invoice_number && <p style={{ color: 'var(--text-3)' }}>Invoice: <span className="font-mono" style={{ color: 'var(--text-2)' }}>{po.invoice_number}</span></p>}
                          {po.date_raised    && <p style={{ color: 'var(--text-3)' }}>Raised: {fmtDate(po.date_raised)}</p>}
                          {po.date_approved  && <p style={{ color: 'var(--text-3)' }}>Approved: {fmtDate(po.date_approved)}</p>}
                          {po.date_received  && <p style={{ color: 'var(--text-3)' }}>Received: {fmtDate(po.date_received)}</p>}
                          {po.date_completed && <p style={{ color: 'var(--text-3)' }}>Completed: {fmtDate(po.date_completed)}</p>}
                        </div>
                        {po.notes && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{po.notes}</p>}
                      </div>
                    )}

                    {/* Advance button */}
                    {!isDone ? (
                      <button onClick={() => handleAdvance(po)} disabled={advancing === po.id}
                        className="w-full mt-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                        style={{ background: `${stage.color}15`, color: stage.color, border: `1px solid ${stage.color}30` }}>
                        {advancing === po.id
                          ? <Loader2 size={12} className="animate-spin"/>
                          : <ArrowRight size={12}/>}
                        {advancing === po.id ? 'Updating…' : `Advance → ${LPO_PIPELINE[stageIdx + 1]?.label}`}
                      </button>
                    ) : (
                      <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(52,208,88,0.08)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                        <CheckCircle size={13}/> Job Completed
                        {po.date_completed && (
                          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {fmtDate(po.date_completed)}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
