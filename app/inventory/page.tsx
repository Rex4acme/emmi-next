'use client';
// app/inventory/page.tsx — Inventory, Spares & Job Outsourcing Tracker
// Tracks:
//  • Spare parts stock (store inventory)
//  • Local Purchase Orders (LPO) lifecycle:
//    LPO to Raise → LPO Raised → Comparative Analysis → PO Approved →
//    Spares in Transit → Materials Received/Supplied → Job Completed
//  • Job outsourcing tracking
//  • Stock alerts (low stock, expiry)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getEquipment } from '@/lib/db';
import { fmtDate, fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import {
  Package, Plus, Search, X, ChevronDown, ChevronUp,
  Loader2, Save, AlertTriangle, CheckCircle, Clock,
  Truck, BarChart2, FileText, Wrench, ArrowRight,
  TrendingDown, RefreshCw, Filter, ExternalLink,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'ordered';
type LPOStatus =
  | 'lpo_to_raise'
  | 'lpo_raised'
  | 'comparative_analysis'
  | 'po_approved'
  | 'in_transit'
  | 'received'
  | 'job_completed';

interface SpareItem {
  id: string;
  name: string;
  part_number?: string;
  description?: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  location?: string;
  supplier?: string;
  unit_cost?: number;
  equipment_tags?: string[];
  status: StockStatus;
  last_updated: string;
  notes?: string;
}

interface LPOItem {
  id: string;
  lpo_number?: string;
  title: string;
  description?: string;
  status: LPOStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  supplier?: string;
  equipment_tag?: string;
  items: string;          // JSON string of [{name, qty, unit_cost}]
  total_cost?: number;
  currency: string;
  raised_by?: string;
  approved_by?: string;
  date_raised?: string;
  date_approved?: string;
  date_received?: string;
  date_completed?: string;
  vendor_quotes?: string;  // comparative analysis notes
  waybill_number?: string;
  invoice_number?: string;
  job_description?: string;
  is_outsourced: boolean;
  contractor?: string;
  notes?: string;
  created_at: string;
}

// ── LPO Status pipeline ───────────────────────────────────────
const LPO_PIPELINE: { key: LPOStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'lpo_to_raise',         label: 'LPO to Raise',         icon: <FileText size={13}/>,    color: '#6e7681' },
  { key: 'lpo_raised',           label: 'LPO Raised',           icon: <FileText size={13}/>,    color: 'var(--blue)' },
  { key: 'comparative_analysis', label: 'Comparative Analysis', icon: <BarChart2 size={13}/>,   color: '#d29922' },
  { key: 'po_approved',          label: 'PO Approved',          icon: <CheckCircle size={13}/>, color: 'var(--green)' },
  { key: 'in_transit',           label: 'Spares in Transit',    icon: <Truck size={13}/>,       color: 'var(--amber)' },
  { key: 'received',             label: 'Materials Received',   icon: <Package size={13}/>,     color: 'var(--purple)' },
  { key: 'job_completed',        label: 'Job Completed',        icon: <CheckCircle size={13}/>, color: 'var(--green)' },
];

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: '#d29922', low: 'var(--green)',
};

const STOCK_CATEGORIES = [
  'Circuit Breakers', 'Contactors & Relays', 'Fuses & MCBs',
  'Cables & Wiring', 'Motors & Drives', 'Transformers',
  'Sensors & Instruments', 'Control Equipment', 'Lighting',
  'Lubricants & Consumables', 'Safety Equipment', 'Tools',
  'Mechanical Parts', 'Gaskets & Seals', 'Bearings',
  'Batteries & UPS', 'Panel Components', 'Other',
];

const UNITS = ['pcs', 'sets', 'rolls', 'meters', 'litres', 'kg', 'boxes', 'pairs', 'lengths'];

// ── Local storage helpers (no DB schema changes needed) ───────
// We store inventory in Supabase using a simple notes/JSONB pattern
// via localStorage for now — easily migrated to a real table later
function useLocalInventory(userId: string) {
  const KEY_STOCK = `emmi_stock_${userId}`;
  const KEY_LPO   = `emmi_lpo_${userId}`;

  function getStock(): SpareItem[] {
    try { return JSON.parse(localStorage.getItem(KEY_STOCK) || '[]'); } catch { return []; }
  }
  function saveStock(items: SpareItem[]) {
    localStorage.setItem(KEY_STOCK, JSON.stringify(items));
  }
  function getLPO(): LPOItem[] {
    try { return JSON.parse(localStorage.getItem(KEY_LPO) || '[]'); } catch { return []; }
  }
  function saveLPO(items: LPOItem[]) {
    localStorage.setItem(KEY_LPO, JSON.stringify(items));
  }
  return { getStock, saveStock, getLPO, saveLPO };
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Stock status badge ─────────────────────────────────────────
function StockBadge({ status }: { status: StockStatus }) {
  const config = {
    in_stock:     { label: 'In Stock',      bg: 'rgba(52,208,88,0.1)',   color: 'var(--green)',  border: 'rgba(52,208,88,0.25)' },
    low_stock:    { label: 'Low Stock',     bg: 'rgba(240,165,0,0.1)',   color: 'var(--amber)',  border: 'rgba(240,165,0,0.25)' },
    out_of_stock: { label: 'Out of Stock',  bg: 'rgba(248,81,73,0.1)',   color: 'var(--red)',    border: 'rgba(248,81,73,0.25)' },
    ordered:      { label: 'On Order',      bg: 'rgba(74,158,255,0.1)',  color: 'var(--blue)',   border: 'rgba(74,158,255,0.25)' },
  }[status];
  return (
    <span className="chip text-xs"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}`, fontSize: 10, padding: '2px 8px' }}>
      {config.label}
    </span>
  );
}

// ── LPO Status badge ──────────────────────────────────────────
function LPOBadge({ status }: { status: LPOStatus }) {
  const stage = LPO_PIPELINE.find(s => s.key === status)!;
  return (
    <span className="chip text-xs flex items-center gap-1"
      style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30`, fontSize: 10, padding: '2px 8px' }}>
      {stage.icon} {stage.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,    setUserId]    = useState('');
  const [profile,   setProfile]   = useState<any>(null);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [tab,       setTab]       = useState<'stock' | 'lpo' | 'outsourcing'>('stock');
  const [search,    setSearch]    = useState('');

  // Stock state
  const [stockItems,  setStockItems]  = useState<SpareItem[]>([]);
  const [showNewStock,setShowNewStock]= useState(false);

  // LPO state
  const [lpoItems,    setLpoItems]    = useState<LPOItem[]>([]);
  const [showNewLPO,  setShowNewLPO]  = useState(false);
  const [lpoFilter,   setLpoFilter]   = useState<LPOStatus | 'all'>('all');
  const [expandedLPO, setExpandedLPO] = useState<string | null>(null);

  // Stock form
  const [sName,       setSName]       = useState('');
  const [sPartNum,    setSPartNum]    = useState('');
  const [sDesc,       setSDesc]       = useState('');
  const [sCategory,   setSCategory]   = useState('Other');
  const [sQty,        setSQty]        = useState('');
  const [sMinQty,     setSMinQty]     = useState('');
  const [sUnit,       setSUnit]       = useState('pcs');
  const [sLocation,   setSLocation]   = useState('');
  const [sSupplier,   setSSupplier]   = useState('');
  const [sCost,       setSCost]       = useState('');
  const [sNotes,      setSNotes]      = useState('');
  const [sSaving,     setSSaving]     = useState(false);

  // LPO form
  const [lTitle,      setLTitle]      = useState('');
  const [lDesc,       setLDesc]       = useState('');
  const [lStatus,     setLStatus]     = useState<LPOStatus>('lpo_to_raise');
  const [lPriority,   setLPriority]   = useState<'low'|'medium'|'high'|'critical'>('medium');
  const [lSupplier,   setLSupplier]   = useState('');
  const [lEquipTag,   setLEquipTag]   = useState('');
  const [lItems,      setLItems]      = useState('');
  const [lCost,       setLCost]       = useState('');
  const [lCurrency,   setLCurrency]   = useState('NGN');
  const [lRaisedBy,   setLRaisedBy]   = useState('');
  const [lApprovedBy, setLApprovedBy] = useState('');
  const [lWaybill,    setLWaybill]    = useState('');
  const [lInvoice,    setLInvoice]    = useState('');
  const [lVendorQ,    setLVendorQ]    = useState('');
  const [lJobDesc,    setLJobDesc]    = useState('');
  const [lContractor, setLContractor] = useState('');
  const [lOutsourced, setLOutsourced] = useState(false);
  const [lNotes,      setLNotes]      = useState('');
  const [lSaving,     setLSaving]     = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);
      const [p, eq] = await Promise.all([
        getProfile(supabase, user.id),
        getEquipment(supabase, user.id),
      ]);
      setProfile(p);
      setEquipment(eq || []);
      setLRaisedBy((p as any)?.full_name || '');

      // Load from local storage
      const inv = useLocalInventory(user.id);
      setStockItems(inv.getStock());
      setLpoItems(inv.getLPO());
    }
    load();
  }, []);

  const inv = userId ? useLocalInventory(userId) : null;

  // ── Save new stock item ────────────────────────────────────
  function handleSaveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim() || !inv) return;
    setSSaving(true);
    const qty = parseInt(sQty) || 0;
    const minQty = parseInt(sMinQty) || 1;
    const item: SpareItem = {
      id:           genId(),
      name:         sName.trim(),
      part_number:  sPartNum.trim() || undefined,
      description:  sDesc.trim() || undefined,
      category:     sCategory,
      quantity:     qty,
      min_quantity: minQty,
      unit:         sUnit,
      location:     sLocation.trim() || undefined,
      supplier:     sSupplier.trim() || undefined,
      unit_cost:    sCost ? parseFloat(sCost) : undefined,
      status:       qty === 0 ? 'out_of_stock' : qty <= minQty ? 'low_stock' : 'in_stock',
      last_updated: new Date().toISOString(),
      notes:        sNotes.trim() || undefined,
    };
    const updated = [...stockItems, item];
    setStockItems(updated);
    inv.saveStock(updated);
    setSName(''); setSPartNum(''); setSDesc(''); setSCategory('Other');
    setSQty(''); setSMinQty(''); setSUnit('pcs'); setSLocation('');
    setSSupplier(''); setSCost(''); setSNotes('');
    setShowNewStock(false);
    setSSaving(false);
  }

  // ── Update stock quantity ──────────────────────────────────
  function updateStockQty(id: string, delta: number) {
    if (!inv) return;
    const updated = stockItems.map(s => {
      if (s.id !== id) return s;
      const qty = Math.max(0, s.quantity + delta);
      return {
        ...s,
        quantity:     qty,
        status:       qty === 0 ? 'out_of_stock' as StockStatus : qty <= s.min_quantity ? 'low_stock' as StockStatus : 'in_stock' as StockStatus,
        last_updated: new Date().toISOString(),
      };
    });
    setStockItems(updated);
    inv.saveStock(updated);
  }

  // ── Delete stock item ──────────────────────────────────────
  function deleteStock(id: string) {
    if (!inv || !confirm('Delete this item?')) return;
    const updated = stockItems.filter(s => s.id !== id);
    setStockItems(updated);
    inv.saveStock(updated);
  }

  // ── Save new LPO ───────────────────────────────────────────
  function handleSaveLPO(e: React.FormEvent) {
    e.preventDefault();
    if (!lTitle.trim() || !inv) return;
    setLSaving(true);
    const existing = lpoItems;
    const lpoNum   = `LPO-${String(existing.length + 1).padStart(4, '0')}`;
    const item: LPOItem = {
      id:             genId(),
      lpo_number:     lpoNum,
      title:          lTitle.trim(),
      description:    lDesc.trim() || undefined,
      status:         lStatus,
      priority:       lPriority,
      supplier:       lSupplier.trim() || undefined,
      equipment_tag:  lEquipTag || undefined,
      items:          lItems.trim() || 'See description',
      total_cost:     lCost ? parseFloat(lCost) : undefined,
      currency:       lCurrency,
      raised_by:      lRaisedBy.trim() || undefined,
      approved_by:    lApprovedBy.trim() || undefined,
      date_raised:    lStatus !== 'lpo_to_raise' ? new Date().toISOString() : undefined,
      vendor_quotes:  lVendorQ.trim() || undefined,
      waybill_number: lWaybill.trim() || undefined,
      invoice_number: lInvoice.trim() || undefined,
      job_description:lJobDesc.trim() || undefined,
      is_outsourced:  lOutsourced,
      contractor:     lContractor.trim() || undefined,
      notes:          lNotes.trim() || undefined,
      created_at:     new Date().toISOString(),
    };
    const updated = [...lpoItems, item];
    setLpoItems(updated);
    inv.saveLPO(updated);
    setLTitle(''); setLDesc(''); setLStatus('lpo_to_raise'); setLPriority('medium');
    setLSupplier(''); setLEquipTag(''); setLItems(''); setLCost('');
    setLRaisedBy(profile?.full_name || ''); setLApprovedBy('');
    setLWaybill(''); setLInvoice(''); setLVendorQ(''); setLJobDesc('');
    setLContractor(''); setLOutsourced(false); setLNotes('');
    setShowNewLPO(false);
    setLSaving(false);
  }

  // ── Advance LPO to next stage ──────────────────────────────
  function advanceLPO(id: string) {
    if (!inv) return;
    const order = LPO_PIPELINE.map(s => s.key);
    const updated = lpoItems.map(l => {
      if (l.id !== id) return l;
      const idx = order.indexOf(l.status);
      if (idx >= order.length - 1) return l;
      const newStatus = order[idx + 1];
      const now = new Date().toISOString();
      return {
        ...l,
        status:         newStatus,
        date_approved:  newStatus === 'po_approved'  ? now : l.date_approved,
        date_received:  newStatus === 'received'     ? now : l.date_received,
        date_completed: newStatus === 'job_completed'? now : l.date_completed,
      };
    });
    setLpoItems(updated);
    inv.saveLPO(updated);
  }

  // ── Delete LPO ─────────────────────────────────────────────
  function deleteLPO(id: string) {
    if (!inv || !confirm('Delete this LPO?')) return;
    const updated = lpoItems.filter(l => l.id !== id);
    setLpoItems(updated);
    inv.saveLPO(updated);
  }

  // ── Filtered items ─────────────────────────────────────────
  const filteredStock = stockItems.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) ||
      (s.part_number || '').toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q);
  });

  const filteredLPO = lpoItems.filter(l => {
    const matchStatus = lpoFilter === 'all' || l.status === lpoFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.title.toLowerCase().includes(q) ||
      (l.lpo_number || '').toLowerCase().includes(q) ||
      (l.supplier || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }).filter(l => tab === 'outsourcing' ? l.is_outsourced : !l.is_outsourced || tab === 'lpo');

  // ── Stats ──────────────────────────────────────────────────
  const lowStock    = stockItems.filter(s => s.status === 'low_stock' || s.status === 'out_of_stock').length;
  const openLPO     = lpoItems.filter(l => l.status !== 'job_completed').length;
  const inTransit   = lpoItems.filter(l => l.status === 'in_transit').length;
  const outsourced  = lpoItems.filter(l => l.is_outsourced && l.status !== 'job_completed').length;

  return (
    <AppShell title="Inventory & Procurement">
      {/* ── Summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Stock Items',   value: stockItems.length,    color: 'var(--blue)',   icon: <Package size={15}/> },
          { label: 'Low/Out Stock', value: lowStock,             color: 'var(--red)',    icon: <TrendingDown size={15}/> },
          { label: 'Open LPOs',     value: openLPO,              color: 'var(--amber)',  icon: <FileText size={15}/> },
          { label: 'In Transit',    value: inTransit,            color: 'var(--purple)', icon: <Truck size={15}/> },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3"
            style={{ borderLeft: `3px solid ${s.color}` }}>
            <div className="p-2 rounded-lg" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'stock',       label: '📦 Stock',       badge: lowStock > 0 ? lowStock : 0 },
          { key: 'lpo',         label: '📋 LPOs',        badge: openLPO },
          { key: 'outsourcing', label: '🔧 Outsourcing', badge: outsourced },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setSearch(''); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all relative"
            style={{
              background: tab === t.key ? 'var(--amber)' : 'var(--card)',
              color:      tab === t.key ? '#000'         : 'var(--text-2)',
              border:     tab === t.key ? 'none'         : '1px solid var(--border)',
            }}>
            {t.label}
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: tab === t.key ? 'rgba(0,0,0,0.2)' : 'var(--red)',
                  color:      tab === t.key ? '#000' : '#fff',
                  fontSize: 9,
                }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search ────────────────────────────────────────── */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'stock' ? 'Search parts, part numbers…' : 'Search LPOs, suppliers…'}
          className="form-input pl-9"/>
      </div>

      {/* ══════════════════════════════════════════════════════
          STOCK TAB
      ══════════════════════════════════════════════════════ */}
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

          {/* ── New stock form ─────────────────────────── */}
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
                    <input className="form-input" placeholder="e.g. 32A MCB" required value={sName} onChange={e => setSName(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Part Number</label>
                    <input className="form-input font-mono" placeholder="e.g. MCB-32A-001" value={sPartNum} onChange={e => setSPartNum(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={sCategory} onChange={e => setSCategory(e.target.value)}>
                    {STOCK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label req">Qty in Store</label>
                    <input type="number" min="0" className="form-input" placeholder="0" required value={sQty} onChange={e => setSQty(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Min Qty</label>
                    <input type="number" min="0" className="form-input" placeholder="1" value={sMinQty} onChange={e => setSMinQty(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Unit</label>
                    <select className="form-input" value={sUnit} onChange={e => setSUnit(e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Store Location</label>
                    <input className="form-input" placeholder="e.g. Shelf B3" value={sLocation} onChange={e => setSLocation(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Supplier</label>
                    <input className="form-input" placeholder="Supplier name" value={sSupplier} onChange={e => setSSupplier(e.target.value)}/>
                  </div>
                </div>
                <div>
                  <label className="form-label">Unit Cost (₦)</label>
                  <input type="number" min="0" className="form-input" placeholder="0.00" value={sCost} onChange={e => setSCost(e.target.value)}/>
                </div>
                <div>
                  <label className="form-label">Description / Notes</label>
                  <textarea className="form-input" rows={2} placeholder="Specifications, where used, etc." value={sNotes} onChange={e => setSNotes(e.target.value)}/>
                </div>
                <button type="submit" disabled={sSaving}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: 'var(--blue)', color: '#fff' }}>
                  {sSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  Save to Store
                </button>
              </form>
            </div>
          )}

          {/* ── Low stock alert ────────────────────────── */}
          {lowStock > 0 && (
            <div className="card mb-4 flex items-start gap-3"
              style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }}/>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                <span className="font-bold" style={{ color: 'var(--red)' }}>{lowStock} item{lowStock > 1 ? 's' : ''}</span> below minimum stock level — raise an LPO to replenish.
              </p>
            </div>
          )}

          {/* ── Stock list ─────────────────────────────── */}
          {filteredStock.length === 0 ? (
            <div className="card text-center py-10">
              <Package size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {search ? 'No items match' : 'No stock items yet'}
              </p>
              {!search && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Add spare parts and materials to your store</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStock.map(item => (
                <div key={item.id} className="card"
                  style={{ borderLeft: `3px solid ${item.status === 'out_of_stock' ? 'var(--red)' : item.status === 'low_stock' ? 'var(--amber)' : 'var(--green)'}` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {item.part_number && <span className="tag-chip text-xs">{item.part_number}</span>}
                        <StockBadge status={item.status}/>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{item.category}</span>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.name}</p>
                      {item.description && <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{item.description}</p>}
                    </div>
                    <button onClick={() => deleteStock(item.id)} style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                      <X size={14}/>
                    </button>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateStockQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        −
                      </button>
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold font-mono" style={{ color: item.status === 'out_of_stock' ? 'var(--red)' : item.status === 'low_stock' ? 'var(--amber)' : 'var(--text)' }}>
                          {item.quantity}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{item.unit}</p>
                      </div>
                      <button onClick={() => updateStockQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        +
                      </button>
                    </div>
                    <div className="text-xs space-y-0.5 ml-2" style={{ color: 'var(--text-3)' }}>
                      {item.location && <p>📍 {item.location}</p>}
                      {item.supplier && <p>🏭 {item.supplier}</p>}
                      {item.unit_cost && <p>💰 ₦{item.unit_cost.toLocaleString()} / {item.unit}</p>}
                    </div>
                    <div className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
                      Min: {item.min_quantity} {item.unit}
                    </div>
                  </div>
                  {item.notes && (
                    <p className="text-xs mt-2 pt-2 leading-snug" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          LPO / OUTSOURCING TABS
      ══════════════════════════════════════════════════════ */}
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

          {/* LPO pipeline summary */}
          {tab === 'lpo' && (
            <div className="mb-4 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {LPO_PIPELINE.map((stage, i) => {
                  const count = lpoItems.filter(l => l.status === stage.key && !l.is_outsourced).length;
                  return (
                    <div key={stage.key} className="flex items-center gap-1">
                      <button
                        onClick={() => setLpoFilter(lpoFilter === stage.key ? 'all' : stage.key)}
                        className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl text-center transition-all"
                        style={{
                          background: lpoFilter === stage.key ? `${stage.color}20` : 'var(--card)',
                          border: `1px solid ${lpoFilter === stage.key ? stage.color + '40' : 'var(--border)'}`,
                          minWidth: 70,
                        }}>
                        <span style={{ color: stage.color }}>{stage.icon}</span>
                        <span className="text-lg font-bold font-mono" style={{ color: stage.color }}>{count}</span>
                        <span className="text-xs leading-tight text-center" style={{ color: 'var(--text-3)', fontSize: 9 }}>
                          {stage.label}
                        </span>
                      </button>
                      {i < LPO_PIPELINE.length - 1 && (
                        <ArrowRight size={12} style={{ color: 'var(--border)', flexShrink: 0 }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── New LPO form ───────────────────────────── */}
          {showNewLPO && (
            <div className="card mb-4" style={{ border: '1px solid rgba(240,165,0,0.25)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
                  📋 {tab === 'outsourcing' ? 'New Outsourced Job' : 'New Purchase Order'}
                </p>
                <button onClick={() => setShowNewLPO(false)} style={{ color: 'var(--text-3)' }}><X size={15}/></button>
              </div>
              <form onSubmit={handleSaveLPO} className="space-y-3">
                <div>
                  <label className="form-label req">Title / Description</label>
                  <input className="form-input" placeholder="e.g. Procurement of 32A MCBs for MCC panel" required value={lTitle} onChange={e => setLTitle(e.target.value)}/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Priority</label>
                    <select className="form-input" value={lPriority} onChange={e => setLPriority(e.target.value as any)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Initial Stage</label>
                    <select className="form-input" value={lStatus} onChange={e => setLStatus(e.target.value as LPOStatus)}>
                      {LPO_PIPELINE.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Items to Procure</label>
                  <textarea className="form-input" rows={3}
                    placeholder="e.g. 10× 32A MCB (Schneider), 5× Contactor 40A, 2× Cable reel 16mm²"
                    value={lItems} onChange={e => setLItems(e.target.value)}/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Estimated Cost</label>
                    <input type="number" min="0" className="form-input" placeholder="0.00" value={lCost} onChange={e => setLCost(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select className="form-input" value={lCurrency} onChange={e => setLCurrency(e.target.value)}>
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
                    <input className="form-input" placeholder="Supplier name" value={lSupplier} onChange={e => setLSupplier(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Related Equipment</label>
                    <select className="form-input" value={lEquipTag} onChange={e => setLEquipTag(e.target.value)}>
                      <option value="">— None —</option>
                      {equipment.map(eq => <option key={eq.id} value={eq.tag_id}>{eq.tag_id} — {eq.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Raised By</label>
                    <input className="form-input" placeholder="Engineer name" value={lRaisedBy} onChange={e => setLRaisedBy(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Approved By</label>
                    <input className="form-input" placeholder="Approver name" value={lApprovedBy} onChange={e => setLApprovedBy(e.target.value)}/>
                  </div>
                </div>

                <div>
                  <label className="form-label">Comparative Analysis / Vendor Quotes</label>
                  <textarea className="form-input" rows={2}
                    placeholder="e.g. Vendor A: ₦45,000 | Vendor B: ₦42,000 (selected) | Vendor C: ₦48,500"
                    value={lVendorQ} onChange={e => setLVendorQ(e.target.value)}/>
                </div>

                {/* Outsourcing toggle */}
                <div className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" id="outsourced" checked={lOutsourced}
                    onChange={e => setLOutsourced(e.target.checked)} className="w-4 h-4 accent-amber-400"/>
                  <label htmlFor="outsourced" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    This is an outsourced job / contract
                  </label>
                </div>

                {lOutsourced && (
                  <>
                    <div>
                      <label className="form-label">Contractor / Service Company</label>
                      <input className="form-input" placeholder="Contractor name" value={lContractor} onChange={e => setLContractor(e.target.value)}/>
                    </div>
                    <div>
                      <label className="form-label">Job Description / Scope of Work</label>
                      <textarea className="form-input" rows={3}
                        placeholder="Detailed scope of work, deliverables, timeline…"
                        value={lJobDesc} onChange={e => setLJobDesc(e.target.value)}/>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Waybill Number</label>
                    <input className="form-input font-mono" placeholder="WB-001" value={lWaybill} onChange={e => setLWaybill(e.target.value)}/>
                  </div>
                  <div>
                    <label className="form-label">Invoice Number</label>
                    <input className="form-input font-mono" placeholder="INV-001" value={lInvoice} onChange={e => setLInvoice(e.target.value)}/>
                  </div>
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} placeholder="Additional notes…" value={lNotes} onChange={e => setLNotes(e.target.value)}/>
                </div>

                <button type="submit" disabled={lSaving}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: 'var(--amber)', color: '#000' }}>
                  {lSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  Create {tab === 'outsourcing' ? 'Job' : 'LPO'}
                </button>
              </form>
            </div>
          )}

          {/* ── LPO / Job list ─────────────────────────── */}
          {filteredLPO.length === 0 ? (
            <div className="card text-center py-10">
              <FileText size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                {search || lpoFilter !== 'all' ? 'No entries match' : `No ${tab === 'outsourcing' ? 'outsourced jobs' : 'LPOs'} yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLPO.map(lpo => {
                const stage = LPO_PIPELINE.find(s => s.key === lpo.status)!;
                const stageIdx = LPO_PIPELINE.findIndex(s => s.key === lpo.status);
                const isExpanded = expandedLPO === lpo.id;
                const isDone = lpo.status === 'job_completed';
                return (
                  <div key={lpo.id} className="card"
                    style={{ borderLeft: `3px solid ${PRIORITY_COLOR[lpo.priority]}` }}>
                    {/* Header */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {lpo.lpo_number && (
                            <span className="tag-chip text-xs font-mono">{lpo.lpo_number}</span>
                          )}
                          <span className="chip text-xs"
                            style={{
                              background: `${PRIORITY_COLOR[lpo.priority]}18`,
                              color:      PRIORITY_COLOR[lpo.priority],
                              border:     `1px solid ${PRIORITY_COLOR[lpo.priority]}30`,
                              fontSize: 9, padding: '1px 7px', textTransform: 'uppercase',
                            }}>
                            {lpo.priority}
                          </span>
                          {lpo.is_outsourced && (
                            <span className="chip text-xs"
                              style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.25)', fontSize: 9, padding: '1px 7px' }}>
                              🔧 Outsourced
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{lpo.title}</p>
                        <LPOBadge status={lpo.status}/>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedLPO(isExpanded ? null : lpo.id)}
                          style={{ color: 'var(--text-3)' }}>
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                        <button onClick={() => deleteLPO(lpo.id)} style={{ color: 'var(--text-3)' }}>
                          <X size={14}/>
                        </button>
                      </div>
                    </div>

                    {/* Mini pipeline progress bar */}
                    <div className="flex items-center gap-1 mt-3">
                      {LPO_PIPELINE.map((s, i) => (
                        <div key={s.key} className="flex-1 h-1.5 rounded-full transition-all"
                          style={{ background: i <= stageIdx ? stage.color : 'var(--border)' }}/>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                      Stage {stageIdx + 1} of {LPO_PIPELINE.length} · {fmtRelative(lpo.created_at)}
                    </p>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                        {lpo.items && (
                          <div>
                            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-3)' }}>ITEMS</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{lpo.items}</p>
                          </div>
                        )}
                        {lpo.vendor_quotes && (
                          <div>
                            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-3)' }}>COMPARATIVE ANALYSIS</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{lpo.vendor_quotes}</p>
                          </div>
                        )}
                        {lpo.job_description && (
                          <div>
                            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-3)' }}>SCOPE OF WORK</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{lpo.job_description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {lpo.supplier    && <p style={{ color: 'var(--text-3)' }}>Supplier: <span style={{ color: 'var(--text-2)' }}>{lpo.supplier}</span></p>}
                          {lpo.contractor  && <p style={{ color: 'var(--text-3)' }}>Contractor: <span style={{ color: 'var(--text-2)' }}>{lpo.contractor}</span></p>}
                          {lpo.total_cost  && <p style={{ color: 'var(--text-3)' }}>Cost: <span style={{ color: 'var(--amber)' }} className="font-bold">{lpo.currency} {lpo.total_cost.toLocaleString()}</span></p>}
                          {lpo.raised_by   && <p style={{ color: 'var(--text-3)' }}>Raised by: <span style={{ color: 'var(--text-2)' }}>{lpo.raised_by}</span></p>}
                          {lpo.approved_by && <p style={{ color: 'var(--text-3)' }}>Approved by: <span style={{ color: 'var(--text-2)' }}>{lpo.approved_by}</span></p>}
                          {lpo.equipment_tag && <p style={{ color: 'var(--text-3)' }}>Equipment: <span className="tag-chip" style={{ fontSize: 10 }}>{lpo.equipment_tag}</span></p>}
                          {lpo.waybill_number && <p style={{ color: 'var(--text-3)' }}>Waybill: <span className="font-mono" style={{ color: 'var(--text-2)' }}>{lpo.waybill_number}</span></p>}
                          {lpo.invoice_number && <p style={{ color: 'var(--text-3)' }}>Invoice: <span className="font-mono" style={{ color: 'var(--text-2)' }}>{lpo.invoice_number}</span></p>}
                        </div>
                        {lpo.notes && (
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{lpo.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Advance button */}
                    {!isDone && (
                      <button
                        onClick={() => advanceLPO(lpo.id)}
                        className="w-full mt-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                        style={{ background: `${stage.color}15`, color: stage.color, border: `1px solid ${stage.color}30` }}>
                        <ArrowRight size={13}/>
                        Advance to: {LPO_PIPELINE[stageIdx + 1]?.label || 'Complete'}
                      </button>
                    )}
                    {isDone && (
                      <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(52,208,88,0.08)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                        <CheckCircle size={13}/> Job Completed
                        {lpo.date_completed && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {fmtDate(lpo.date_completed)}</span>}
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
