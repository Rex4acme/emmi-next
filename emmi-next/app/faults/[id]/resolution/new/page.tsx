'use client';
// app/faults/[id]/resolution/new/page.tsx — Log New Resolution
// Records how a fault was resolved. Links back to the parent fault.
// On save: also updates the fault status to 'resolved'.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getFaultById, createResolution, updateFault } from '@/lib/db';
import { toDatetimeLocal } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewResolutionPage() {
  const { id }   = useParams<{ id: string }>(); // fault ID from URL
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,      setUserId]      = useState('');
  const [faultTitle,  setFaultTitle]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [photos,      setPhotos]      = useState<string[]>([]);

  // Form fields
  const [title,               setTitle]               = useState('');
  const [outcome,             setOutcome]             = useState<'resolved'|'partial'|'deferred'|'not_found'>('resolved');
  const [rootCause,           setRootCause]           = useState('');
  const [rootCauseCategory,   setRootCauseCategory]   = useState('');
  const [actionsTaken,        setActionsTaken]        = useState('');
  const [testResults,         setTestResults]         = useState('');
  const [recommendations,     setRecommendations]     = useState('');
  const [resolvedAt,          setResolvedAt]          = useState(toDatetimeLocal(new Date().toISOString()));
  const [durationMinutes,     setDurationMinutes]     = useState('');
  const [resolvedBy,          setResolvedBy]          = useState('');
  const [verifiedBy,          setVerifiedBy]          = useState('');
  const [colleagues,          setColleagues]          = useState('');
  const [toolsUsed,           setToolsUsed]           = useState('');
  const [updateFaultStatus,   setUpdateFaultStatus]   = useState(true); // auto-update fault to resolved

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Pre-fill resolver name from profile
      const [fault, profile] = await Promise.all([
        getFaultById(supabase, id),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);

      if (fault) setFaultTitle(fault.title);
      if (profile.data?.full_name) setResolvedBy(profile.data.full_name);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);

    try {
      // Create the resolution record
      await createResolution(supabase, userId, {
        fault_id:            id,
        title:               title.trim(),
        outcome,
        root_cause:          rootCause           || undefined,
        root_cause_category: rootCauseCategory   || undefined,
        actions_taken:       actionsTaken        || undefined,
        test_results:        testResults         || undefined,
        recommendations:     recommendations     || undefined,
        resolved_at:         new Date(resolvedAt).toISOString(),
        duration_minutes:    durationMinutes ? parseInt(durationMinutes) : undefined,
        resolved_by:         resolvedBy          || undefined,
        verified_by:         verifiedBy          || undefined,
        colleagues:          colleagues ? colleagues.split(',').map(s => s.trim()).filter(Boolean) : [],
        tools_used:          toolsUsed ? toolsUsed.split(',').map(s => s.trim()).filter(Boolean) : [],
        photo_urls:          photos,
      });

      // Optionally update the fault status to 'resolved'
      if (updateFaultStatus && outcome === 'resolved') {
        await updateFault(supabase, id, { status: 'resolved' });
      }

      router.push(`/faults/${id}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  }

  const outcomeOptions = [
    { value: 'resolved',  label: '✅ Fully Resolved',    desc: 'Fault completely fixed' },
    { value: 'partial',   label: '🔶 Partially Resolved', desc: 'Some improvement, still ongoing' },
    { value: 'deferred',  label: '⏳ Deferred',           desc: 'Fix scheduled for later' },
    { value: 'not_found', label: '🔍 Cause Not Found',    desc: 'Could not determine root cause' },
  ] as const;

  return (
    <AppShell title="Log Resolution">
      <Link href={`/faults/${id}`} className="flex items-center gap-1 text-xs mb-4" style={{ color: 'var(--text-2)' }}>
        <ArrowLeft size={13}/> Back to Fault
      </Link>

      {/* Fault reference */}
      {faultTitle && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--green)', padding: '10px 12px' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Resolving fault:</p>
          <p className="text-sm font-semibold mt-0.5">{faultTitle}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Outcome selector */}
        <div>
          <label className="form-label req">Resolution Outcome</label>
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => setOutcome(opt.value)}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  background: outcome === opt.value ? 'rgba(52,208,88,0.1)' : 'var(--card)',
                  border: outcome === opt.value ? '1px solid rgba(52,208,88,0.4)' : '1px solid var(--border)',
                }}>
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="form-label req">Resolution Summary</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Replaced faulty temperature sensor and recalibrated" required className="form-input"/>
        </div>

        {/* Root cause */}
        <div>
          <label className="form-label">Root Cause Analysis</label>
          <textarea value={rootCause} onChange={e => setRootCause(e.target.value)}
            placeholder="What was the fundamental cause of this fault? How was it identified?"
            className="form-input" rows={3}/>
        </div>

        {/* Root cause category */}
        <div>
          <label className="form-label">Root Cause Category</label>
          <select value={rootCauseCategory} onChange={e => setRootCauseCategory(e.target.value)} className="form-input">
            <option value="">— Select category</option>
            {['Wear & Aging', 'Poor Installation', 'Overload', 'Environmental', 'Maintenance Neglect',
              'Design Defect', 'Operator Error', 'Material Failure', 'Contamination', 'Unknown'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Actions taken */}
        <div>
          <label className="form-label">Actions Taken</label>
          <textarea value={actionsTaken} onChange={e => setActionsTaken(e.target.value)}
            placeholder="Step-by-step repair actions performed…"
            className="form-input" rows={4}/>
        </div>

        {/* Test results */}
        <div>
          <label className="form-label">Post-Repair Test Results</label>
          <textarea value={testResults} onChange={e => setTestResults(e.target.value)}
            placeholder="Insulation resistance values, trip test results, load test readings…"
            className="form-input" rows={2}/>
        </div>

        {/* Recommendations */}
        <div>
          <label className="form-label">Recommendations</label>
          <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)}
            placeholder="Preventive actions to avoid recurrence…"
            className="form-input" rows={2}/>
        </div>

        {/* Resolved At + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label req">Resolved At</label>
            <input type="datetime-local" value={resolvedAt}
              onChange={e => setResolvedAt(e.target.value)} required className="form-input"/>
          </div>
          <div>
            <label className="form-label">Duration (mins)</label>
            <input type="number" value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)} min="0" placeholder="0" className="form-input"/>
          </div>
        </div>

        {/* Resolved By + Verified By */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Resolved By</label>
            <input value={resolvedBy} onChange={e => setResolvedBy(e.target.value)} className="form-input"/>
          </div>
          <div>
            <label className="form-label">Verified By</label>
            <input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)}
              placeholder="Supervisor / checker" className="form-input"/>
          </div>
        </div>

        {/* Colleagues + Tools */}
        <div>
          <label className="form-label">Team / Colleagues</label>
          <input value={colleagues} onChange={e => setColleagues(e.target.value)}
            placeholder="Comma-separated names" className="form-input"/>
        </div>
        <div>
          <label className="form-label">Tools / Instruments Used</label>
          <input value={toolsUsed} onChange={e => setToolsUsed(e.target.value)}
            placeholder="Comma-separated tools" className="form-input"/>
        </div>

        {/* Photos */}
        {userId && (
          <div>
            <label className="form-label">Photos</label>
            <PhotoPicker photos={photos} onChange={setPhotos} folder="resolutions" userId={userId}/>
          </div>
        )}

        {/* Auto-update fault status toggle */}
        {outcome === 'resolved' && (
          <div className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(52,208,88,0.08)', border: '1px solid rgba(52,208,88,0.2)' }}>
            <input type="checkbox" id="updateStatus" checked={updateFaultStatus}
              onChange={e => setUpdateFaultStatus(e.target.checked)} className="w-4 h-4"/>
            <label htmlFor="updateStatus" className="text-sm font-medium" style={{ color: 'var(--green)' }}>
              Automatically mark parent fault as Resolved
            </label>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading || !title.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(52,208,88,0.5)' : 'var(--green)', color: '#fff' }}>
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Saving…' : 'Save Resolution'}
        </button>
      </form>
    </AppShell>
  );
}
