'use client';
// app/activities/[id]/page.tsx — Activity Detail Page
// Shows full activity info with start/complete action buttons,
// findings/actions taken fields, photo gallery.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getActivityById, updateActivity, deleteActivity } from '@/lib/db';
import { fmtDatetime, fmtDuration, fmtRelative, statusLabel } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Edit, Trash2, Loader2, ArrowLeft, Play, CheckCircle,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import type { Activity } from '@/types';

export default function ActivityDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [activity,   setActivity]   = useState<Activity | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [updating,   setUpdating]   = useState(false);

  // Inline edit fields for findings/actions (filled in when completing)
  const [findings,     setFindings]     = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    async function load() {
      const a = await getActivityById(supabase, id);
      setActivity(a);
      if (a) {
        setFindings(a.findings || '');
        setActionsTaken(a.actions_taken || '');
      }
      setLoading(false);
    }
    load();
  }, [id]);

  // ── Start activity ────────────────────────────────────────
  async function handleStart() {
    if (!activity) return;
    setUpdating(true);
    const updated = await updateActivity(supabase, activity.id, {
      status:     'in_progress',
      start_time: new Date().toISOString(), // record when work started
    });
    setActivity(updated);
    setUpdating(false);
  }

  // ── Complete activity ─────────────────────────────────────
  async function handleComplete() {
    if (!activity) return;
    setUpdating(true);

    const endTime = new Date().toISOString();
    // Calculate duration if start_time is recorded
    const durationMinutes = activity.start_time
      ? Math.round((new Date(endTime).getTime() - new Date(activity.start_time).getTime()) / 60000)
      : undefined;

    const updated = await updateActivity(supabase, activity.id, {
      status:           'completed',
      end_time:         endTime,
      duration_minutes: durationMinutes,
      findings:         findings || undefined,
      actions_taken:    actionsTaken || undefined,
    });
    setActivity(updated);
    setShowComplete(false);
    setUpdating(false);
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (!activity || !confirm('Delete this activity?')) return;
    setDeleting(true);
    await deleteActivity(supabase, activity.id);
    router.push('/activities');
  }

  if (loading) {
    return (
      <AppShell title="Activity">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  if (!activity) {
    return (
      <AppShell title="Not Found">
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-2)' }}>Activity not found</p>
          <Link href="/activities"><button className="mt-3 text-sm" style={{ color: 'var(--amber)' }}>← Back</button></Link>
        </div>
      </AppShell>
    );
  }

  const statusColor = {
    planned:     'var(--blue)',
    in_progress: 'var(--amber)',
    completed:   'var(--green)',
    cancelled:   'var(--text-3)',
  }[activity.status];

  return (
    <AppShell
      title="Activity Detail"
      action={
        <div className="flex items-center gap-2">
          <Link href={`/activities/${activity.id}/edit`}>
            <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              <Edit size={15}/>
            </button>
          </Link>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}>
            {deleting ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
          </button>
        </div>
      }
    >
      <Link href="/activities" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> All Activities
      </Link>

      {/* ── Activity header ───────────────────────────────── */}
      <div className="card mb-4" style={{ borderLeft: `3px solid ${statusColor}` }}>
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl flex-shrink-0">{activity.activity_type?.icon || '🔧'}</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold leading-snug">{activity.title}</h2>
            {activity.activity_type && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{activity.activity_type.name}</p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="chip text-xs font-bold"
            style={{
              background: `${statusColor}20`,
              color:      statusColor,
              border:     `1px solid ${statusColor}40`,
            }}>
            {statusLabel(activity.status)}
          </span>
          {activity.duration_minutes && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
              <Clock size={12}/> {fmtDuration(activity.duration_minutes)}
            </span>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Equipment',    value: activity.equipment ? `${activity.equipment.tag_id} — ${activity.equipment.name}` : '—' },
            { label: 'Scheduled',    value: fmtDatetime(activity.scheduled_date) },
            { label: 'Started',      value: activity.start_time ? fmtDatetime(activity.start_time) : '—' },
            { label: 'Completed',    value: activity.end_time   ? fmtDatetime(activity.end_time)   : '—' },
            { label: 'Work Order',   value: activity.work_order_ref || '—' },
            { label: 'Permit (PTW)', value: activity.permit_ref     || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ color: 'var(--text-3)' }}>{label}</p>
              <p className="font-medium mt-0.5" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────── */}
      {activity.status === 'planned' && (
        <button onClick={handleStart} disabled={updating}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-4"
          style={{ background: 'var(--amber)', color: '#000' }}>
          {updating ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
          Start Activity Now
        </button>
      )}

      {activity.status === 'in_progress' && (
        <div className="mb-4">
          {!showComplete ? (
            <button onClick={() => setShowComplete(true)}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'var(--green)', color: '#fff' }}>
              <CheckCircle size={16}/>
              Mark as Completed
            </button>
          ) : (
            <div className="card" style={{ border: '1px solid rgba(52,208,88,0.3)' }}>
              <p className="text-sm font-bold mb-3" style={{ color: 'var(--green)' }}>Complete Activity</p>
              <div className="space-y-3">
                <div>
                  <label className="form-label">Findings / Observations</label>
                  <textarea value={findings} onChange={e => setFindings(e.target.value)}
                    placeholder="What was found during the activity?"
                    className="form-input" rows={3}/>
                </div>
                <div>
                  <label className="form-label">Actions Taken</label>
                  <textarea value={actionsTaken} onChange={e => setActionsTaken(e.target.value)}
                    placeholder="What work was performed? Parts replaced? Settings adjusted?"
                    className="form-input" rows={3}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleComplete} disabled={updating}
                    className="flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: 'var(--green)', color: '#fff' }}>
                    {updating ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                    Confirm Complete
                  </button>
                  <button onClick={() => setShowComplete(false)}
                    className="px-4 py-2.5 rounded-lg text-sm"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {activity.description && (
        <div className="card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Scope of Work</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{activity.description}</p>
        </div>
      )}

      {/* Findings (if completed) */}
      {activity.findings && (
        <div className="card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Findings</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{activity.findings}</p>
        </div>
      )}

      {/* Actions taken (if completed) */}
      {activity.actions_taken && (
        <div className="card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Actions Taken</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{activity.actions_taken}</p>
        </div>
      )}

      {/* Safety notes */}
      {activity.safety_notes && (
        <div className="card mb-4" style={{ border: '1px solid rgba(248,81,73,0.2)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--red)' }}>Safety Notes</h3>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>{activity.safety_notes}</p>
        </div>
      )}

      {/* Team + Tools */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {activity.colleagues && activity.colleagues.length > 0 && (
          <div className="card">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Team</h3>
            {activity.colleagues.map((c, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>• {c}</p>
            ))}
          </div>
        )}
        {activity.tools_used && activity.tools_used.length > 0 && (
          <div className="card">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Tools Used</h3>
            {activity.tools_used.map((t, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>• {t}</p>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      {activity.photo_urls && activity.photo_urls.length > 0 && (
        <div className="card">
          <button onClick={() => setShowPhotos(!showPhotos)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}>
            Photos ({activity.photo_urls.length})
            {showPhotos ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {showPhotos && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {activity.photo_urls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="aspect-square relative rounded-lg overflow-hidden block"
                  style={{ border: '1px solid var(--border)' }}>
                  <Image src={url} alt={`Photo ${i+1}`} fill className="object-cover" sizes="100px"/>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

    </AppShell>
  );
}
