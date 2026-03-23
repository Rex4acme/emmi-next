'use client';
// app/dashboard/page.tsx

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

interface Toast {
  id: string; type: 'fault' | 'activity' | 'shift_log';
  name: string; title: string; severity?: string; href: string;
}
interface OnlineUser { userId: string; name: string; avatar?: string; }

// ── Toast popup ───────────────────────────────────────────────
function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const color = toast.type === 'fault'
    ? ({ critical: '#f85149', high: '#f0a500', medium: '#d29922', low: '#34d058' }[toast.severity || 'medium'] || '#f0a500')
    : toast.type === 'activity' ? '#4a9eff' : '#a371f7';
  const icon  = toast.type === 'fault' ? '⚡' : toast.type === 'activity' ? '🔧' : '📋';
  const label = toast.type === 'fault' ? 'New Fault' : toast.type === 'activity' ? 'New Activity' : 'Shift Log';
  return (
    <Link href={toast.href} onClick={() => onDismiss(toast.id)}>
      <div style={{ background: '#1a2030', border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', maxWidth: 320, width: '100%', animation: 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 2px' }}>{label}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast.name}</p>
          <p style={{ fontSize: 11, color: '#8b949e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast.title}</p>
          <p style={{ fontSize: 9, color: '#6e7681', marginTop: 4 }}>Tap to open →</p>
        </div>
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDismiss(toast.id); }} style={{ color: '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
          <X size={14}/>
        </button>
      </div>
    </Link>
  );
}

// ── Online presence widget ────────────────────────────────────
// Shows stacked avatar circles + a count. Works for 1 or 500 people.
// Tap to expand the full list in a small dropdown.
function OnlineWidget({
  users, currentUserId,
}: { users: OnlineUser[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const MAX_AVATARS = 4; // how many circles to show before "+N"
  const others = users.filter(u => u.userId !== currentUserId);
  const me     = users.find(u  => u.userId === currentUserId);
  const total  = users.length;

  // Close dropdown when tapping outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (total === 0) return null;

  // ── Only show COLLEAGUES in the pill, never yourself ──────
  // Your avatar is already in the header — showing it again here looks bad.
  const shown    = others.slice(0, MAX_AVATARS);
  const overflow = others.length - MAX_AVATARS;

  // When alone: just a quiet dot — no avatar duplication
  if (others.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d058', animation: 'pulse 2s ease-in-out infinite' }}/>
        <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Only you</span>
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          5,
          background:   'rgba(52,208,88,0.08)',
          border:       '1px solid rgba(52,208,88,0.22)',
          borderRadius: 999,
          padding:      '3px 8px 3px 5px',
          cursor:       'pointer',
          flexShrink:   0,
        }}
      >
        {/* Pulsing green dot */}
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d058', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }}/>

        {/* Stacked colleague avatars only — no self */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {shown.map((u, i) => (
            <div
              key={u.userId}
              title={u.name}
              style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '1.5px solid #34d058',
                background: 'var(--surface)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: i === 0 ? 0 : -6,
                zIndex: shown.length - i,
                position: 'relative', flexShrink: 0,
              }}
            >
              {u.avatar
                ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <span style={{ fontSize: 8, fontWeight: 700, color: '#34d058' }}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
              }
            </div>
          ))}

          {overflow > 0 && (
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: -6, zIndex: 0, position: 'relative', flexShrink: 0,
            }}>
              <span style={{ fontSize: 7, fontWeight: 800, color: 'var(--text-2)' }}>+{overflow}</span>
            </div>
          )}
        </div>

        {/* Count — colleagues only */}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#34d058', whiteSpace: 'nowrap' }}>
          {others.length} online
        </span>
      </button>

      {/* ── Dropdown list — tapping the pill opens this ── */}
      {open && (
        <div style={{
          position:   'absolute',
          top:        'calc(100% + 8px)',
          right:      0,
          zIndex:     200,
          background: 'var(--card)',
          border:     '1px solid var(--border)',
          borderRadius: 14,
          padding:    '10px 0',
          minWidth:   200,
          maxHeight:  320,
          overflowY:  'auto',
          boxShadow:  '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{ padding: '0 14px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d058', animation: 'pulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#34d058', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {total} online now
              </span>
            </div>
          </div>

          {/* List — you first, then others alphabetically */}
          {[...(me ? [me] : []), ...others].map(u => (
            <div key={u.userId} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px',
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${u.userId === currentUserId ? 'var(--amber)' : '#34d058'}`,
                background: 'var(--surface)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {u.avatar
                  ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <span style={{ fontSize: 11, fontWeight: 700, color: u.userId === currentUserId ? 'var(--amber)' : '#34d058' }}>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                }
              </div>
              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: u.userId === currentUserId ? 'var(--amber)' : 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.userId === currentUserId ? `${u.name} (You)` : u.name}
                </p>
              </div>
              {/* Green dot */}
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d058', flexShrink: 0 }}/>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();
  const chatEndRef       = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef('');
  const presenceRef      = useRef<any>(null);

  const [profile,     setProfile]     = useState<any>(null);
  const [faults,      setFaults]      = useState<any[]>([]);
  const [activities,  setActivities]  = useState<any[]>([]);
  const [equipment,   setEquipment]   = useState<any[]>([]);
  const [feedItems,   setFeedItems]   = useState<FeedItem[]>([]);
  const [myTasks,     setMyTasks]     = useState<Task[]>([]);
  const [toasts,      setToasts]      = useState<Toast[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const [chatHistory,  setChatHistory]  = useState<ChatMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user'|'ai'; text: string; time: string }[]>([]);
  const [question,     setQuestion]     = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);

  function dismissToast(id: string) { setToasts(p => p.filter(t => t.id !== id)); }

  function addToast(t: Toast) {
    setToasts(p => [...p.filter(x => x.id !== t.id), t].slice(-5));
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`EMMI — ${t.type === 'fault' ? '⚡' : t.type === 'activity' ? '🔧' : '📋'} ${t.type === 'fault' ? 'Fault' : t.type === 'activity' ? 'Activity' : 'Shift'}`, {
        body: `${t.name}: ${t.title}`, icon: '/icons/icon-192.png',
        badge: '/icons/favicon-32.png', tag: t.id, requireInteraction: true,
      });
      n.onclick = () => { window.focus(); router.push(t.href); };
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
      setProfile(p); setFaults((f||[]).slice(0,4));
      setActivities((a||[]).slice(0,3)); setEquipment(e||[]);

      const orgId = (p as any)?.org_id;
      if (orgId) {
        const [feed, tasks] = await Promise.all([
          getPlantFeed(supabase, 5),
          getMyTasks(supabase, user.id, orgId),
        ]);
        setFeedItems(feed||[]);
        setMyTasks((tasks||[]).filter((t:Task) => ['open','in_progress'].includes(t.status)).slice(0,3));
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    load();
  }, []);

  // ── Presence ──────────────────────────────────────────────
  useEffect(() => {
    async function setup() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('full_name,avatar_url,org_id').eq('id', user.id).single();
      if (!prof?.org_id) return;

      const ch = supabase.channel(`plant:${prof.org_id}`, { config: { presence: { key: user.id } } });
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ name: string; avatar?: string }>();
        setOnlineUsers(Object.entries(state).map(([uid, arr]) => ({
          userId: uid, name: (arr as any[])[0]?.name || 'Engineer', avatar: (arr as any[])[0]?.avatar,
        })));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(p => p.filter(u => u.userId !== key));
      })
      .subscribe(async s => {
        if (s === 'SUBSCRIBED') await ch.track({ name: prof.full_name || 'Engineer', avatar: prof.avatar_url || null });
      });
      presenceRef.current = ch;
    }
    setup();
    return () => { if (presenceRef.current) { presenceRef.current.untrack(); supabase.removeChannel(presenceRef.current); } };
  }, []);

  // ── Real-time feed notifications ──────────────────────────
  useEffect(() => {
    const ch = supabase.channel('dash-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faults' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).single();
        addToast({ id: `f-${row.id}`, type: 'fault', name: p?.full_name||'A colleague', title: row.title, severity: row.severity, href: '/feed' });
        setFeedItems((await getPlantFeed(supabase, 5)) || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).single();
        addToast({ id: `a-${row.id}`, type: 'activity', name: p?.full_name||'A colleague', title: row.title, href: '/feed' });
        setFeedItems((await getPlantFeed(supabase, 5)) || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_logs' }, async payload => {
        const row = payload.new as any;
        if (row.user_id === currentUserIdRef.current) return;
        addToast({ id: `s-${row.id}`, type: 'shift_log', name: row.logged_by_name||'A colleague', title: row.summary||`${row.shift_type} shift`, href: '/feed' });
        setFeedItems((await getPlantFeed(supabase, 5)) || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || aiLoading) return;
    const q = question.trim(); setQuestion(''); setAiLoading(true);
    const now = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    setChatMessages(p => [...p, { role: 'user', text: q, time: now }]);
    try {
      const r = await askQuestion(q, undefined, chatHistory);
      const text = r.ok
        ? [r.summary, r.key_points?.length ? '• '+r.key_points.join('\n• ') : '', r.safety_note ? '⚠ '+r.safety_note : '', r.next_step ? '→ '+r.next_step : ''].filter(Boolean).join('\n\n')
        : r.error || 'AI unavailable.';
      setChatMessages(p => [...p, { role: 'ai', text, time: now }]);
      setChatHistory(p => [...p, { role: 'user', content: q }, { role: 'assistant', content: text }]);
    } catch (err: any) { setChatMessages(p => [...p, { role: 'ai', text: 'Error: '+err.message, time: now }]); }
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
      {toasts.length > 0 && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:8, width:320, maxWidth:'calc(100vw - 32px)' }}>
          <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(110%) scale(0.92); } to { opacity:1; transform:translateX(0) scale(1); } }`}</style>
          {toasts.map(t => <ToastNotification key={t.id} toast={t} onDismiss={dismissToast}/>)}
        </div>
      )}

      <AppShell
        title="Dashboard"
        notificationCount={toasts.length}
        action={
          <Link href="/profile">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
              {profile?.avatar_url
                ? <Image src={profile.avatar_url} alt="Profile" width={36} height={36} className="object-cover w-full h-full"/>
                : <User size={16} style={{ color: 'var(--amber)' }}/>}
            </div>
          </Link>
        }
      >

        {/* ── Welcome section ────────────────────────────── */}
        <div className="mb-5">
          {/* Row 1: name on left, nothing on right — full width, no wrapping */}
          <h2 className="text-lg font-bold font-display" style={{ color: '#fff' }}>
            {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Welcome back'} ⚡
          </h2>

          {/* Row 2: org name + plant id on left, online pill on right — both on same line */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs truncate" style={{ color: 'var(--text-2)', flex: 1, minWidth: 0 }}>
              {profile?.organization || 'EMMI Engineering Logbook'}
              {(profile as any)?.org_id && (
                <span className="ml-1.5 font-mono font-semibold" style={{ color: 'var(--amber)' }}>
                  · {(profile as any).org_id}
                </span>
              )}
            </p>

            {/* Online pill — sits on the same line as org, never pushes name */}
            {(profile as any)?.org_id && (
              <OnlineWidget users={onlineUsers} currentUserId={currentUserIdRef.current}/>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {kpis.map(kpi => (
            <Link key={kpi.label} href={kpi.href}>
              <div className="card flex items-center gap-3 hover:border-white/20 transition-all" style={{ borderLeft: `3px solid ${kpi.color}` }}>
                <div className="p-2 rounded-lg" style={{ background: `${kpi.color}20`, color: kpi.color }}>{kpi.icon}</div>
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
            { href: '/feed',   icon: <Rss size={18}/>,        label: 'Plant Feed', color: 'var(--amber)' },
            { href: '/tasks',  icon: <CheckSquare size={18}/>, label: 'Tasks',      color: 'var(--blue)',  badge: myTasks.length },
            { href: '/health', icon: <Heart size={18}/>,       label: 'Health',     color: 'var(--green)' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="card flex flex-col items-center gap-1.5 py-3 text-center hover:border-white/20 transition-all relative">
                <div style={{ color: item.color }}>{item.icon}</div>
                <span className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>{item.label}</span>
                {!!item.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'var(--blue)', color: '#fff', fontSize: 9 }}>{item.badge}</span>
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
              {feedItems.slice(0,3).map(item => (
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
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
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
                    <CheckSquare size={14} style={{ color: task.priority === 'critical' ? 'var(--red)' : task.priority === 'high' ? 'var(--amber)' : 'var(--blue)', flexShrink: 0 }}/>
                    <p className="text-xs font-semibold flex-1 truncate">{task.title}</p>
                    <span className="text-xs flex-shrink-0 capitalize" style={{ color: task.status === 'in_progress' ? 'var(--amber)' : 'var(--text-3)' }}>
                      {task.status.replace('_',' ')}
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
              <button onClick={clearChat} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                <Trash2 size={11}/> Clear
              </button>
            )}
          </div>
          {chatMessages.length > 0 && (
            <div className="mb-3 space-y-3 max-h-80 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs px-3 py-2 text-xs leading-relaxed" style={{
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
            <p className="text-xs mb-3 text-center py-2" style={{ color: 'var(--text-3)' }}>Ask any electrical engineering question.</p>
          )}
          <form onSubmit={handleAsk} className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask EMMI anything…" className="flex-1 form-input" style={{ fontSize: 13 }}/>
            <button type="submit" disabled={aiLoading || !question.trim()} className="p-2.5 rounded-xl flex-shrink-0"
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
