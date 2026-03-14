'use client';
// app/dashboard/page.tsx
// Real-time toasts from colleagues stay until the user clicks/dismisses them.
// No auto-dismiss timeout.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getFaults, getActivities, getEquipment, getPlantFeed, getMyTasks } from '@/lib/db';
import { askQuestion, type ChatMessage } from '@/lib/ai';
import { fmtRelative, severityDot, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Send, Loader2, Trash2, AlertTriangle,
  ClipboardList, Cpu, User, Zap,
  Rss, CheckSquare, Heart, Users, X,
} from 'lucide-react';
import type { FeedItem, Task } from '@/types';

// ── Toast ─────────────────────────────────────────────────────
interface Toast {
  id:        string;
  type:      'fault' | 'activity' | 'shift_log';
  name:      string;
  title:     string;
  severity?: string;
  href:      string; // where to go when clicked
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast:     Toast;
  onDismiss: (id: string) => void;
}) {
  const borderColor =
    toast.type === 'fault'
      ? ({ critical: '#f85149', high: '#f0a500', medium: '#d29922', low: '#34d058' }[toast.severity || 'medium'] || '#f0a500')
      : toast.type === 'activity' ? '#4a9eff'
      : '#a371f7';

  const icon =
    toast.type === 'fault'    ? '⚡' :
    toast.type === 'activity' ? '🔧' : '📋';

  const typeLabel =
    toast.type === 'fault'    ? 'New Fault' :
    toast.type === 'activity' ? 'New Activity' : 'Shift Log';

  return (
    <Link href={toast.href} onClick={() => onDismiss(toast.id)}>
      <div style={{
        background:   '#1a2030',
        border:       `1px solid ${borderColor}40`,
        borderLeft:   `3px solid ${borderColor}`,
        borderRadius: 12,
        padding:      '12px 14px',
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        boxShadow:    `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${borderColor}15`,
        cursor:       'pointer',
        maxWidth:     320,
        width:        '100%',
        animation:    'toastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${borderColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: borderColor, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 2px' }}>
            {typeLabel}
          </p>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {toast.name}
          </p>
          <p style={{ fontSize: 11, color: '#8b949e', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {toast.title}
          </p>
          <p style={{ fontSize: 9, color: '#6e7681', marginTop: 4 }}>
            Tap to open →
          </p>
        </div>

        {/* Dismiss X — stops propagation so click on X doesn't navigate */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDismiss(toast.id); }}
          style={{ color: '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1 }}
        >
          <X size={14}/>
        </button>
      </div>
    </Link>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();
  const chatEndRef        = useRef<HTMLDivElement>(null);
  const currentUserIdRef  = useRef('');

  const [profile,    setProfile]    = useState<any>(null);
  const [faults,     setFaults]     = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [equipment,  setEquipment]  = useState<any[]>([]);
  const [feedItems,  setFeedItems]  = useState<FeedItem[]>([]);
  const [myTasks,    setMyTasks]    = useState<Task[]>([]);

  // Toasts — NO auto-dismiss. Persist until user clicks or taps X.
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [chatHistory,  setChatHistory]  = useState<ChatMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string; time: string }[]>([]);
  const [question,     setQuestion]     = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function addToast(toast: Toast) {
    // Add to stack — max 5 visible at once (oldest drop off bottom)
    setToasts(prev => {
      const without = prev.filter(t => t.id !== toast.id);
      return [...without, toast].slice(-5);
    });

    // Phone notification (if permission granted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`EMMI — ${toast.type === 'fault' ? '⚡ Fault' : toast.type === 'activity' ? '🔧 Activity' : '📋 Shift'}`, {
        body:   `${toast.name}: ${toast.title}`,
        icon:   '/icons/icon-192.png',
        badge:  '/icons/favicon-32.png',
        tag:    toast.id,
        requireInteraction: true, // phone notification also stays until tapped
      });
      // Clicking phone notification navigates to feed
      n.onclick = () => { window.focus(); router.push(toast.href); };
    }
  }

  // ── Load data ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      currentUserIdRef.current = user.id;

      const [p, f, a, e] = await Promise.all([
        getProfile(supabase, user.id),
        getFaults(supabase, user.id, {}),
        getActivities(supabase, user.id, {}),
        getEquipment(supabase, user.id),
      ]);

      setProfile(p);
      setFaults((f || []).slice(0, 4));
      setActivities((a || []).slice(0, 3));
      setEquipment(e || []);

      const orgId = (p as any)?.org_id;
      if (orgId) {
        const [feed, tasks] = await Promise.all([
          getPlantFeed(supabase, 5),
          getMyTasks(supabase, user.id, orgId),
        ]);
        setFeedItems(feed || []);
        setMyTasks((tasks || []).filter((t: Task) => ['open', 'in_progress'].includes(t.status)).slice(0, 3));
      }

      // Request notification permission once
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    load();
  }, []);

  // ── Real-time colleague notifications ─────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-feed-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faults' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).single();
        addToast({ id: `fault-${row.id}`, type: 'fault', name: p?.full_name || 'A colleague', title: row.title, severity: row.severity, href: '/feed' });
        const feed = await getPlantFeed(supabase, 5);
        setFeedItems(feed || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).single();
        addToast({ id: `act-${row.id}`, type: 'activity', name: p?.full_name || 'A colleague', title: row.title, href: '/feed' });
        const feed = await getPlantFeed(supabase, 5);
        setFeedItems(feed || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_logs' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        addToast({ id: `shift-${row.id}`, type: 'shift_log', name: row.logged_by_name || 'A colleague', title: row.summary || `${row.shift_type} shift log`, href: '/feed' });
        const feed = await getPlantFeed(supabase, 5);
        setFeedItems(feed || []);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || aiLoading) return;
    const q = question.trim();
    setQuestion('');
    setAiLoading(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { role: 'user', text: q, time: now }]);
    try {
      const result = await askQuestion(q, undefined, chatHistory);
      const text = result.ok
        ? [result.summary, result.key_points?.length ? '• ' + result.key_points.join('\n• ') : '', result.safety_note ? '⚠ ' + result.safety_note : '', result.next_step ? '→ ' + result.next_step : ''].filter(Boolean).join('\n\n')
        : result.error || 'AI unavailable.';
      setChatMessages(prev => [...prev, { role: 'ai', text, time: now }]);
      setChatHistory(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: text }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + err.message, time: now }]);
    }
    setAiLoading(false);
  }

  function clearChat() { setChatMessages([]); setChatHistory([]); }

  const openFaults     = faults.filter(f => f.status === 'open').length;
  const criticalFaults = faults.filter(f => f.severity === 'critical').length;
  const faultyEquip    = equipment.filter(e => e.status === 'faulty').length;
  const pendingActs    = activities.filter(a => a.status === 'planned').length;

  const kpis = [
    { label: 'Open Faults',      value: openFaults,     icon: <AlertTriangle size={16}/>, color: 'var(--red)',   href: '/faults'     },
    { label: 'Critical',         value: criticalFaults, icon: <Zap size={16}/>,           color: '#ff4444',      href: '/faults'     },
    { label: 'Faulty Equipment', value: faultyEquip,    icon: <Cpu size={16}/>,           color: 'var(--amber)', href: '/equipment'  },
    { label: 'Pending Tasks',    value: pendingActs,    icon: <ClipboardList size={16}/>, color: 'var(--blue)',  href: '/activities' },
  ];

  return (
    <>
      {/* Toast stack — fixed top-right, persist until dismissed */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 8,
          width: 320, maxWidth: 'calc(100vw - 32px)',
        }}>
          <style>{`
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateX(110%) scale(0.92); }
              to   { opacity: 1; transform: translateX(0)   scale(1);    }
            }
          `}</style>
          {toasts.map(t => (
            <ToastNotification key={t.id} toast={t} onDismiss={dismissToast}/>
          ))}
        </div>
      )}

      <AppShell
        title="Dashboard"
        notificationCount={toasts.length}
        action={
          <Link href="/profile">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
              {profile?.avatar_url
                ? <Image src={profile.avatar_url} alt="Profile" width={36} height={36} className="object-cover w-full h-full"/>
                : <User size={16} style={{ color: 'var(--amber)' }}/>
              }
            </div>
          </Link>
        }
      >
        {/* Welcome */}
        <div className="mb-5">
          <h2 className="text-lg font-bold font-display" style={{ color: '#ffffff' }}>
            {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Welcome back'} ⚡
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
            {profile?.organization || 'EMMI Engineering Logbook'}
            {(profile as any)?.org_id && (
              <span className="ml-2 font-mono" style={{ color: 'var(--amber)' }}>
                · Plant {(profile as any).org_id}
              </span>
            )}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {kpis.map(kpi => (
            <Link key={kpi.label} href={kpi.href}>
              <div className="card flex items-center gap-3 hover:border-white/20 transition-all"
                style={{ borderLeft: `3px solid ${kpi.color}` }}>
                <div className="p-2 rounded-lg" style={{ background: `${kpi.color}20`, color: kpi.color }}>
                  {kpi.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-2)' }}>{kpi.label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { href: '/feed',   icon: <Rss size={18}/>,         label: 'Plant Feed', color: 'var(--amber)' },
            { href: '/tasks',  icon: <CheckSquare size={18}/>,  label: 'Tasks',      color: 'var(--blue)',  badge: myTasks.length },
            { href: '/health', icon: <Heart size={18}/>,        label: 'Health',     color: 'var(--green)' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="card flex flex-col items-center gap-1.5 py-3 text-center hover:border-white/20 transition-all relative">
                <div style={{ color: item.color }}>{item.icon}</div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>{item.label}</span>
                {!!item.badge && (
                  <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'var(--blue)', color: '#fff', fontSize: 9 }}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Plant feed preview */}
        {feedItems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Plant Feed</h3>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
              </div>
              <Link href="/feed" className="text-xs" style={{ color: 'var(--amber)' }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {feedItems.slice(0, 3).map(item => (
                <Link key={`${item.type}-${item.id}`} href="/feed">
                  <div className="card hover:border-white/20 transition-all" style={{ padding: '10px 12px' }}>
                    <div className="flex items-center gap-2">
                      <Users size={12} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
                      <p className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text)' }}>
                        {item.profile?.full_name || 'Engineer'}
                        <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
                          {' '}{item.type === 'fault' ? 'logged a fault' : item.type === 'activity' ? 'logged an activity' : 'submitted shift log'}
                        </span>
                      </p>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                        {fmtRelative(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-3)', paddingLeft: 20 }}>
                      {item.fault?.title || item.activity?.title || item.shift_log?.summary || '—'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Tasks */}
        {myTasks.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">My Tasks</h3>
              <Link href="/tasks" className="text-xs" style={{ color: 'var(--amber)' }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {myTasks.map(task => (
                <Link key={task.id} href="/tasks">
                  <div className="card flex items-center gap-3 hover:border-white/20 transition-all" style={{ padding: '10px 12px' }}>
                    <CheckSquare size={14} style={{
                      color: task.priority === 'critical' ? 'var(--red)' : task.priority === 'high' ? 'var(--amber)' : 'var(--blue)',
                      flexShrink: 0,
                    }}/>
                    <p className="text-xs font-semibold flex-1 truncate">{task.title}</p>
                    <span className="text-xs flex-shrink-0 capitalize"
                      style={{ color: task.status === 'in_progress' ? 'var(--amber)' : 'var(--text-3)' }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AI Assistant */}
        <div className="card mb-5" style={{ border: '1px solid rgba(163,113,247,0.2)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(163,113,247,0.15)' }}>
                <Zap size={14} style={{ color: 'var(--purple)' }}/>
              </div>
              <span className="text-sm font-bold">EMMI AI Assistant</span>
            </div>
            {chatMessages.length > 0 && (
              <button onClick={clearChat} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                <Trash2 size={11}/> Clear
              </button>
            )}
          </div>
          {chatMessages.length > 0 && (
            <div className="mb-3 space-y-3 max-h-80 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs px-3 py-2 text-xs leading-relaxed"
                    style={{
                      background:   msg.role === 'user' ? 'rgba(240,165,0,0.15)' : 'var(--surface)',
                      border:       msg.role === 'user' ? '1px solid rgba(240,165,0,0.3)' : '1px solid var(--border)',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      color: 'var(--text)', whiteSpace: 'pre-wrap',
                    }}>
                    {msg.text}
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>{msg.time}</div>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--purple)' }}/>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
          )}
          {chatMessages.length === 0 && (
            <p className="text-xs mb-3 text-center py-2" style={{ color: 'var(--text-3)' }}>
              Ask any electrical engineering question.
            </p>
          )}
          <form onSubmit={handleAsk} className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="Ask EMMI anything…" className="flex-1 form-input" style={{ fontSize: 13 }}/>
            <button type="submit" disabled={aiLoading || !question.trim()}
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(163,113,247,0.2)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.3)' }}>
              {aiLoading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            </button>
          </form>
        </div>

        {/* Recent Faults */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Recent Faults</h3>
            <Link href="/faults" className="text-xs" style={{ color: 'var(--amber)' }}>View all →</Link>
          </div>
          {faults.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>No faults logged yet</p>
              <Link href="/faults/new"><button className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: 'var(--red)', color: '#fff' }}>Log First Fault</button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {faults.map(f => (
                <Link key={f.id} href={`/faults/${f.id}`}>
                  <div className="card flex items-center gap-3 hover:border-white/20 transition-all" style={{ padding: '10px 12px' }}>
                    <span>{severityDot(f.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{f.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{fmtRelative(f.detected_at)}</p>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{statusLabel(f.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Recent Activities</h3>
            <Link href="/activities" className="text-xs" style={{ color: 'var(--amber)' }}>View all →</Link>
          </div>
          {activities.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>No activities logged yet</p>
              <Link href="/activities/new"><button className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: 'var(--blue)', color: '#fff' }}>Log Activity</button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map(a => (
                <Link key={a.id} href={`/activities/${a.id}`}>
                  <div className="card flex items-center gap-3 hover:border-white/20 transition-all" style={{ padding: '10px 12px' }}>
                    <span className="text-base">{a.activity_type?.icon || '🔧'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{a.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{fmtRelative(a.scheduled_date)}</p>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{statusLabel(a.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </AppShell>
    </>
  );
}
