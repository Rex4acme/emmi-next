'use client';
// app/equipment/[id]/page.tsx — Equipment Detail Page
// Shows full equipment info, linked faults, linked activities,
// and actions: edit status, delete.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { getEquipmentById, getFaults, getActivities, updateEquipment, deleteEquipment } from '@/lib/db';
import { fmtDate, fmtRelative, statusLabel, severityDot } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Edit, Trash2, Loader2, ArrowLeft, AlertTriangle,
  ClipboardList, Plus, ChevronDown, ChevronUp
} from 'lucide-react';
import type { Equipment, Fault, Activity } from '@/types';

export default function EquipmentDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [equipment,  setEquipment]  = useState<Equipment | null>(null);
  const [faults,     setFaults]     = useState<Fault[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);

  useEffect(() => {
    async function load() {
      const eq = await getEquipmentById(supabase, id);
      if (!eq) { setLoading(false); return; }
      setEquipment(eq);

      // Load linked faults and activities for this equipment
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [f, a] = await Promise.all([
        getFaults(supabase, user.id, { equipment_id: id }),
        getActivities(supabase, user.id, { equipment_id: id }),
      ]);
      setFaults(f);
      setActivities(a);
      setLoading(false);
    }
    load();
  }, [id]);

  // ── Quick status change ───────────────────────────────────
  async function changeStatus(status: Equipment['status']) {
    if (!equipment) return;
    const updated = await updateEquipment(supabase, equipment.id, { status });
    setEquipment(updated);
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (!equipment || !confirm('Delete this equipment? All linked faults and activities will lose their equipment reference.')) return;
    setDeleting(true);
    await deleteEquipment(supabase, equipment.id);
    router.push('/equipment');
  }

  if (loading) {
    return (
      <AppShell title="Equipment">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  if (!equipment) {
    return (
      <AppShell title="Not Found">
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-2)' }}>Equipment not found</p>
          <Link href="/equipment"><button className="mt-3 text-sm" style={{ color: 'var(--amber)' }}>← Back</button></Link>
        </div>
      </AppShell>
    );
  }

  // Status colour map
  const statusColor = {
    operational:       'var(--green)',
    faulty:            'var(--red)',
    under_maintenance: 'var(--amber)',
    decommissioned:    'var(--text-3)',
  }[equipment.status];

  return (
    <AppShell
      title="Equipment Detail"
      action={
        <div className="flex items-center gap-2">
          <Link href={`/equipment/${equipment.id}/edit`}>
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
      <Link href="/equipment" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> All Equipment
      </Link>

      {/* ── Equipment header ──────────────────────────────── */}
      <div className="card mb-4" style={{ borderLeft: `3px solid ${statusColor}` }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="tag-chip">{equipment.tag_id}</span>
              {equipment.category && <span className="text-xl">{equipment.category.icon}</span>}
            </div>
            <h2 className="text-lg font-bold">{equipment.name}</h2>
            {equipment.category && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{equipment.category.name}</p>
            )}
          </div>
        </div>

        {/* Status quick-change pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['operational', 'faulty', 'under_maintenance', 'decommissioned'] as const).map(s => (
            <button key={s} onClick={() => changeStatus(s)}
              className="chip text-xs transition-all"
              style={{
                background: equipment.status === s ? 'rgba(240,165,0,0.2)' : 'var(--surface)',
                color:      equipment.status === s ? 'var(--amber)' : 'var(--text-2)',
                border:     equipment.status === s ? '1px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                fontWeight: equipment.status === s ? '700' : '500',
              }}>
              {statusLabel(s)}
            </button>
          ))}
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Location',     value: equipment.location },
            { label: 'Area',         value: equipment.area },
            { label: 'Manufacturer', value: equipment.manufacturer },
            { label: 'Model',        value: equipment.model },
            { label: 'Serial No.',   value: equipment.serial_number },
            { label: 'Voltage',      value: equipment.voltage_rating },
            { label: 'Rating',       value: equipment.power_rating },
            { label: 'Installed',    value: equipment.installation_date ? fmtDate(equipment.installation_date) : null },
            { label: 'Warranty',     value: equipment.warranty_expiry ? fmtDate(equipment.warranty_expiry) : null },
          ].filter(item => item.value).map(({ label, value }) => (
            <div key={label}>
              <p style={{ color: 'var(--text-3)' }}>{label}</p>
              <p className="font-medium mt-0.5 font-mono" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {equipment.notes && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Notes</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{equipment.notes}</p>
          </div>
        )}
      </div>

      {/* Photos */}
      {equipment.photo_urls && equipment.photo_urls.length > 0 && (
        <div className="card mb-4">
          <button onClick={() => setShowPhotos(!showPhotos)}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}>
            Photos ({equipment.photo_urls.length})
            {showPhotos ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          {showPhotos && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {equipment.photo_urls.map((url, i) => (
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

      {/* ── Linked Faults ─────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: 'var(--red)' }}/>
            Faults ({faults.length})
          </h3>
          <Link href={`/faults/new?equipment=${equipment.id}`}>
            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
              <Plus size={11}/>Log Fault
            </button>
          </Link>
        </div>
        {faults.length === 0 ? (
          <p className="text-xs px-1" style={{ color: 'var(--text-3)' }}>No faults recorded for this equipment.</p>
        ) : (
          <div className="space-y-2">
            {faults.map(f => (
              <Link key={f.id} href={`/faults/${f.id}`}>
                <div className="card flex items-center gap-3 hover:border-white/20 transition-colors" style={{ padding: '10px 12px' }}>
                  <span>{severityDot(f.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{f.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{fmtRelative(f.detected_at)}</p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{statusLabel(f.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Linked Activities ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ClipboardList size={14} style={{ color: 'var(--blue)' }}/>
            Activities ({activities.length})
          </h3>
          <Link href={`/activities/new?equipment=${equipment.id}`}>
            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)' }}>
              <Plus size={11}/>Log Activity
            </button>
          </Link>
        </div>
        {activities.length === 0 ? (
          <p className="text-xs px-1" style={{ color: 'var(--text-3)' }}>No activities recorded for this equipment.</p>
        ) : (
          <div className="space-y-2">
            {activities.map(a => (
              <Link key={a.id} href={`/activities/${a.id}`}>
                <div className="card flex items-center gap-3 hover:border-white/20 transition-colors" style={{ padding: '10px 12px' }}>
                  <span>{a.activity_type?.icon || '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{fmtRelative(a.scheduled_date)}</p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{statusLabel(a.status)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </AppShell>
  );
}
