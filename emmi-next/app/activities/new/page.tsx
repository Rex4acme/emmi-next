'use client';
// app/activities/new/page.tsx — Log New Activity Form

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getEquipment, getActivityTypes, createActivity } from '@/lib/db';
import { toDatetimeLocal } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Equipment, ActivityType } from '@/types';

export default function NewActivityPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,        setUserId]        = useState('');
  const [equipment,     setEquipment]     = useState<Equipment[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [photos,        setPhotos]        = useState<string[]>([]);

  // Form fields
  const [title,          setTitle]          = useState('');
  const [equipmentId,    setEquipmentId]    = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [status,         setStatus]         = useState<'planned'|'in_progress'>('planned');
  const [scheduledDate,  setScheduledDate]  = useState(toDatetimeLocal(new Date().toISOString()));
  const [workOrderRef,   setWorkOrderRef]   = useState('');
  const [permitRef,      setPermitRef]      = useState('');
  const [description,    setDescription]    = useState('');
  const [safetyNotes,    setSafetyNotes]    = useState('');
  const [colleagues,     setColleagues]     = useState(''); // comma-separated
  const [toolsUsed,      setToolsUsed]      = useState(''); // comma-separated

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [eq, at] = await Promise.all([
        getEquipment(supabase, user.id),
        getActivityTypes(supabase, user.id),
      ]);
      setEquipment(eq);
      setActivityTypes(at);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);
    try {
      await createActivity(supabase, userId, {
        title:            title.trim(),
        equipment_id:     equipmentId    || undefined,
        activity_type_id: activityTypeId || undefined,
        status,
        scheduled_date:   new Date(scheduledDate).toISOString(),
        work_order_ref:   workOrderRef   || undefined,
        permit_ref:       permitRef      || undefined,
        description:      description    || undefined,
        safety_notes:     safetyNotes    || undefined,
        colleagues:       colleagues ? colleagues.split(',').map(s => s.trim()).filter(Boolean) : [],
        tools_used:       toolsUsed  ? toolsUsed.split(',').map(s => s.trim()).filter(Boolean) : [],
        photo_urls:       photos,
      });
      router.push('/activities');
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  return (
    <AppShell title="Log Activity">
      <Link href="/activities" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Activity type selector */}
        <div>
          <label className="form-label">Activity Type</label>
          <div className="grid grid-cols-2 gap-2">
            {activityTypes.slice(0, 6).map(at => (
              <button key={at.id} type="button"
                onClick={() => setActivityTypeId(at.id)}
                className="flex items-center gap-2 p-2.5 rounded-lg text-left transition-all"
                style={{
                  background: activityTypeId === at.id ? 'rgba(74,158,255,0.15)' : 'var(--card)',
                  border: activityTypeId === at.id ? '1px solid rgba(74,158,255,0.4)' : '1px solid var(--border)',
                }}>
                <span>{at.icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{at.name}</span>
              </button>
            ))}
          </div>
          {/* Full dropdown for remaining types */}
          <select value={activityTypeId} onChange={e => setActivityTypeId(e.target.value)}
            className="form-input mt-2">
            <option value="">— Or select from all types</option>
            {activityTypes.map(at => (
              <option key={at.id} value={at.id}>{at.icon} {at.name}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="form-label req">Activity Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Quarterly maintenance of TR-001" required className="form-input"/>
        </div>

        {/* Equipment */}
        <div>
          <label className="form-label">Equipment</label>
          <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className="form-input">
            <option value="">— Select equipment (optional)</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.tag_id} — {eq.name}</option>
            ))}
          </select>
        </div>

        {/* Scheduled date + status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label req">Scheduled Date</label>
            <input type="datetime-local" value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)} required className="form-input"/>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
        </div>

        {/* Work order + permit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Work Order Ref.</label>
            <input value={workOrderRef} onChange={e => setWorkOrderRef(e.target.value)}
              placeholder="e.g. WO-2024-001" className="form-input font-mono"/>
          </div>
          <div>
            <label className="form-label">Permit to Work Ref.</label>
            <input value={permitRef} onChange={e => setPermitRef(e.target.value)}
              placeholder="e.g. PTW-001" className="form-input font-mono"/>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="form-label">Scope of Work</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Detailed scope of work, objectives, acceptance criteria…"
            className="form-input" rows={3}/>
        </div>

        {/* Safety notes */}
        <div>
          <label className="form-label">Safety Notes</label>
          <textarea value={safetyNotes} onChange={e => setSafetyNotes(e.target.value)}
            placeholder="LOTO procedure, PPE requirements, isolated circuits, hazards…"
            className="form-input" rows={2}/>
        </div>

        {/* Colleagues */}
        <div>
          <label className="form-label">Team / Colleagues</label>
          <input value={colleagues} onChange={e => setColleagues(e.target.value)}
            placeholder="e.g. Engr. Smith, Tech. Eze (comma-separated)" className="form-input"/>
        </div>

        {/* Tools */}
        <div>
          <label className="form-label">Tools / Instruments Used</label>
          <input value={toolsUsed} onChange={e => setToolsUsed(e.target.value)}
            placeholder="e.g. Megger, Torque wrench, Thermal camera (comma-separated)"
            className="form-input"/>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="activities" userId={userId}/>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading || !title.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(74,158,255,0.5)' : 'var(--blue)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Activity'}
        </button>
      </form>
    </AppShell>
  );
}
