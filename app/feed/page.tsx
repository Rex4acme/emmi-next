'use client';
// app/feed/page.tsx — Plant Activity Feed
// Shows ALL engineers' faults, activities and shift logs in real time.
// Engineers in the same org_id see each other's entries here.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, getPlantFeed } from '@/lib/db';
import { fmtRelative, severityDot } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  AlertTriangle, ClipboardList, Moon, RefreshCw,
  User, Zap, ChevronRight, Users, Sun, Sunset,
} from 'lucide-react';
import type { FeedItem } from '@/types';

// ── Severity colours ──────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high:     'var(--amber)',
  medium:   '#d29922',
  low:      'var(--green)',
};

// ── Status colours ────────────────────────────────────────────
const FAULT_STATUS_COLOR: Record<string, string> = {
  open:                'var(--red)',
  under_investigation: 'var(--amber)',
  resolved:            'var(--green)',
  recurring:           '#a371f7',
};

const ACT_STATUS_COLOR: Record<string, string> = {
  planned:     'var(--blue)',
  in_progress: 'var(--amber)',
  completed:   'var(--green)',
  cancelled:   'var(--text-3)',
};

const SHIFT_ICON: Record<string, React.ReactNode> = {
  day:       <Sun size={14}/>,
  afternoon: <Sunset size={14}/>,
  night:     <Moon size={14}/>,
};

// ── Avatar component ──────────────────────────────────────────
function Avatar({ profile, size = 32 }: { profile?: any; size?: number }) {
  if (profile?.avatar_url) {
    return (
      <Image
        src={profile.avatar_url}
        alt={profile.full_name || 'Engineer'}
        width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, border: '1.5px solid var(--border)' }}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      <User size={size * 0.45} style={{ color: 'var(--amber)' }}/>
    </div>
  );
}

// ── Feed item card ────────────────────────────────────────────
function FeedCard({ item, currentUserId }: { item: FeedItem; currentUserId: string }) {
  const isOwn = item.user_id === currentUserId;
  const name  = item.profile?.full_name || 'Engineer';
  const title = item.profile?.title || '';

  if (item.type === 'fault' && item.fault) {
    const f = item.fault;
    return (
      <Link href={`/faults/${f.id}`}>
        <div className="card hover:border-white/20 transition-all"
          style={{ borderLeft: `3px solid ${SEV_COLOR[f.severity] || 'var(--border)'}` }}>
          {/* Header row: avatar + name + time */}
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {isOwn ? 'You' : name}
              </span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
              {fmtRelative(item.created_at)}
            </span>
          </div>

          {/* Fault badge */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="chip text-xs"
              style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)', fontSize: 9, padding: '1px 6px' }}>
              ⚡ FAULT
            </span>
            <span className="chip text-xs"
              style={{
                background: `${SEV_COLOR[f.severity]}18`,
                color:      SEV_COLOR[f.severity],
                border:     `1px solid ${SEV_COLOR[f.severity]}40`,
                fontSize: 9, padding: '1px 6px', textTransform: 'uppercase'
              }}>
              {f.severity}
            </span>
          </div>

          {/* Fault title */}
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {f.title}
          </p>

          {/* Equipment tag + status */}
          <div className="flex items-center gap-2 flex-wrap">
            {f.equipment && (
              <span className="tag-chip text-xs">{f.equipment.tag_id}</span>
            )}
            {f.fault_category && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {f.fault_category.icon} {f.fault_category.name}
              </span>
            )}
            <span className="ml-auto text-xs font-medium"
              style={{ color: FAULT_STATUS_COLOR[f.status] || 'var(--text-3)' }}>
              {f.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'activity' && item.activity) {
    const a = item.activity;
    const statusColor = ACT_STATUS_COLOR[a.status] || 'var(--text-3)';
    return (
      <Link href={`/activities/${a.id}`}>
        <div className="card hover:border-white/20 transition-all"
          style={{ borderLeft: `3px solid ${statusColor}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar profile={item.profile} size={28}/>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {isOwn ? 'You' : name}
              </span>
              {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
              {fmtRelative(item.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="chip text-xs"
              style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)', fontSize: 9, padding: '1px 6px' }}>
              🔧 ACTIVITY
            </span>
          </div>

          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {a.activity_type?.icon || '🔧'} {a.title}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {a.equipment && (
              <span className="tag-chip text-xs">{a.equipment.tag_id}</span>
            )}
            {a.activity_type && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {a.activity_type.name}
              </span>
            )}
            <span className="ml-auto text-xs font-medium" style={{ color: statusColor }}>
              {a.status.replace('_', ' ')}
            </span>
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
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {isOwn ? 'You' : (s.logged_by_name || name)}
            </span>
            {title && <span className="text-xs ml-1.5" style={{ color: 'var(--text-3)' }}>{title}</span>}
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {fmtRelative(item.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <span className="chip"
            style={{ background: 'rgba(163,113,247,0.1)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.2)', fontSize: 9, padding: '1px 6px' }}>
            {SHIFT_ICON[s.shift_type]} SHIFT LOG
          </span>
          <span className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>
            {s.shift_type} shift · {new Date(s.shift_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {s.summary && (
          <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {s.summary}
          </p>
        )}

        {s.handover_notes && (
          <div className="rounded-lg p-2.5 mt-1"
            style={{ background: 'rgba(163,113,247,0.08)', border: '1px solid rgba(163,113,247,0.15)' }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--purple)' }}>
              Handover Note →
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {s.handover_notes}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Main page ─────────────────────────────────────────────────
export default function FeedPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [feed,          setFeed]          = useState<FeedItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [orgId,         setOrgId]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState<'all' | 'faults' | 'activities' | 'shifts'>('all');

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }

    setCurrentUserId(user.id);

    const profile = await getProfile(supabase, user.id) as any;
    setOrgId(profile?.org_id || null);

    const items = await getPlantFeed(supabase, 40);
    setFeed(items);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  // ── Real-time subscription ────────────────────────────────
  // Auto-refresh feed when a colleague posts
  useEffect(() => {
    const channel = supabase
      .channel('plant-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faults' },     () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_logs' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = filter === 'all'        ? feed
                 : filter === 'faults'     ? feed.filter(i => i.type === 'fault')
                 : filter === 'activities' ? feed.filter(i => i.type === 'activity')
                 : feed.filter(i => i.type === 'shift_log');

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
      {/* Org status banner */}
      {!orgId ? (
        <div className="card mb-4 flex items-start gap-3"
          style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <Users size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}/>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--amber)' }}>
              Set your Plant ID to see colleagues
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--text-2)' }}>
              You're currently only seeing your own entries. Add your Plant ID in your profile and share it with colleagues.
            </p>
            <Link href="/profile">
              <button className="text-xs px-3 py-1.5 rounded-lg font-bold"
                style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                Set Plant ID in Profile →
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="card mb-4 flex items-center gap-2 py-2.5"
          style={{ background: 'rgba(52,208,88,0.05)', border: '1px solid rgba(52,208,88,0.15)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)', flexShrink: 0 }}/>
          <p className="text-xs" style={{ color: 'var(--green)' }}>
            Live — Plant <span className="font-bold font-mono">{orgId}</span>
          </p>
          <Link href="/shift-log/new" className="ml-auto">
            <button className="text-xs px-2.5 py-1 rounded-lg font-bold"
              style={{ background: 'rgba(163,113,247,0.15)', color: 'var(--purple)', border: '1px solid rgba(163,113,247,0.25)' }}>
              + Shift Log
            </button>
          </Link>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'faults', 'activities', 'shifts'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
            style={{
              background: filter === f ? 'var(--amber)' : 'var(--card)',
              color:      filter === f ? '#000'         : 'var(--text-2)',
              border:     filter === f ? 'none'         : '1px solid var(--border)',
            }}>
            {f === 'all' ? 'All' : f === 'faults' ? '⚡ Faults' : f === 'activities' ? '🔧 Activities' : '📋 Shifts'}
          </button>
        ))}
      </div>

      {/* Feed */}
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
            No entries yet
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {!orgId
              ? 'Set your Plant ID to see colleagues\' entries'
              : 'Log a fault or activity to get started'}
          </p>
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
