'use client';
// app/faults/[id]/edit/page.tsx — Edit Fault Page
// Pre-fills all fields from existing fault record.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getFaultById, getEquipment, getFaultCategories, updateFault } from '@/lib/db';
import { toDatetimeLocal } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Equipment, FaultCategory } from '@/types';

export default function EditFaultPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,    setUserId]    = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [faultCats, setFaultCats] = useState<FaultCategory[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [photos,    setPhotos]    = useState<string[]>([]);

  // Form fields — same as new fault form
  const [title,           setTitle]           = useState('');
  const [equipmentId,     setEquipmentId]     = useState('');
  const [faultCategoryId, setFaultCategoryId] = useState('');
  const [severity,        setSeverity]        = useState<'low'|'medium'|'high'|'critical'>('medium');
  const [status,          setStatus]          = useState<'open'|'under_investigation'|'resolved'|'recurring'>('open');
  const [detectedAt,      setDetectedAt]      = useState('');
  const [detectedBy,      setDetectedBy]      = useState('');
  const [detectionMethod, setDetectionMethod] = useState('');
  const [faultLocation,   setFaultLocation]   = useState('');
  const [affectedCircuit, setAffectedCircuit] = useState('');
  const [safetyImpact,    setSafetyImpact]    = useState<'none'|'minor'|'moderate'|'severe'>('none');
  const [downtimeMinutes, setDowntimeMinutes] = useState('');
  const [description,     setDescription]     = useState('');
  const [symptoms,        setSymptoms]        = useState('');
  const [isRecurring,     setIsRecurring]     = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [fault, eq, fc] = await Promise.all([
        getFaultById(supabase, id),
        getEquipment(supabase, user.id),
        getFaultCategories(supabase, user.id),
      ]);

      if (!fault) { router.push('/faults'); return; }

      // Pre-fill all fields from existing fault
      setTitle(fault.title);
      setEquipmentId(fault.equipment_id || '');
      setFaultCategoryId(fault.fault_category_id || '');
      setSeverity(fault.severity);
      setStatus(fault.status);
      setDetectedAt(toDatetimeLocal(fault.detected_at));
      setDetectedBy(fault.detected_by || '');
      setDetectionMethod(fault.detection_method || '');
      setFaultLocation(fault.fault_location || '');
      setAffectedCircuit(fault.affected_circuit || '');
      setSafetyImpact(fault.safety_impact || 'none');
      setDowntimeMinutes(fault.downtime_minutes?.toString() || '');
      setDescription(fault.description || '');
      setSymptoms((fault.symptoms || []).join(', '));
      setIsRecurring(fault.is_recurring || false);
      setPhotos(fault.photo_urls || []);

      setEquipment(eq);
      setFaultCats(fc);
      setInitLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await updateFault(supabase, id, {
        title:             title.trim(),
        equipment_id:      equipmentId      || undefined,
        fault_category_id: faultCategoryId  || undefined,
        severity,
        status,
        detected_at:       new Date(detectedAt).toISOString(),
        detected_by:       detectedBy       || undefined,
        detection_method:  detectionMethod  || undefined,
        fault_location:    faultLocation    || undefined,
        affected_circuit:  affectedCircuit  || undefined,
        safety_impact:     safetyImpact,
        downtime_minutes:  downtimeMinutes ? parseInt(downtimeMinutes) : 0,
        description:       description      || undefined,
        symptoms:          symptoms ? symptoms.split(',').map(s => s.trim()).filter(Boolean) : [],
        is_recurring:      isRecurring,
        photo_urls:        photos,
      });
      router.push(`/faults/${id}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  if (initLoading) {
    return (
      <AppShell title="Edit Fault">
        <div className="flex justify-center py-12">
          <div className="loading-dots"><span/><span/><span/></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Fault">
      <Link href={`/faults/${id}`} className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back to Fault
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Severity */}
        <div>
          <label className="form-label req">Severity</label>
          <div className="grid grid-cols-2 gap-2">
            {(['low','medium','high','critical'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSeverity(s)}
                className="p-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: severity === s ? 'rgba(240,165,0,0.1)' : 'var(--card)',
                  border: severity === s ? '1px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                  color: severity === s ? 'var(--amber)' : 'var(--text-2)',
                }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="form-label">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
            <option value="open">Open</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="resolved">Resolved</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="form-label req">Fault Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="form-input"/>
        </div>

        {/* Equipment + Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Equipment</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className="form-input">
              <option value="">— None</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.tag_id} — {eq.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Category</label>
            <select value={faultCategoryId} onChange={e => setFaultCategoryId(e.target.value)} className="form-input">
              <option value="">— None</option>
              {faultCats.map(fc => <option key={fc.id} value={fc.id}>{fc.icon} {fc.name}</option>)}
            </select>
          </div>
        </div>

        {/* Detected At + By */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label req">Detected At</label>
            <input type="datetime-local" value={detectedAt} onChange={e => setDetectedAt(e.target.value)} required className="form-input"/>
          </div>
          <div>
            <label className="form-label">Detected By</label>
            <input value={detectedBy} onChange={e => setDetectedBy(e.target.value)} className="form-input"/>
          </div>
        </div>

        {/* Location + Circuit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Fault Location</label>
            <input value={faultLocation} onChange={e => setFaultLocation(e.target.value)} className="form-input"/>
          </div>
          <div>
            <label className="form-label">Affected Circuit</label>
            <input value={affectedCircuit} onChange={e => setAffectedCircuit(e.target.value)} className="form-input"/>
          </div>
        </div>

        {/* Safety + Downtime */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Safety Impact</label>
            <select value={safetyImpact} onChange={e => setSafetyImpact(e.target.value as any)} className="form-input">
              <option value="none">None</option>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          <div>
            <label className="form-label">Downtime (mins)</label>
            <input type="number" value={downtimeMinutes} onChange={e => setDowntimeMinutes(e.target.value)} min="0" className="form-input"/>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="form-label">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="form-input" rows={3}/>
        </div>

        {/* Symptoms */}
        <div>
          <label className="form-label">Symptoms</label>
          <input value={symptoms} onChange={e => setSymptoms(e.target.value)}
            placeholder="Comma-separated symptoms" className="form-input"/>
        </div>

        {/* Recurring */}
        <div className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <input type="checkbox" id="recurring" checked={isRecurring}
            onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4"/>
          <label htmlFor="recurring" className="text-sm" style={{ color: 'var(--text)' }}>
            Recurring fault
          </label>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="faults" userId={userId}/>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading || !title.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(248,81,73,0.5)' : 'var(--red)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </AppShell>
  );
}
