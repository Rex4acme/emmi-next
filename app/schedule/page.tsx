'use client';
// app/schedule/page.tsx — Maintenance Schedule Calendar
// Monthly calendar view of all planned and in-progress activities.
// Color-coded by status. Tap a day to see that day's activities.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import { fmtDate } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Plus,
  Calendar, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  planned:     'var(--blue)',
  in_progress: 'var(--amber)',
  completed:   'var(--green)',
  cancelled:   'var(--text-3)',
};
const STATUS_BG: Record<string, string> = {
  planned:     'rgba(74,158,255,0.15)',
  in_progress: 'rgba(240,165,0,0.15)',
  completed:   'rgba(52,208,88,0.15)',
  cancelled:   'rgba(110,118,129,0.15)',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SchedulePage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const today = new Date();
  const [year,       setYear]       = useState(today.getFullYear());
  const [month,      setMonth]      = useState(today.getMonth()); // 0-indexed
  const [activities, setActivities] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<string | null>(
    today.toISOString().slice(0, 10)
  );
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

      await fetchActivities(user.id, profile?.org_id, year, month);
    }
    load();
  }, []);

  useEffect(() => {
    if (userId) fetchActivities(userId, orgId, year, month);
  }, [year, month]);

  async function fetchActivities(uid: string, oid: string | null, y: number, m: number) {
    setLoading(true);
    const start = new Date(y, m, 1).toISOString();
    const end   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();

    let query = supabase
      .from('activities')
      .select('id, title, status, scheduled_date, activity_type:activity_types(name, icon, color), equipment:equipment(tag_id)')
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date');

    // Show org activities if in a plant
    if (oid) {
      const { data: members } = await supabase.from('profiles').select('id').eq('org_id', oid);
      const ids = (members || []).map((m: any) => m.id);
      if (ids.length) query = query.in('user_id', ids);
    } else {
      query = query.eq('user_id', uid);
    }

    const { data } = await query;
    setActivities(data || []);
    setLoading(false);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Group activities by date
  const byDate: Record<string, any[]> = {};
  activities.forEach(a => {
    const d = a.scheduled_date?.slice(0, 10);
    if (d) { if (!byDate[d]) byDate[d] = []; byDate[d].push(a); }
  });

  // Selected day activities
  const selectedActivities = selected ? (byDate[selected] || []) : [];

  // Stats for month
  const total     = activities.length;
  const completed = activities.filter(a => a.status === 'completed').length;
  const overdue   = activities.filter(a => {
    const d = a.scheduled_date?.slice(0, 10);
    return d && d < today.toISOString().slice(0, 10) && a.status !== 'completed' && a.status !== 'cancelled';
  }).length;

  return (
    <AppShell title="Maintenance Schedule"
      action={
        <Link href="/activities/new">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--amber)', color: '#000' }}>
            <Plus size={14}/> Schedule
          </button>
        </Link>
      }>
      <div className="max-w-2xl">

        {/* Month stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--blue)' }}>{total}</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Scheduled</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--green)' }}>{completed}</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Completed</p>
          </div>
          <div className="card text-center py-3" style={{ border: overdue > 0 ? '1px solid rgba(248,81,73,0.3)' : '' }}>
            <p className="text-2xl font-bold font-mono" style={{ color: overdue > 0 ? 'var(--red)' : 'var(--text-3)' }}>{overdue}</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Overdue</p>
          </div>
        </div>

        {/* Calendar header */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <ChevronLeft size={16}/>
            </button>
            <h2 className="text-base font-bold" style={{ color: '#fff' }}>
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <ChevronRight size={16}/>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold py-1"
                style={{ color: 'var(--text-3)' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`}/>;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayActs = byDate[dateStr] || [];
              const isToday = dateStr === today.toISOString().slice(0, 10);
              const isSel   = dateStr === selected;

              return (
                <button key={dateStr} onClick={() => setSelected(isSel ? null : dateStr)}
                  className="relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg transition-all"
                  style={{
                    minHeight: 44,
                    background: isSel ? 'rgba(240,165,0,0.15)' : 'transparent',
                    border: isSel ? '1px solid rgba(240,165,0,0.3)' : '1px solid transparent',
                  }}>
                  <span className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                    style={{
                      background: isToday ? 'var(--amber)' : 'transparent',
                      color: isToday ? '#000' : isSel ? 'var(--amber)' : 'var(--text)',
                      fontWeight: isToday ? 800 : 600,
                    }}>
                    {day}
                  </span>

                  {/* Activity dots */}
                  {dayActs.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center" style={{ maxWidth: 28 }}>
                      {dayActs.slice(0, 3).map((a, ai) => (
                        <div key={ai} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: STATUS_COLOR[a.status] || 'var(--text-3)' }}/>
                      ))}
                      {dayActs.length > 3 && (
                        <span style={{ fontSize: 7, color: 'var(--text-3)', lineHeight: '6px' }}>+</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
            {Object.entries(STATUS_COLOR).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }}/>
                <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected day detail */}
        {selected && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: '#fff' }}>
                {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {selectedActivities.length} activit{selectedActivities.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {selectedActivities.length === 0 ? (
              <div className="card text-center py-8">
                <Calendar size={24} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }}/>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>No activities scheduled</p>
                <Link href={`/activities/new?date=${selected}`} className="block mt-3">
                  <button className="text-xs px-3 py-2 rounded-lg font-bold"
                    style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                    + Schedule Activity
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedActivities.map(act => (
                  <Link key={act.id} href={`/activities/${act.id}`}>
                    <div className="card hover:border-white/20 transition-all"
                      style={{ borderLeft: `3px solid ${STATUS_COLOR[act.status] || 'var(--border)'}` }}>
                      <div className="flex items-center gap-3">
                        <span className="text-base flex-shrink-0">{act.activity_type?.icon || '🔧'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{act.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {act.equipment && <span className="tag-chip text-xs">{act.equipment.tag_id}</span>}
                            {act.activity_type && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{act.activity_type.name}</span>}
                          </div>
                        </div>
                        <span className="text-xs font-medium capitalize flex-shrink-0"
                          style={{ color: STATUS_COLOR[act.status] || 'var(--text-3)' }}>
                          {act.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}