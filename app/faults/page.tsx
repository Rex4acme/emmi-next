'use client';
// app/faults/page.tsx — Faults List Page
// Shows all logged faults with filter by status/severity, search,
// and colour-coded severity bars.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getFaults } from '@/lib/db';
import { fmtRelative, severityDot, statusLabel, statusBg } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import { Plus, Search, Filter, AlertTriangle } from 'lucide-react';
import type { Fault } from '@/types';

export default function FaultsPage() {
  const supabase = createBrowserClient();
  const [faults,  setFaults]  = useState<Fault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all'); // 'all' | status values

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getFaults(supabase, user.id);
      setFaults(data);
      setLoading(false);
    }
    load();
  }, []);

  // Apply search and status filter client-side
  const filtered = faults.filter(f => {
    const matchStatus = filter === 'all' || f.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || f.title.toLowerCase().includes(q)
      || (f.fault_code || '').toLowerCase().includes(q)
      || (f.equipment?.name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Status filter tabs
  const TABS = [
    { key: 'all',                  label: 'All',          count: faults.length },
    { key: 'open',                 label: 'Open',         count: faults.filter(f => f.status === 'open').length },
    { key: 'under_investigation',  label: 'Investigating', count: faults.filter(f => f.status === 'under_investigation').length },
    { key: 'recurring',            label: 'Recurring',    count: faults.filter(f => f.status === 'recurring').length },
    { key: 'resolved',             label: 'Resolved',     count: faults.filter(f => f.status === 'resolved').length },
  ];

  return (
    <AppShell
      title="Faults"
      action={
        <Link href="/faults/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--red)', color: '#fff' }}>
            <Plus size={13}/>Log Fault
          </button>
        </Link>
      }
    >
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}/>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search faults, codes, equipment…"
          className="form-input pl-9"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === tab.key ? 'var(--amber)' : 'var(--card)',
              color:      filter === tab.key ? '#000' : 'var(--text-2)',
              border:     filter === tab.key ? 'none' : '1px solid var(--border)',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: filter === tab.key ? 'rgba(0,0,0,0.2)' : 'var(--surface)',
                  color:      filter === tab.key ? '#000' : 'var(--text-2)',
                }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Fault list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: 'var(--text-3)' }}/>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {search || filter !== 'all' ? 'No faults match your filter' : 'No faults logged yet'}
          </p>
          {!search && filter === 'all' && (
            <Link href="/faults/new">
              <button className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--red)', color: '#fff' }}>
                Log First Fault
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(fault => (
            <Link key={fault.id} href={`/faults/${fault.id}`}>
              <div className="card flex items-stretch gap-0 overflow-hidden hover:border-white/20 transition-colors"
                style={{ padding: 0 }}>
                {/* Left severity colour bar */}
                <div className={`w-1 flex-shrink-0 sev-bar-${fault.severity}`}
                  style={{ borderRadius: '0' }}/>
                {/* Content */}
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Fault code + severity badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {fault.fault_code && (
                          <span className="tag-chip">{fault.fault_code}</span>
                        )}
                        <span className="text-xs font-medium">
                          {severityDot(fault.severity)} {fault.severity}
                        </span>
                        {fault.is_recurring && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)' }}>
                            recurring
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug">{fault.title}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                        {fault.equipment?.name || 'No equipment linked'}
                        {fault.fault_category && ` · ${fault.fault_category.icon} ${fault.fault_category.name}`}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                        {fmtRelative(fault.detected_at)}
                        {fault.downtime_minutes ? ` · ${fault.downtime_minutes}min downtime` : ''}
                      </p>
                    </div>
                    {/* Status badge */}
                    <span className="chip flex-shrink-0 text-[11px]"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                      }}>
                      {statusLabel(fault.status)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
