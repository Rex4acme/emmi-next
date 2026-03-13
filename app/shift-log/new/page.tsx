'use client';
// app/shift-log/new/page.tsx — Create Shift Handover Log
// Engineers log what happened during their shift.
// The next shift can see it instantly in the Plant Feed.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, createShiftLog } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import { Plus, Trash2, ClipboardCheck, Sun, Sunset, Moon } from 'lucide-react';
import type { ShiftEvent, ShiftType } from '@/types';

const SHIFT_OPTIONS: { value: ShiftType; label: string; icon: React.ReactNode }[] = [
  { value: 'day',       label: 'Day Shift',       icon: <Sun size={16}/>    },
  { value: 'afternoon', label: 'Afternoon Shift',  icon: <Sunset size={16}/> },
  { value: 'night',     label: 'Night Shift',      icon: <Moon size={16}/>   },
];

export default function NewShiftLogPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [profile, setProfile] = useState<any>(null);
  const [saving,  setSaving]  = useState(false);

  // Form state
  const [shiftType,      setShiftType]      = useState<ShiftType>('day');
  const [shiftDate,      setShiftDate]      = useState(new Date().toISOString().split('T')[0]);
  const [summary,        setSummary]        = useState('');
  const [handoverNotes,  setHandoverNotes]  = useState('');
  const [openIssues,     setOpenIssues]     = useState<string[]>(['']);
  const [events,         setEvents]         = useState<ShiftEvent[]>([
    { time: '', description: '', equipment_tag: '' }
  ]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      const p = await getProfile(supabase, user.id);
      setProfile(p);
      if (!p?.org_id) {
        alert('You need to set a Plant ID in your profile before logging a shift.');
        router.push('/profile');
      }
    }
    load();
  }, []);

  // ── Event row handlers ────────────────────────────────────
  function addEvent() {
    setEvents(prev => [...prev, { time: '', description: '', equipment_tag: '' }]);
  }

  function removeEvent(i: number) {
    setEvents(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateEvent(i: number, field: keyof ShiftEvent, value: string) {
    setEvents(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  // ── Open issue handlers ───────────────────────────────────
  function addIssue() { setOpenIssues(prev => [...prev, '']); }
  function removeIssue(i: number) { setOpenIssues(prev => prev.filter((_, idx) => idx !== i)); }
  function updateIssue(i: number, value: string) {
    setOpenIssues(prev => prev.map((v, idx) => idx === i ? value : v));
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.org_id) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const cleanEvents = events.filter(ev => ev.description.trim());
      const cleanIssues = openIssues.filter(i => i.trim());

      await createShiftLog(supabase, user.id, {
        org_id:         profile.org_id,
        shift_type:     shiftType,
        shift_date:     shiftDate,
        summary:        summary.trim() || undefined,
        events:         cleanEvents.length > 0 ? cleanEvents : undefined,
        open_issues:    cleanIssues.length > 0 ? cleanIssues : undefined,
        handover_notes: handoverNotes.trim() || undefined,
        logged_by_name: profile.full_name || 'Engineer',
      });

      router.push('/feed');
    } catch (err: any) {
      alert('Error saving shift log: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <AppShell title="New Shift Log">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Shift type selector */}
        <div>
          <label className="form-label req">Shift Type</label>
          <div className="flex gap-2 mt-1">
            {SHIFT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setShiftType(opt.value)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: shiftType === opt.value ? 'rgba(240,165,0,0.15)' : 'var(--card)',
                  color:      shiftType === opt.value ? 'var(--amber)'          : 'var(--text-2)',
                  border:     shiftType === opt.value ? '1.5px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                }}>
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="form-label req">Shift Date</label>
          <input type="date" className="form-input" value={shiftDate}
            onChange={e => setShiftDate(e.target.value)} required/>
        </div>

        {/* Summary */}
        <div>
          <label className="form-label">Shift Summary</label>
          <textarea className="form-input" rows={3}
            placeholder="Brief overview of the shift — plant status, key events, overall situation…"
            value={summary} onChange={e => setSummary(e.target.value)}/>
        </div>

        {/* Events log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label" style={{ marginBottom: 0 }}>Events During Shift</label>
            <button type="button" onClick={addEvent}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ color: 'var(--amber)', background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
              <Plus size={12}/> Add
            </button>
          </div>
          <div className="space-y-2">
            {events.map((ev, i) => (
              <div key={i} className="card" style={{ padding: '10px 12px' }}>
                <div className="flex gap-2 mb-2">
                  <input type="time" className="form-input" style={{ width: 110, flexShrink: 0 }}
                    value={ev.time} onChange={e => updateEvent(i, 'time', e.target.value)}
                    placeholder="Time"/>
                  <input className="form-input" style={{ width: 100, flexShrink: 0 }}
                    placeholder="Tag e.g. M-017"
                    value={ev.equipment_tag || ''} onChange={e => updateEvent(i, 'equipment_tag', e.target.value)}/>
                  {events.length > 1 && (
                    <button type="button" onClick={() => removeEvent(i)}
                      className="flex-shrink-0 p-1.5 rounded-lg"
                      style={{ color: 'var(--red)', background: 'rgba(248,81,73,0.08)' }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
                <input className="form-input"
                  placeholder="What happened? e.g. Motor M17 tripped — overload, reset at 14:35"
                  value={ev.description} onChange={e => updateEvent(i, 'description', e.target.value)}/>
              </div>
            ))}
          </div>
        </div>

        {/* Open issues */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label" style={{ marginBottom: 0 }}>Open Issues (Unresolved)</label>
            <button type="button" onClick={addIssue}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ color: 'var(--red)', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)' }}>
              <Plus size={12}/> Add
            </button>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
            Issues not yet resolved — the next shift must follow up
          </p>
          <div className="space-y-2">
            {openIssues.map((issue, i) => (
              <div key={i} className="flex gap-2">
                <input className="form-input flex-1"
                  placeholder={`Issue ${i + 1} — e.g. Conveyor CV21 belt tension still loose`}
                  value={issue} onChange={e => updateIssue(i, e.target.value)}/>
                {openIssues.length > 1 && (
                  <button type="button" onClick={() => removeIssue(i)}
                    className="flex-shrink-0 p-1.5 rounded-lg"
                    style={{ color: 'var(--red)', background: 'rgba(248,81,73,0.08)' }}>
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Handover note */}
        <div>
          <label className="form-label">Handover Note to Next Shift</label>
          <textarea className="form-input" rows={3}
            placeholder="Direct message to the next engineer — what they must know, what to watch out for…"
            value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)}/>
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
          style={{ background: 'var(--amber)', color: '#000' }}>
          {saving ? (
            <span className="loading-dots"><span/><span/><span/></span>
          ) : (
            <><ClipboardCheck size={18}/> Submit Shift Log</>
          )}
        </button>
      </form>
    </AppShell>
  );
}
