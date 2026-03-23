'use client';
// app/feed/page.tsx — Plant Feed
// getPlantFeed is now fixed inside lib/db.ts directly.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getPlantFeed } from '@/lib/db';
import { fmtRelative } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  AlertTriangle, ClipboardList, Moon, RefreshCw,
  User, Zap, Users, Sun, Sunset, Send, Loader2,
  MessageSquare, X,
} from 'lucide-react';
import type { FeedItem } from '@/types';

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', medium: '#d29922', low: 'var(--green)',
};
const FAULT_STATUS_COLOR: Record<string, string> = {
  open: 'var(--red)', under_investigation: 'var(--amber)',
  resolved: 'var(--green)', recurring: '#a371f7',
};
const ACT_STATUS_COLOR: Record<string, string> = {
  planned: 'var(--blue)', in_progress: 'var(--amber)',
  completed: 'var(--green)', cancelled: 'var(--text-3)',
};
const SHIFT_ICON: Record<string, React.ReactNode> = {
  day: <Sun size={13}/>, afternoon: <Sunset size={13}/>, night: <Moon size={13}/>,
};

function Avatar({ profile, size = 32 }: { profile?: any; size?: number }) {
  if (profile?.avatar_url) {
    return (
      <Image src={profile.avatar_url} alt={profile.full_name || 'Engineer'}
        width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, border: '1.5px solid var(--border)' }}/>
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <User size={size * 0.45} style={{ color: 'var(--amber)' }}/>
    </div>
  );
}

function FeedCard({ item, currentUserId }: { item: FeedItem; currentUserId: string }) {
  const isOwn = item.user_id === currentUserId;
  const name  = item.profile?.full_name || 'Engineer';
  const ptitle = item.profile?.title || '';

  if (item.type === 'fault' && item.fault) {
    const f = item.fault;
    const sev = SEV_COLOR[f.severity] || 'var(--border)';
    return (
      <Link href={`/faults/${f.id}`}>
        <div className="card hover:border-white/20 transition-all" style={{ borderLeft: `3px solid ${sev}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{isOwn ? 'You' : name}</span>
              {ptitle && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{ptitle}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)', fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>⚡ FAULT</span>
            <span style={{ background: `${sev}18`, color: sev, border: `1px solid ${sev}40`, fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>{f.severity}</span>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{f.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {f.equipment && <span className="tag-chip text-xs">{f.equipment.tag_id}</span>}
            {f.fault_category && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{f.fault_category.icon} {f.fault_category.name}</span>}
            <span className="ml-auto text-xs font-medium capitalize" style={{ color: FAULT_STATUS_COLOR[f.status] || 'var(--text-3)' }}>{f.status.replace('_',' ')}</span>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'activity' && item.activity) {
    const a = item.activity;
    const sc = ACT_STATUS_COLOR[a.status] || 'var(--text-3)';
    return (
      <Link href={`/activities/${a.id}`}>
        <div className="card hover:border-white/20 transition-all" style={{ borderLeft: `3px solid ${sc}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{isOwn ? 'You' : name}</span>
              {ptitle && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{ptitle}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)', fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>🔧 ACTIVITY</span>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{a.activity_type?.icon || '🔧'} {a.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {a.equipment && <span className="tag-chip text-xs">{a.equipment.tag_id}</span>}
            {a.activity_type && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{a.activity_type.name}</span>}
            <span className="ml-auto text-xs font-medium capitalize" style={{ color: sc }}>{a.status.replace('_',' ')}</span>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'shift_log' && item.shift_log) {
    const s = item.shift_log;
    return (
      <div className="card" style={{ borderLeft: '3px solid var(--purple)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Avatar profile={item.profile} size={28}/>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{isOwn ? 'You' : (s.logged_by_name || name)}</span>
            {ptitle && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{ptitle}</span>}
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{fmtRelative(item.created_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.2)', fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {SHIFT_ICON[s.shift_type]} SHIFT LOG
          </span>
          <span className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>
            {s.shift_type} · {new Date(s.shift_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        {s.summary && <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.summary}</p>}
        {s.open_issues?.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-bold mb-1" style={{ color: 'var(--amber)' }}>Open Issues</p>
            {s.open_issues.map((issue: string, i: number) => (
              <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>• {issue}</p>
            ))}
          </div>
        )}
        {s.handover_notes && (
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(163,113,247,0.08)', border: '1px solid rgba(163,113,247,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--purple)' }}>Handover Note →</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.handover_notes}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────
export default function FeedPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [feed,          setFeed]          = useState<FeedItem[]>([]);
  const [myProfile,     setMyProfile]     = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [orgId,         setOrgId]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState<'all'|'faults'|'activities'|'shifts'>('all');

  // Quick post state
  const [postText,     setPostText]     = useState('');
  const [posting,      setPosting]      = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  async function load(showSpin = false) {
    if (showSpin) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    setCurrentUserId(user.id);

    const profile = await getProfile(supabase, user.id) as any;
    setMyProfile(profile);
    setOrgId(profile?.org_id || null);

    const items = await getPlantFeed(supabase, 40);
    setFeed(items);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  // Real-time — reloads feed on any new insert
  useEffect(() => {
    const ch = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faults' },     () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Quick post — saves a shift_log entry with just a summary message
  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postText.trim() || !orgId) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }

    await supabase.from('shift_logs').insert({
      user_id:        user.id,
      org_id:         orgId,
      shift_type:     'day',
      shift_date:     new Date().toISOString().slice(0, 10),
      summary:        postText.trim(),
      logged_by_name: myProfile?.full_name || 'Engineer',
    });

    setPostText('');
    setShowComposer(false);
    setPosting(false);
    await load();
  }

  // Filter tabs — count per type for badges
  const counts = {
    all:        feed.length,
    faults:     feed.filter(i => i.type === 'fault').length,
    activities: feed.filter(i => i.type === 'activity').length,
    shifts:     feed.filter(i => i.type === 'shift_log').length,
  };

  const filtered =
    filter === 'faults'     ? feed.filter(i => i.type === 'fault') :
    filter === 'activities' ? feed.filter(i => i.type === 'activity') :
    filter === 'shifts'     ? feed.filter(i => i.type === 'shift_log') :
    feed;

  const TABS: { key: typeof filter; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'faults',     label: '⚡ Faults' },
    { key: 'activities', label: '🔧 Activities' },
    { key: 'shifts',     label: '📋 Shifts' },
  ];

  return (
    <AppShell
      title="Plant Feed"
      action={
        <button onClick={() => load(true)} disabled={refreshing}
          className="p-2 rounded-lg"
          style={{ color: 'var(--text-2)', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
        </button>
      }
    >
      {/* Live / No org banner */}
      {!orgId ? (
        <div className="card mb-4 flex items-start gap-3"
          style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <Users size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}/>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--amber)' }}>Set your Plant ID to see colleagues</p>
            <p className="text-xs mb-2" style={{ color: 'var(--text-2)' }}>
              Add your Plant ID in your profile to share faults, activities and shift logs with your team.
            </p>
            <Link href="/profile">
              <button className="text-xs px-3 py-1.5 rounded-lg font-bold"
                style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                Set Plant ID →
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="card mb-4 flex items-center gap-2 py-2.5"
          style={{ background: 'rgba(52,208,88,0.05)', border: '1px solid rgba(52,208,88,0.15)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--green)' }}/>
          <p className="text-xs" style={{ color: 'var(--green)' }}>
            Live — Plant <span className="font-bold font-mono">{orgId}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowComposer(v => !v)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold"
              style={{ background: 'rgba(74,158,255,0.12)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.25)' }}>
              <MessageSquare size={11}/> Post Update
            </button>
            <Link href="/shift-log/new">
              <button className="text-xs px-2.5 py-1 rounded-lg font-bold"
                style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.25)' }}>
                + Shift Log
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick post composer */}
      {showComposer && orgId && (
        <div className="card mb-4" style={{ border: '1px solid rgba(74,158,255,0.25)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{ color: 'var(--blue)' }}>Post update to plant</p>
            <button onClick={() => { setShowComposer(false); setPostText(''); }}
              style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={14}/>
            </button>
          </div>
          <form onSubmit={handlePost} className="flex flex-col gap-2">
            <textarea
              value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder="Post update, parts request, safety alert…"
              rows={3}
              className="form-input"
              style={{ resize: 'none', fontSize: 13 }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Visible to all plant engineers</p>
              <button type="submit" disabled={posting || !postText.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: posting ? 'rgba(74,158,255,0.3)' : 'var(--blue)', color: '#fff' }}>
                {posting ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs — show counts so engineer knows what's there */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const count = counts[tab.key];
          const active = filter === tab.key;
          return (
            <button key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
              style={{
                background: active ? 'var(--amber)' : 'var(--card)',
                color:      active ? '#000'         : 'var(--text-2)',
                border:     active ? 'none'         : '1px solid var(--border)',
              }}>
              {tab.label}
              {/* Show count badge on each tab */}
              {count > 0 && (
                <span style={{
                  background: active ? 'rgba(0,0,0,0.2)' : 'var(--surface)',
                  color:      active ? '#000'             : 'var(--text-3)',
                  borderRadius: 999, padding: '0 5px', fontSize: 9, fontWeight: 800,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feed list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: 100, background: 'var(--card)' }}/>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Zap size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-2)' }}>
            {filter === 'all' ? 'No entries yet' : `No ${filter} yet`}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
            {!orgId
              ? 'Set your Plant ID in Profile to see entries'
              : filter === 'all'
                ? 'Log a fault or activity, or post an update above'
                : `No ${filter} have been logged yet`}
          </p>
          {orgId && filter === 'all' && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Link href="/faults/new">
                <button className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(248,81,73,0.15)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                  ⚡ Log Fault
                </button>
              </Link>
              <Link href="/activities/new">
                <button className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(74,158,255,0.12)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)' }}>
                  🔧 Log Activity
                </button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <FeedCard key={`${item.type}-${item.id}`} item={item} currentUserId={currentUserId}/>
          ))}
        </div>
      )}
    </AppShell>
  );
}