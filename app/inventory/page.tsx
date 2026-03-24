'use client';
// app/inventory/page.tsx — Spare Parts & Inventory Management
// Engineers log spare parts, request stock, track usage per equipment.
// All data saved to Supabase spare_parts table.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import {
  Package, Plus, Search, AlertTriangle,
  CheckCircle, X, Loader2, Edit2, Trash2,
  ChevronDown, ChevronUp, Tag,
} from 'lucide-react';

interface SparePart {
  id:            string;
  user_id:       string;
  org_id?:       string;
  name:          string;
  part_number?:  string;
  category:      string;
  equipment_tag?: string;
  quantity:      number;
  minimum_qty:   number;
  unit:          string;
  location?:     string;
  supplier?:     string;
  unit_cost?:    number;
  notes?:        string;
  created_at:    string;
  updated_at:    string;
}

const CATEGORIES = [
  'All', 'Bearings', 'Cables & Wiring', 'Circuit Breakers', 'Contactors',
  'Drives & VFDs', 'Fuses', 'Motors', 'Relays', 'Sensors',
  'Switches', 'Transformers', 'Other',
];

const UNITS = ['pcs', 'metres', 'kg', 'litres', 'rolls', 'sets', 'pairs', 'boxes'];

const BLANK: Omit<SparePart, 'id'|'user_id'|'created_at'|'updated_at'> = {
  name: '', part_number: '', category: 'Other', equipment_tag: '',
  quantity: 0, minimum_qty: 1, unit: 'pcs',
  location: '', supplier: '', unit_cost: undefined, notes: '',
};

export default function InventoryPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [parts,      setParts]      = useState<SparePart[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('All');
  const [showLowOnly,setShowLow]    = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<SparePart | null>(null);
  const [form,       setForm]       = useState({ ...BLANK });
  const [userId,     setUserId]     = useState('');
  const [orgId,      setOrgId]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles').select('org_id').eq('id', user.id).single();
      setOrgId(profile?.org_id || null);

      await fetchParts(user.id, profile?.org_id);
    }
    load();
  }, []);

  async function fetchParts(uid: string, oid?: string | null) {
    setLoading(true);
    let query = supabase.from('spare_parts').select('*').order('name');

    // Org members share inventory; solo engineers see only own
    if (oid) {
      query = query.eq('org_id', oid);
    } else {
      query = query.eq('user_id', uid);
    }

    const { data, error } = await query;
    if (!error) setParts(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK });
    setShowForm(true);
  }

  function openEdit(part: SparePart) {
    setEditing(part);
    setForm({
      name: part.name, part_number: part.part_number || '',
      category: part.category, equipment_tag: part.equipment_tag || '',
      quantity: part.quantity, minimum_qty: part.minimum_qty,
      unit: part.unit, location: part.location || '',
      supplier: part.supplier || '', unit_cost: part.unit_cost,
      notes: part.notes || '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      user_id:    userId,
      org_id:     orgId || null,
      name:       form.name.trim(),
      part_number: form.part_number?.trim() || null,
      equipment_tag: form.equipment_tag?.trim() || null,
      location:   form.location?.trim() || null,
      supplier:   form.supplier?.trim() || null,
      notes:      form.notes?.trim() || null,
      unit_cost:  form.unit_cost ?? null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from('spare_parts').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('spare_parts').insert({ ...payload, created_at: new Date().toISOString() });
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    await fetchParts(userId, orgId);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this spare part?')) return;
    await supabase.from('spare_parts').delete().eq('id', id);
    setParts(prev => prev.filter(p => p.id !== id));
  }

  async function adjustQty(part: SparePart, delta: number) {
    const newQty = Math.max(0, part.quantity + delta);
    await supabase.from('spare_parts')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', part.id);
    setParts(prev => prev.map(p => p.id === part.id ? { ...p, quantity: newQty } : p));
  }

  // Filter
  const filtered = parts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      || p.part_number?.toLowerCase().includes(search.toLowerCase())
      || p.equipment_tag?.toLowerCase().includes(search.toLowerCase());
    const matchCat  = category === 'All' || p.category === category;
    const matchLow  = !showLowOnly || p.quantity <= p.minimum_qty;
    return matchSearch && matchCat && matchLow;
  });

  const lowStockCount = parts.filter(p => p.quantity <= p.minimum_qty).length;

  const totalValue = parts.reduce((sum, p) =>
    sum + (p.unit_cost ? p.unit_cost * p.quantity : 0), 0);

  function F({ k, label, type = 'text', options, placeholder, required }: any) {
    const val = (form as any)[k];
    return (
      <div>
        <label className="form-label" style={required ? {} : {}}>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
        {options ? (
          <select className="form-input" value={val} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}>
            {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} className="form-input" value={val ?? ''} placeholder={placeholder}
            onChange={e => setForm(f => ({ ...f, [k]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
            required={required}/>
        )}
      </div>
    );
  }

  return (
    <AppShell title="Inventory">
      <div className="max-w-3xl">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--blue)' }}>{parts.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Part Types</p>
          </div>
          <div className="card text-center py-3" onClick={() => setShowLow(v => !v)} style={{ cursor: 'pointer', border: lowStockCount > 0 ? '1px solid rgba(248,81,73,0.3)' : '' }}>
            <p className="text-2xl font-bold font-mono" style={{ color: lowStockCount > 0 ? 'var(--red)' : 'var(--green)' }}>{lowStockCount}</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Low Stock</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--amber)' }}>
              {totalValue > 0 ? `₦${totalValue.toLocaleString()}` : '—'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Est. Value</p>
          </div>
        </div>

        {/* Search + filter bar */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 form-input" style={{ minWidth: 180, padding: '0 12px' }}>
            <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, part no, equipment…"
              style={{ background: 'none', border: 'none', outline: 'none', width: '100%', color: 'var(--text)', fontSize: 13 }}/>
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={13}/></button>}
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="form-input" style={{ minWidth: 130, fontSize: 12 }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'var(--amber)', color: '#000', flexShrink: 0 }}>
            <Plus size={16}/> Add Part
          </button>
        </div>

        {/* Low stock banner */}
        {showLowOnly && lowStockCount > 0 && (
          <div className="card mb-4 flex items-center gap-3"
            style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0 }}/>
            <p className="text-xs" style={{ color: 'var(--red)' }}>
              Showing {lowStockCount} low-stock item{lowStockCount > 1 ? 's' : ''}. Tap again to show all.
            </p>
            <button onClick={() => setShowLow(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              <X size={14}/>
            </button>
          </div>
        )}

        {/* Parts list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 72 }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Package size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
              {parts.length === 0 ? 'No spare parts yet' : 'No results'}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
              {parts.length === 0 ? 'Add your first spare part to start tracking inventory' : 'Try a different search or category'}
            </p>
            {parts.length === 0 && (
              <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: 'var(--amber)', color: '#000' }}>+ Add First Part</button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(part => {
              const isLow = part.quantity <= part.minimum_qty;
              return (
                <div key={part.id} className="card" style={{ borderLeft: `3px solid ${isLow ? 'var(--red)' : 'var(--green)'}` }}>
                  <div className="flex items-start gap-3">
                    {/* Status dot */}
                    <div className="mt-1 flex-shrink-0">
                      {isLow
                        ? <AlertTriangle size={14} style={{ color: 'var(--red)' }}/>
                        : <CheckCircle size={14} style={{ color: 'var(--green)' }}/>
                      }
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{part.name}</p>
                        {part.part_number && (
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                            {part.part_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{part.category}</span>
                        {part.equipment_tag && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--amber)' }}>
                            <Tag size={10}/>{part.equipment_tag}
                          </span>
                        )}
                        {part.location && (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>📍 {part.location}</span>
                        )}
                        {part.unit_cost && (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                            ₦{part.unit_cost.toLocaleString()}/{part.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity adjuster */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button onClick={() => adjustQty(part, -1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 16 }}>
                          −
                        </button>
                        <div className="text-center" style={{ minWidth: 40 }}>
                          <p className="text-base font-bold font-mono" style={{ color: isLow ? 'var(--red)' : 'var(--text)', lineHeight: 1 }}>{part.quantity}</p>
                          <p style={{ fontSize: 9, color: 'var(--text-3)' }}>{part.unit}</p>
                        </div>
                        <button onClick={() => adjustQty(part, 1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 16 }}>
                          +
                        </button>
                      </div>
                      {isLow && (
                        <p style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700 }}>Min: {part.minimum_qty}</p>
                      )}
                    </div>

                    {/* Edit / Delete */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(part)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        <Edit2 size={12}/>
                      </button>
                      <button onClick={() => handleDelete(part.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', color: 'var(--red)' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Edit form modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', padding: '0' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', background: 'var(--base)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold" style={{ color: '#fff' }}>
                  {editing ? 'Edit Spare Part' : 'Add Spare Part'}
                </h2>
                <button onClick={() => setShowForm(false)}
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
                  <X size={16}/>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <F k="name"         label="Part Name"      required placeholder="e.g. Deep Groove Bearing 6205"/>
                <div className="grid grid-cols-2 gap-3">
                  <F k="part_number"  label="Part Number"    placeholder="6205-2RS"/>
                  <F k="category"     label="Category"       options={CATEGORIES.filter(c => c !== 'All')}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F k="equipment_tag" label="Equipment Tag"  placeholder="MTR-001"/>
                  <F k="location"      label="Store Location" placeholder="Store A, Shelf 3"/>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <F k="quantity"    label="Qty in Stock" type="number" placeholder="0"/>
                  <F k="minimum_qty" label="Min Qty"      type="number" placeholder="2"/>
                  <F k="unit"        label="Unit"         options={UNITS}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F k="supplier"  label="Supplier"    placeholder="Vendor name"/>
                  <F k="unit_cost" label="Unit Cost (₦)" type="number" placeholder="0"/>
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Compatible models, storage conditions, etc."/>
                </div>

                <button type="submit" disabled={saving || !form.name.trim()}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-2"
                  style={{ background: saving ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
                  {saving ? <><Loader2 size={15} className="animate-spin"/> Saving…</> : `${editing ? 'Save Changes' : 'Add Spare Part'}`}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}