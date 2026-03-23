'use client';
// app/activities/page.tsx — Activities List
// Shows all maintenance activities with status filters and search.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getActivities } from '@/lib/db';
import { fmtRelative, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import { Plus, Search, ClipboardList } from 'lucide-react';
import type { Activity } from '@/types';

export default function ActivitiesPage() {
  const supabase = createBrowserClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getActivities(supabase, user.id);
      setActivities(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = activities.filter(a => {
    const matchStatus = filter === 'all' || a.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.title.toLowerCase().includes(q) ||
      (a.work_order_ref || '').toLowerCase().includes(q) ||
      (a.equipment?.name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const TABS = [
    { key: 'all',        label: 'All',         count: activities.length },
    { key: 'planned',    label: 'Planned',      count: activities.filter(a => a.status === 'planned').length },
    { key: 'in_progress',label: 'In Progress',  count: activities.filter(a => a.status === 'in_progress').length },
    { key: 'completed',  label: 'Completed',    count: activities.filter(a => a.status === 'completed').length },
  ];

  // Group by date for timeline display
  const grouped = filtered.reduce((acc, act) => {
    const date = act.scheduled_date ? act.scheduled_date.slice(0, 10) : 'No date';
    if (!acc[date]) acc[date] = [];
    acc[date].push(act);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <AppShell
      title="Activities"
      action={
        <Link href="/activities/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--blue)', color: '#fff' }}>
            <Plus size={13}/>New
          </button>
        </Link>
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search activities, work orders…" className="form-input pl-9"/>
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

      {/* Activity list grouped by date */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList size={32} className="mx-auto mb-3" style={{ color: 'var(--text-3)' }}/>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {search || filter !== 'all' ? 'No activities match' : 'No activities logged yet'}
          </p>
          {!search && filter === 'all' && (
            <Link href="/activities/new">
              <button className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--blue)', color: '#fff' }}>
                Log First Activity
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a)) // newest first
            .map(([date, acts]) => (
              <div key={date}>
                {/* Date group header */}
                <p className="text-xs font-bold mb-2 px-1" style={{ color: 'var(--text-3)' }}>
                  {date === 'No date' ? 'No date set' : fmtRelative(date + 'T00:00:00') + ` · ${date}`}
                </p>
                <div className="space-y-2">
                  {acts.map(act => (
                    <Link key={act.id} href={`/activities/${act.id}`}>
                      <div className="card flex items-center gap-3 hover:border-white/20 transition-colors"
                        style={{ padding: '12px' }}>
                        {/* Activity type icon */}
                        <span className="text-xl flex-shrink-0">{act.activity_type?.icon || '🔧'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{act.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                            {act.equipment?.name || 'No equipment'}
                            {act.work_order_ref ? ` · ${act.work_order_ref}` : ''}
                          </p>
                        </div>
                        {/* Status badge with colour */}
                        <span className="chip flex-shrink-0 text-[11px]"
                          style={{
                            background: act.status === 'completed' ? 'rgba(52,208,88,0.1)' :
                                        act.status === 'in_progress' ? 'rgba(240,165,0,0.1)' :
                                        act.status === 'planned' ? 'rgba(74,158,255,0.1)' :
                                        'var(--surface)',
                            color: act.status === 'completed' ? 'var(--green)' :
                                   act.status === 'in_progress' ? 'var(--amber)' :
                                   act.status === 'planned' ? 'var(--blue)' :
                                   'var(--text-2)',
                            border: '1px solid transparent',
                          }}>
                          {statusLabel(act.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </AppShell>
  );
}
