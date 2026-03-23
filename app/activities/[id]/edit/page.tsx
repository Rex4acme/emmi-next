'use client';
// app/activities/[id]/edit/page.tsx — Edit Activity Page

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getActivityById, getEquipment, getActivityTypes, updateActivity } from '@/lib/db';
import { toDatetimeLocal } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Equipment, ActivityType } from '@/types';

export default function EditActivityPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,        setUserId]        = useState('');
  const [equipment,     setEquipment]     = useState<Equipment[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [initLoad,      setInitLoad]      = useState(true);
  const [photos,        setPhotos]        = useState<string[]>([]);

  // Form fields
  const [title,          setTitle]          = useState('');
  const [equipmentId,    setEquipmentId]    = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [status,         setStatus]         = useState<'planned'|'in_progress'|'completed'|'cancelled'>('planned');
  const [scheduledDate,  setScheduledDate]  = useState('');
  const [workOrderRef,   setWorkOrderRef]   = useState('');
  const [permitRef,      setPermitRef]      = useState('');
  const [description,    setDescription]    = useState('');
  const [findings,       setFindings]       = useState('');
  const [actionsTaken,   setActionsTaken]   = useState('');
  const [safetyNotes,    setSafetyNotes]    = useState('');
  const [recommendations,setRecommendations]= useState('');
  const [colleagues,     setColleagues]     = useState('');
  const [toolsUsed,      setToolsUsed]      = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [act, eq, at] = await Promise.all([
        getActivityById(supabase, id),
        getEquipment(supabase, user.id),
        getActivityTypes(supabase, user.id),
      ]);

      if (!act) { router.push('/activities'); return; }

      setTitle(act.title);
      setEquipmentId(act.equipment_id || '');
      setActivityTypeId(act.activity_type_id || '');
      setStatus(act.status);
      setScheduledDate(toDatetimeLocal(act.scheduled_date));
      setWorkOrderRef(act.work_order_ref || '');
      setPermitRef(act.permit_ref || '');
      setDescription(act.description || '');
      setFindings(act.findings || '');
      setActionsTaken(act.actions_taken || '');
      setSafetyNotes(act.safety_notes || '');
      setRecommendations(act.recommendations || '');
      setColleagues((act.colleagues || []).join(', '));
      setToolsUsed((act.tools_used || []).join(', '));
      setPhotos(act.photo_urls || []);

      setEquipment(eq);
      setActivityTypes(at);
      setInitLoad(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await updateActivity(supabase, id, {
        title:            title.trim(),
        equipment_id:     equipmentId    || undefined,
        activity_type_id: activityTypeId || undefined,
        status,
        scheduled_date:   scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        work_order_ref:   workOrderRef   || undefined,
        permit_ref:       permitRef      || undefined,
        description:      description    || undefined,
        findings:         findings       || undefined,
        actions_taken:    actionsTaken   || undefined,
        safety_notes:     safetyNotes    || undefined,
        recommendations:  recommendations || undefined,
        colleagues:       colleagues ? colleagues.split(',').map(s => s.trim()).filter(Boolean) : [],
        tools_used:       toolsUsed  ? toolsUsed.split(',').map(s => s.trim()).filter(Boolean) : [],
        photo_urls:       photos,
      });
      router.push(`/activities/${id}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  if (initLoad) {
    return (
      <AppShell title="Edit Activity">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Activity">
      <Link href={`/activities/${id}`} className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Title */}
        <div>
          <label className="form-label req">Activity Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="form-input"/>
        </div>

        {/* Type + Equipment */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Activity Type</label>
            <select value={activityTypeId} onChange={e => setActivityTypeId(e.target.value)} className="form-input">
              <option value="">— Select type</option>
              {activityTypes.map(at => <option key={at.id} value={at.id}>{at.icon} {at.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Equipment</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className="form-input">
              <option value="">— None</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.tag_id} — {eq.name}</option>)}
            </select>
          </div>
        </div>

        {/* Status + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="form-label">Scheduled Date</label>
            <input type="datetime-local" value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)} className="form-input"/>
          </div>
        </div>

        {/* Work order + Permit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Work Order Ref.</label>
            <input value={workOrderRef} onChange={e => setWorkOrderRef(e.target.value)} className="form-input font-mono"/>
          </div>
          <div>
            <label className="form-label">PTW Ref.</label>
            <input value={permitRef} onChange={e => setPermitRef(e.target.value)} className="form-input font-mono"/>
          </div>
        </div>

        <div>
          <label className="form-label">Scope of Work</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="form-input" rows={3}/>
        </div>

        <div>
          <label className="form-label">Findings</label>
          <textarea value={findings} onChange={e => setFindings(e.target.value)} className="form-input" rows={2}/>
        </div>

        <div>
          <label className="form-label">Actions Taken</label>
          <textarea value={actionsTaken} onChange={e => setActionsTaken(e.target.value)} className="form-input" rows={2}/>
        </div>

        <div>
          <label className="form-label">Safety Notes</label>
          <textarea value={safetyNotes} onChange={e => setSafetyNotes(e.target.value)} className="form-input" rows={2}/>
        </div>

        <div>
          <label className="form-label">Recommendations</label>
          <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} className="form-input" rows={2}/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Team</label>
            <input value={colleagues} onChange={e => setColleagues(e.target.value)}
              placeholder="Comma-separated" className="form-input"/>
          </div>
          <div>
            <label className="form-label">Tools Used</label>
            <input value={toolsUsed} onChange={e => setToolsUsed(e.target.value)}
              placeholder="Comma-separated" className="form-input"/>
          </div>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="activities" userId={userId}/>
          </div>
        )}

        <button type="submit" disabled={loading || !title.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(74,158,255,0.5)' : 'var(--blue)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </AppShell>
  );
}
