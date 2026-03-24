'use client';
// app/permit/page.tsx — Permit to Work List

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import { fmtDatetime, fmtRelative } from '@/lib/utils';
import {
  Plus, ShieldCheck, ShieldAlert, Shield,
  Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronRight, User,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_approval: { label: 'Pending Approval', color: 'var(--amber)',  icon: Clock },
  approved:         { label: 'Approved',          color: 'var(--green)',  icon: CheckCircle },
  active:           { label: 'Active / In Progress', color: 'var(--blue)', icon: ShieldCheck },
  completed:        { label: 'Completed',          color: 'var(--text-3)', icon: CheckCircle },
  rejected:         { label: 'Rejected',           color: 'var(--red)',   icon: XCircle },
  cancelled:        { label: 'Cancelled',          color: 'var(--text-3)', icon: XCircle },
};

export default function PermitListPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [permits,       setPermits]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [userId,        setUserId]        = useState('');
  const [userRole,      setUserRole]      = useState('engineer');
  const [orgId,         setOrgId]         = useState('');
  const [filter,        setFilter]        = useState('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles').select('org_id, role').eq('id', user.id).single();
      setOrgId(profile?.org_id || '');
      setUserRole(profile?.role || 'engineer');

      await fetchPermits(user.id, profile?.org_id);
    }
    load();
  }, []);

  async function fetchPermits(uid: string, oid?: string) {
    setLoading(true);
    let query = supabase
      .from('permits')
      .select(`
        id, status, work_type, work_description, location,
        start_datetime, end_datetime, requested_by_name,
        workers, hazards, precautions,
        equipment:equipment(tag_id, name),
        requester:profiles!permits_user_id_fkey(full_name, avatar_url),
        approver:profiles!permits_approver_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (oid) {
      query = query.eq('org_id', oid);
    } else {
      query = query.eq('user_id', uid);
    }

    const { data } = await query;
    setPermits(data || []);
    setLoading(false);
  }

  async function approvePermit(id: string) {
    await supabase.from('permits').update({
      status: 'approved',
      approved_by_name: permits.find(p => p.id === id)?.approver?.full_name,
      approved_at: new Date().toISOString(),
    }).eq('id', id);
    setPermits(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
  }

  async function rejectPermit(id: string) {
    await supabase.from('permits').update({ status: 'rejected' }).eq('id', id);
    setPermits(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
  }

  async function startWork(id: string) {
    await supabase.from('permits').update({ status: 'active' }).eq('id', id);
    setPermits(prev => prev.map(p => p.id === id ? { ...p, status: 'active' } : p));
  }

  async function closePermit(id: string) {
    await supabase.from('permits').update({
      status: 'completed', closed_at: new Date().toISOString(),
    }).eq('id', id);
    setPermits(prev => prev.map(p => p.id === id ? { ...p, status: 'completed' } : p));
  }

  const isAdmin = ['admin', 'senior_engineer'].includes(userRole);

  const filtered = filter === 'all' ? permits
    : filter === 'mine'    ? permits.filter(p => p.requester?.full_name === permits.find(x=>x.id===p.id)?.requested_by_name)
    : filter === 'pending' ? permits.filter(p => p.status === 'pending_approval')
    : permits.filter(p => p.status === filter);

  const pendingCount = permits.filter(p => p.status === 'pending_approval').length;

  const TABS = [
    { key: 'all',      label: 'All' },
    { key: 'pending_approval', label: '⏳ Pending' },
    { key: 'active',   label: '🟢 Active' },
    { key: 'approved', label: '✅ Approved' },
    { key: 'completed',label: '✓ Completed' },
  ];

  return (
    <AppShell title="Permits to Work"
      action={
        <Link href="/permit/new">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--amber)', color: '#000' }}>
            <Plus size={14}/> New PTW
          </button>
        </Link>
      }>
      <div className="max-w-2xl">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total',   value: permits.length,                                   color: 'var(--blue)'  },
            { label: 'Pending', value: pendingCount,                                      color: 'var(--amber)' },
            { label: 'Active',  value: permits.filter(p => p.status === 'active').length, color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: active ? 'var(--amber)' : 'var(--card)',
                  color:      active ? '#000'         : 'var(--text-2)',
                  border:     active ? 'none'         : '1px solid var(--border)',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 100 }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Shield size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }}/>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>No permits found</p>
            <Link href="/permit/new">
              <button className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: 'var(--amber)', color: '#000' }}>
                Issue First PTW
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(permit => {
              const cfg = STATUS_CONFIG[permit.status] || STATUS_CONFIG.pending_approval;
              const StatusIcon = cfg.icon;
              const isOwnPermit = permit.user_id === userId;
              const canApprove  = isAdmin && permit.status === 'pending_approval';
              const canStart    = (isOwnPermit || isAdmin) && permit.status === 'approved';
              const canClose    = (isOwnPermit || isAdmin) && permit.status === 'active';

              return (
                <div key={permit.id} className="card"
                  style={{ borderLeft: `3px solid ${cfg.color}` }}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.label}
                        </span>
                        <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                          {permit.work_type}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                        {permit.work_description}
                      </p>
                    </div>
                    <StatusIcon size={16} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}/>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    {permit.equipment && (
                      <span className="tag-chip text-xs">{permit.equipment.tag_id}</span>
                    )}
                    {permit.location && (
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>📍 {permit.location}</span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      👤 {permit.requested_by_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      🕐 {permit.start_datetime ? new Date(permit.start_datetime).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </span>
                  </div>

                  {/* Hazards */}
                  {permit.hazards?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {permit.hazards.slice(0, 4).map((h: string) => (
                        <span key={h} className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(248,81,73,0.08)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.15)', fontSize: 9 }}>
                          ⚠ {h}
                        </span>
                      ))}
                      {permit.hazards.length > 4 && (
                        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>+{permit.hazards.length - 4} more</span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {(canApprove || canStart || canClose) && (
                    <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      {canApprove && (
                        <>
                          <button onClick={() => approvePermit(permit.id)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold"
                            style={{ background: 'rgba(52,208,88,0.15)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.3)' }}>
                            ✓ Approve
                          </button>
                          <button onClick={() => rejectPermit(permit.id)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold"
                            style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                            ✗ Reject
                          </button>
                        </>
                      )}
                      {canStart && (
                        <button onClick={() => startWork(permit.id)}
                          className="flex-1 py-2 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.3)' }}>
                          ▶ Start Work
                        </button>
                      )}
                      {canClose && (
                        <button onClick={() => closePermit(permit.id)}
                          className="flex-1 py-2 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(52,208,88,0.15)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.3)' }}>
                          ✓ Close Permit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}