'use client';
// app/dashboard/page.tsx — Main Dashboard
// KPIs, AI assistant with memory + clear, recent faults/activities, profile photo in header

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getFaults, getActivities, getEquipment } from '@/lib/db';
import { askQuestion, type ChatMessage } from '@/lib/ai';
import { fmtRelative, severityDot, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Send, Loader2, Trash2, AlertTriangle,
  ClipboardList, Cpu, TrendingUp, User, Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data state
  const [profile,    setProfile]    = useState<any>(null);
  const [faults,     setFaults]     = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [equipment,  setEquipment]  = useState<any[]>([]);

  // AI chat state — full conversation history for memory
  const [chatHistory,  setChatHistory]  = useState<ChatMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user'|'ai'; text: string; time: string }[]>([]);
  const [question,     setQuestion]     = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const [p, f, a, e] = await Promise.all([
        getProfile(supabase, user.id),
        getFaults(supabase, user.id, {}),
        getActivities(supabase, user.id, {}),
        getEquipment(supabase, user.id),
      ]);

      setProfile(p);
      setFaults(f.slice(0, 5));
      setActivities(a.slice(0, 5));
      setEquipment(e);
    }
    load();
  }, []);

  // Scroll to latest chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Send question with full conversation memory ───────────
  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || aiLoading) return;

    const userQ = question.trim();
    setQuestion('');
    setAiLoading(true);

    // Add user message to display
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { role: 'user', text: userQ, time: now }]);

    try {
      // Pass full history for memory — AI remembers previous questions
      const result = await askQuestion(userQ, undefined, chatHistory);

      const aiText = result.ok
        ? [
            result.summary,
            result.key_points?.length ? '• ' + result.key_points.join('\n• ') : '',
            result.safety_note ? '⚠ ' + result.safety_note : '',
            result.next_step ? '→ ' + result.next_step : '',
          ].filter(Boolean).join('\n\n')
        : result.error || 'AI unavailable. Please try again.';

      // Update display
      setChatMessages(prev => [...prev, { role: 'ai', text: aiText, time: now }]);

      // Update conversation history for memory on next request
      setChatHistory(prev => [
        ...prev,
        { role: 'user',      content: userQ  },
        { role: 'assistant', content: aiText },
      ]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + err.message, time: now }]);
    }
    setAiLoading(false);
  }

  // ── Clear chat ────────────────────────────────────────────
  function clearChat() {
    setChatMessages([]);
    setChatHistory([]);
  }

  // KPI calculations
  const openFaults     = faults.filter(f => f.status === 'open').length;
  const criticalFaults = faults.filter(f => f.severity === 'critical').length;
  const faultyEquip    = equipment.filter(e => e.status === 'faulty').length;
  const pendingActs    = activities.filter(a => a.status === 'planned').length;

  const kpis = [
    { label: 'Open Faults',     value: openFaults,     icon: <AlertTriangle size={16}/>, color: 'var(--red)',   href: '/faults' },
    { label: 'Critical',        value: criticalFaults, icon: <Zap size={16}/>,           color: '#ff4444',      href: '/faults' },
    { label: 'Faulty Equipment',value: faultyEquip,    icon: <Cpu size={16}/>,           color: 'var(--amber)', href: '/equipment' },
    { label: 'Pending Tasks',   value: pendingActs,    icon: <ClipboardList size={16}/>, color: 'var(--blue)',  href: '/activities' },
  ];

  return (
    <AppShell
      title="Dashboard"
      action={
        // Profile photo in top right of header
        <Link href="/profile">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="Profile" width={36} height={36} className="object-cover w-full h-full"/>
            ) : (
              <User size={16} style={{ color: 'var(--amber)' }}/>
            )}
          </div>
        </Link>
      }
    >
      {/* Welcome */}
      <div className="mb-5">
        <h2 className="text-lg font-bold font-display">
          {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Welcome back'} ⚡
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
          {profile?.organization || 'EMMI Engineering Logbook'}
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

      {/* ── AI Assistant ──────────────────────────────────────── */}
      <div className="card mb-5" style={{ border: '1px solid rgba(163,113,247,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(163,113,247,0.15)' }}>
              <Zap size={14} style={{ color: 'var(--purple)' }}/>
            </div>
            <span className="text-sm font-bold">EMMI AI Assistant</span>
            <span className="chip text-xs" style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.2)', fontSize: 9 }}>
              Pollinations AI
            </span>
          </div>
          {/* Clear chat button */}
          {chatMessages.length > 0 && (
            <button onClick={clearChat}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
              style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              <Trash2 size={11}/> Clear
            </button>
          )}
        </div>

        {/* Chat messages */}
        {chatMessages.length > 0 && (
          <div className="mb-3 space-y-3 max-h-80 overflow-y-auto pr-1">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-xs rounded-2xl px-3 py-2 text-xs leading-relaxed"
                  style={{
                    background:   msg.role === 'user' ? 'rgba(240,165,0,0.15)' : 'var(--surface)',
                    border:       msg.role === 'user' ? '1px solid rgba(240,165,0,0.3)' : '1px solid var(--border)',
                    color:        'var(--text)',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    whiteSpace:   'pre-wrap',
                  }}>
                  {msg.text}
                  <div className="mt-1 text-right" style={{ color: 'var(--text-3)', fontSize: 9 }}>{msg.time}</div>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="loading-dots"><span/><span/><span/></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
        )}

        {/* No messages yet */}
        {chatMessages.length === 0 && !aiLoading && (
          <p className="text-xs mb-3 text-center py-2" style={{ color: 'var(--text-3)' }}>
            Ask any electrical engineering question — I remember our conversation.
          </p>
        )}

        {/* Input */}
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask EMMI anything…"
            className="flex-1 form-input"
            style={{ fontSize: 13 }}
          />
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
            <Link href="/faults/new"><button className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'var(--red)', color: '#fff' }}>Log First Fault</button></Link>
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
            <Link href="/activities/new"><button className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'var(--blue)', color: '#fff' }}>Log First Activity</button></Link>
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
  );
}
