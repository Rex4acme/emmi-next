'use client';
// app/dashboard/page.tsx — Dashboard
// Shows: KPI cards, AI Q&A assistant, recent faults, recent activities
// Also runs the 7am fault reminder check on load.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getStats, getFaults, getActivities } from '@/lib/db';
import { askQuestion } from '@/lib/ai';
import { fmtRelative, statusBg, statusLabel, severityDot, fmtDuration } from '@/lib/utils';
import { useFaultReminder } from '@/hooks/useFaultReminder';
import AppShell from '@/components/layout/AppShell';
import {
  Cpu, AlertTriangle, ClipboardList, TrendingDown,
  Send, Loader2, AlertCircle, ChevronRight, Plus, Bell, X
} from 'lucide-react';
import type { Stats, Fault, Activity } from '@/types';

export default function DashboardPage() {
  const supabase = createBrowserClient();

  const [userId,     setUserId]     = useState<string | null>(null);
  const [userName,   setUserName]   = useState('');
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [faults,     setFaults]     = useState<Fault[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);

  // AI assistant state
  const [question,   setQuestion]   = useState('');
  const [aiResult,   setAiResult]   = useState<any>(null);
  const [aiLoading,  setAiLoading]  = useState(false);

  // 7am fault reminder — shows banner if there are unresolved overnight faults
  const reminder = useFaultReminder(userId);

  // ── Load data on mount ────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Load user name from metadata or profile
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single();
      setUserName(profile?.full_name || user.user_metadata?.full_name || 'Engineer');

      // Load stats, recent faults, recent activities in parallel
      const [s, f, a] = await Promise.all([
        getStats(supabase, user.id),
        getFaults(supabase, user.id),
        getActivities(supabase, user.id),
      ]);
      setStats(s);
      setFaults(f.slice(0, 5));      // Show 5 most recent faults
      setActivities(a.slice(0, 5));  // Show 5 most recent activities
      setLoading(false);
    }
    load();
  }, []);

  // ── Ask AI ────────────────────────────────────────────────
  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResult(null);
    const result = await askQuestion(question);
    setAiResult(result);
    setAiLoading(false);
  }

  // ── Greeting based on time of day ────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      action={
        <Link href="/faults/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--red)', color: '#fff' }}>
            <Plus size={13}/>Log Fault
          </button>
        </Link>
      }
    >

      {/* ── 7am Fault Reminder Banner ─────────────────────── */}
      {reminder.visible && (
        <div className="mb-4 p-4 rounded-xl"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Bell size={18} style={{ color: 'var(--red)' }} className="mt-0.5 flex-shrink-0"/>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--red)' }}>
                  ⚠ {reminder.faults.length} Unresolved Fault{reminder.faults.length > 1 ? 's' : ''} from Yesterday
                </p>
                <div className="space-y-1">
                  {reminder.faults.map(f => (
                    <Link key={f.id} href={`/faults/${f.id}`}
                      className="block text-xs hover:underline"
                      style={{ color: 'var(--text-2)' }}>
                      {severityDot(f.severity)} {f.title}
                    </Link>
                  ))}
                </div>
                <Link href="/faults"
                  className="inline-block mt-2 text-xs font-semibold"
                  style={{ color: 'var(--red)' }}>
                  View all faults →
                </Link>
              </div>
            </div>
            <button onClick={reminder.dismiss} style={{ color: 'var(--text-3)' }}>
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* ── Greeting ──────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="text-xl font-bold font-display">{greeting}, {userName.split(' ')[0]}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Equipment */}
          <Link href="/equipment" className="card hover:border-amber-500/30 transition-colors"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <Cpu size={16} style={{ color: 'var(--blue)' }}/>
              <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                {stats.equipment.faulty > 0 ? `${stats.equipment.faulty} faulty` : 'all clear'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono">{stats.equipment.total}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Equipment</div>
            <div className="text-xs mt-1" style={{ color: 'var(--green)' }}>
              {stats.equipment.operational} operational
            </div>
          </Link>

          {/* Faults */}
          <Link href="/faults" className="card hover:border-red-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle size={16} style={{ color: 'var(--red)' }}/>
              {stats.faults.critical > 0 && (
                <span className="chip" style={{
                  background: 'rgba(248,81,73,0.15)', color: 'var(--red)',
                  borderColor: 'rgba(248,81,73,0.3)'
                }}>
                  {stats.faults.critical} critical
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-mono">{stats.faults.open}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Open Faults</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {stats.faults.total} total logged
            </div>
          </Link>

          {/* Activities */}
          <Link href="/activities" className="card hover:border-blue-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <ClipboardList size={16} style={{ color: 'var(--blue)' }}/>
            </div>
            <div className="text-2xl font-bold font-mono">{stats.activities.in_progress}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>In Progress</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {stats.activities.planned} planned
            </div>
          </Link>

          {/* Downtime */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown size={16} style={{ color: 'var(--amber)' }}/>
            </div>
            <div className="text-2xl font-bold font-mono">{fmtDuration(stats.faults.total_downtime)}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Total Downtime</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {stats.faults.resolutions} resolutions
            </div>
          </div>
        </div>
      )}

      {/* ── AI Assistant ──────────────────────────────────── */}
      <div className="card mb-6" style={{ border: '1px solid rgba(163,113,247,0.25)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-bold" style={{ color: 'var(--purple)' }}>EMMI AI Assistant</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)' }}>
            Claude Sonnet
          </span>
        </div>

        {/* Question input */}
        <form onSubmit={handleAsk} className="flex gap-2 mb-3">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask an electrical engineering question…"
            className="form-input flex-1"
            disabled={aiLoading}
          />
          <button
            type="submit"
            disabled={!question.trim() || aiLoading}
            className="px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-semibold"
            style={{ background: 'var(--purple)', color: '#fff', opacity: !question.trim() ? 0.5 : 1 }}
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
          </button>
        </form>

        {/* AI result */}
        {aiLoading && (
          <div className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}>
            <div className="loading-dots"><span/><span/><span/></div>
          </div>
        )}
        {aiResult && !aiLoading && (
          <div className="p-3 rounded-lg space-y-3" style={{ background: 'var(--surface)' }}>
            {aiResult.ok ? (
              <>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{aiResult.summary}</p>
                {aiResult.key_points?.length > 0 && (
                  <ul className="space-y-1">
                    {aiResult.key_points.map((pt: string, i: number) => (
                      <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--purple)' }}>›</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
                {aiResult.safety_note && (
                  <div className="flex gap-2 p-2 rounded" style={{ background: 'rgba(248,81,73,0.1)' }}>
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--red)' }}/>
                    <p className="text-xs" style={{ color: 'var(--red)' }}>{aiResult.safety_note}</p>
                  </div>
                )}
                {aiResult.next_step && (
                  <p className="text-xs font-semibold" style={{ color: 'var(--amber)' }}>
                    → {aiResult.next_step}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--red)' }}>⚠ {aiResult.error}</p>
            )}
          </div>
        )}

        {/* Suggestion chips */}
        {!aiResult && !aiLoading && (
          <div className="flex flex-wrap gap-2">
            {[
              'What causes transformer overheating?',
              'How to test insulation resistance?',
              'Explain earth fault relay settings',
            ].map(q => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Faults ──────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Recent Faults</h3>
          <Link href="/faults" className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--amber)' }}>
            View all <ChevronRight size={13}/>
          </Link>
        </div>

        {faults.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>No faults logged yet</p>
            <Link href="/faults/new">
              <button className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--red)', color: '#fff' }}>
                Log First Fault
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {faults.map(fault => (
              <Link key={fault.id} href={`/faults/${fault.id}`}>
                <div className="card flex items-center gap-3 hover:border-white/20 transition-colors"
                  style={{ padding: '12px' }}>
                  {/* Severity colour bar */}
                  <div className={`sev-bar sev-bar-${fault.severity}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: 'var(--amber)' }}>
                        {fault.fault_code || 'FLT'}
                      </span>
                      <span className="chip text-xs" style={{
                        // Dynamic status colour via statusBg helper
                      }}>
                        {severityDot(fault.severity)} {fault.severity}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-0.5 truncate">{fault.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {fault.equipment?.name || 'No equipment'} · {fmtRelative(fault.detected_at)}
                    </p>
                  </div>
                  <span className="chip flex-shrink-0 text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {statusLabel(fault.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Activities ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Recent Activities</h3>
          <Link href="/activities" className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--amber)' }}>
            View all <ChevronRight size={13}/>
          </Link>
        </div>

        {activities.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>No activities logged yet</p>
            <Link href="/activities/new">
              <button className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--blue)', color: '#fff' }}>
                Log First Activity
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map(act => (
              <Link key={act.id} href={`/activities/${act.id}`}>
                <div className="card flex items-center gap-3 hover:border-white/20 transition-colors"
                  style={{ padding: '12px' }}>
                  <span className="text-lg flex-shrink-0">
                    {act.activity_type?.icon || '🔧'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{act.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {act.equipment?.name || 'No equipment'} · {fmtRelative(act.scheduled_date)}
                    </p>
                  </div>
                  <span className="chip flex-shrink-0 text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {statusLabel(act.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </AppShell>
  );
}
