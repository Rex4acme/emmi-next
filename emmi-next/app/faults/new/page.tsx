'use client';
// app/faults/new/page.tsx — Log New Fault Form
// Comprehensive fault logging form with all fields.
// Photo attachment supports camera and local file picker.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  getEquipment, getFaultCategories, createFault, getFaults, generateFaultCode
} from '@/lib/db';
import { toDatetimeLocal } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Equipment, FaultCategory } from '@/types';

export default function NewFaultPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,    setUserId]    = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [faultCats, setFaultCats] = useState<FaultCategory[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [photos,    setPhotos]    = useState<string[]>([]);

  // Form fields
  const [title,           setTitle]           = useState('');
  const [equipmentId,     setEquipmentId]     = useState('');
  const [faultCategoryId, setFaultCategoryId] = useState('');
  const [severity,        setSeverity]        = useState<'low'|'medium'|'high'|'critical'>('medium');
  const [status,          setStatus]          = useState<'open'|'under_investigation'>('open');
  const [detectedAt,      setDetectedAt]      = useState(toDatetimeLocal(new Date().toISOString()));
  const [detectedBy,      setDetectedBy]      = useState('');
  const [detectionMethod, setDetectionMethod] = useState('');
  const [faultLocation,   setFaultLocation]   = useState('');
  const [affectedCircuit, setAffectedCircuit] = useState('');
  const [safetyImpact,    setSafetyImpact]    = useState<'none'|'minor'|'moderate'|'severe'>('none');
  const [downtimeMinutes, setDowntimeMinutes] = useState('');
  const [description,     setDescription]     = useState('');
  const [symptoms,        setSymptoms]        = useState(''); // comma-separated
  const [isRecurring,     setIsRecurring]     = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load equipment list and fault categories for dropdowns
      const [eq, fc] = await Promise.all([
        getEquipment(supabase, user.id),
        getFaultCategories(supabase, user.id),
      ]);
      setEquipment(eq);
      setFaultCats(fc);

      // Pre-fill detected_by from profile
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profile?.full_name) setDetectedBy(profile.full_name);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);

    try {
      // Generate fault code: get count of existing faults for this equipment
      const existingFaults = await getFaults(supabase, userId, { equipment_id: equipmentId || undefined });
      const selectedEq = equipment.find(e => e.id === equipmentId);
      const faultCode = selectedEq
        ? generateFaultCode(selectedEq.tag_id, existingFaults.length)
        : undefined;

      await createFault(supabase, userId, {
        fault_code:        faultCode,
        title:             title.trim(),
        equipment_id:      equipmentId      || undefined,
        fault_category_id: faultCategoryId  || undefined,
        severity,
        status,
        detected_at:      new Date(detectedAt).toISOString(),
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

      router.push('/faults');
    } catch (err: any) {
      alert('Error saving fault: ' + err.message);
      setLoading(false);
    }
  }

  const severityOptions = [
    { value: 'low',      label: '🟢 Low',      desc: 'Minor issue, no immediate risk' },
    { value: 'medium',   label: '🟡 Medium',   desc: 'Needs attention soon' },
    { value: 'high',     label: '🟠 High',     desc: 'Significant impact, urgent' },
    { value: 'critical', label: '🔴 Critical', desc: 'Safety risk / production stop' },
  ] as const;

  return (
    <AppShell title="Log Fault">
      <Link href="/faults" className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Severity selector ─────────────────────────────── */}
        <div>
          <label className="form-label req">Severity</label>
          <div className="grid grid-cols-2 gap-2">
            {severityOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeverity(opt.value)}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  background: severity === opt.value ? 'rgba(240,165,0,0.1)' : 'var(--card)',
                  border: severity === opt.value ? '1px solid rgba(240,165,0,0.4)' : '1px solid var(--border)',
                }}>
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="form-label req">Fault Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. HV Transformer TR-001 temperature trip"
            required
            className="form-input"
          />
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

        {/* Fault Category */}
        <div>
          <label className="form-label">Fault Category</label>
          <select value={faultCategoryId} onChange={e => setFaultCategoryId(e.target.value)} className="form-input">
            <option value="">— Select category (optional)</option>
            {faultCats.map(fc => (
              <option key={fc.id} value={fc.id}>{fc.icon} {fc.name}</option>
            ))}
          </select>
        </div>

        {/* Detected At + Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label req">Detected At</label>
            <input type="datetime-local" value={detectedAt}
              onChange={e => setDetectedAt(e.target.value)}
              required className="form-input"/>
          </div>
          <div>
            <label className="form-label">Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="form-input">
              <option value="open">Open</option>
              <option value="under_investigation">Investigating</option>
            </select>
          </div>
        </div>

        {/* Detected By + Method */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Detected By</label>
            <input value={detectedBy} onChange={e => setDetectedBy(e.target.value)}
              placeholder="Engineer name" className="form-input"/>
          </div>
          <div>
            <label className="form-label">Detection Method</label>
            <input value={detectionMethod} onChange={e => setDetectionMethod(e.target.value)}
              placeholder="e.g. Protection trip" className="form-input"/>
          </div>
        </div>

        {/* Location + Circuit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Fault Location</label>
            <input value={faultLocation} onChange={e => setFaultLocation(e.target.value)}
              placeholder="e.g. HV winding" className="form-input"/>
          </div>
          <div>
            <label className="form-label">Affected Circuit</label>
            <input value={affectedCircuit} onChange={e => setAffectedCircuit(e.target.value)}
              placeholder="e.g. Feeder F3" className="form-input"/>
          </div>
        </div>

        {/* Safety Impact + Downtime */}
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
            <label className="form-label">Downtime (minutes)</label>
            <input type="number" value={downtimeMinutes} onChange={e => setDowntimeMinutes(e.target.value)}
              placeholder="0" min="0" className="form-input"/>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="form-label">Description / Narrative</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Detailed description of the fault, conditions at time of detection, historical context…"
            className="form-input" rows={4}/>
        </div>

        {/* Symptoms */}
        <div>
          <label className="form-label">Symptoms Observed</label>
          <input value={symptoms} onChange={e => setSymptoms(e.target.value)}
            placeholder="e.g. High temperature alarm, abnormal noise, oil leak (comma-separated)"
            className="form-input"/>
          <p className="form-hint">Separate multiple symptoms with commas</p>
        </div>

        {/* Recurring toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <input type="checkbox" id="recurring" checked={isRecurring}
            onChange={e => setIsRecurring(e.target.checked)}
            className="w-4 h-4 accent-amber-400"/>
          <label htmlFor="recurring" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            This is a recurring fault (previously occurred on this equipment)
          </label>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <p className="form-hint mb-2">Use camera or select from your device</p>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="faults" userId={userId}/>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: loading ? 'rgba(248,81,73,0.5)' : 'var(--red)',
            color: '#fff',
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Log Fault'}
        </button>
      </form>
    </AppShell>
  );
}
