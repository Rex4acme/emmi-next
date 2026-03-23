'use client';
// app/equipment/page.tsx — Equipment List
// Displays all equipment as cards with status colour, fault count badges.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getEquipment } from '@/lib/db';
import { statusBg, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import { Plus, Search, Cpu } from 'lucide-react';
import type { Equipment } from '@/types';

export default function EquipmentPage() {
  const supabase = createBrowserClient();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getEquipment(supabase, user.id);
      setEquipment(data);
      setLoading(false);
    }
    load();
  }, []);

  // Filter and search client-side
  const filtered = equipment.filter(eq => {
    const matchStatus = filter === 'all' || eq.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      eq.tag_id.toLowerCase().includes(q) ||
      eq.name.toLowerCase().includes(q) ||
      (eq.location || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const TABS = [
    { key: 'all',              label: 'All',         count: equipment.length },
    { key: 'operational',      label: 'Operational',  count: equipment.filter(e => e.status === 'operational').length },
    { key: 'faulty',           label: 'Faulty',       count: equipment.filter(e => e.status === 'faulty').length },
    { key: 'under_maintenance',label: 'Maintenance',  count: equipment.filter(e => e.status === 'under_maintenance').length },
  ];

  return (
    <AppShell
      title="Equipment"
      action={
        <Link href="/equipment/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--blue)', color: '#fff' }}>
            <Plus size={13}/>Add
          </button>
        </Link>
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tag, name, location…" className="form-input pl-9"/>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === tab.key ? 'var(--blue)' : 'var(--card)',
              color:      filter === tab.key ? '#fff' : 'var(--text-2)',
              border:     filter === tab.key ? 'none' : '1px solid var(--border)',
            }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: filter === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--surface)',
                  color: filter === tab.key ? '#fff' : 'var(--text-2)',
                }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Equipment cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Cpu size={32} className="mx-auto mb-3" style={{ color: 'var(--text-3)' }}/>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {search || filter !== 'all' ? 'No equipment matches' : 'No equipment added yet'}
          </p>
          {!search && filter === 'all' && (
            <Link href="/equipment/new">
              <button className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--blue)', color: '#fff' }}>
                Add First Equipment
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(eq => (
            <Link key={eq.id} href={`/equipment/${eq.id}`}>
              <div className="card hover:border-white/20 transition-colors h-full">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="tag-chip">{eq.tag_id}</span>
                    {eq.category && (
                      <span className="ml-2 text-lg">{eq.category.icon}</span>
                    )}
                  </div>
                  {/* Status badge with colour */}
                  <span className="chip text-[11px] flex-shrink-0"
                    style={{
                      background: eq.status === 'operational' ? 'rgba(52,208,88,0.1)' :
                                  eq.status === 'faulty' ? 'rgba(248,81,73,0.1)' :
                                  'rgba(240,165,0,0.1)',
                      color: eq.status === 'operational' ? 'var(--green)' :
                             eq.status === 'faulty' ? 'var(--red)' :
                             'var(--amber)',
                      border: eq.status === 'operational' ? '1px solid rgba(52,208,88,0.25)' :
                              eq.status === 'faulty' ? '1px solid rgba(248,81,73,0.25)' :
                              '1px solid rgba(240,165,0,0.25)',
                    }}>
                    {statusLabel(eq.status)}
                  </span>
                </div>

                <h3 className="text-sm font-semibold leading-snug mb-1">{eq.name}</h3>

                {/* Details */}
                <div className="text-xs space-y-0.5" style={{ color: 'var(--text-2)' }}>
                  {eq.location && <p>📍 {eq.location}</p>}
                  {eq.manufacturer && <p>{eq.manufacturer}{eq.model ? ` · ${eq.model}` : ''}</p>}
                  {eq.voltage_rating && <p className="font-mono" style={{ color: 'var(--text-3)' }}>{eq.voltage_rating}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
