'use client';
// app/permit/new/page.tsx — Issue a Permit to Work
// Nigerian industrial standard: engineer requests PTW before working on
// live or isolated electrical equipment. Senior/Admin approves.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import AppShell from '@/components/layout/AppShell';
import { Save, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

const WORK_TYPES = [
  'Live Line Work', 'Isolation & LOTO', 'Hot Work', 'Working at Height',
  'Confined Space Entry', 'Excavation', 'Chemical Handling',
  'High Voltage Switching', 'Panel Maintenance', 'Cable Jointing',
];

const HAZARDS = [
  'Electric Shock', 'Arc Flash', 'Burns', 'Falls', 'Asphyxiation',
  'Toxic Fumes', 'Explosion', 'Crush Injury', 'Noise', 'Fire',
];

const PRECAUTIONS = [
  'LOTO applied', 'PPE worn', 'Area barricaded', 'Fire extinguisher on standby',
  'Gas test done', 'Earthing applied', 'Written isolation certificate issued',
  'Safety observer present', 'First aid kit available', 'Emergency contact informed',
];

export default function NewPermitPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [saving,      setSaving]      = useState(false);
  const [userId,      setUserId]      = useState('');
  const [orgId,       setOrgId]       = useState('');
  const [myName,      setMyName]      = useState('');
  const [equipment,   setEquipment]   = useState<any[]>([]);
  const [orgMembers,  setOrgMembers]  = useState<any[]>([]);

  // Form fields
  const [equipmentId,   setEquipmentId]   = useState('');
  const [workType,      setWorkType]      = useState('');
  const [workDesc,      setWorkDesc]      = useState('');
  const [location,      setLocation]      = useState('');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [workers,       setWorkers]       = useState('');
  const [approverID,    setApproverID]    = useState('');
  const [selHazards,    setSelHazards]    = useState<string[]>([]);
  const [selPrecautions,setSelPrecautions]= useState<string[]>([]);
  const [additionalPPE, setAdditionalPPE] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles').select('full_name, org_id').eq('id', user.id).single();
      setOrgId(profile?.org_id || '');
      setMyName(profile?.full_name || '');

      // Load equipment for dropdown
      const { data: eq } = await supabase
        .from('equipment').select('id, tag_id, name').eq('user_id', user.id).order('tag_id');
      setEquipment(eq || []);

      // Load org members for approver dropdown
      if (profile?.org_id) {
        const { data: members } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('org_id', profile.org_id)
          .in('role', ['senior_engineer', 'admin'])
          .neq('id', user.id);
        setOrgMembers(members || []);
      }
    }
    load();
  }, []);

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workType || !workDesc || !startDate || !endDate) return;
    setSaving(true);

    try {
      const { data, error } = await supabase.from('permits').insert({
        user_id:       userId,
        org_id:        orgId || null,
        equipment_id:  equipmentId || null,
        work_type:     workType,
        work_description: workDesc.trim(),
        location:      location.trim(),
        start_datetime: startDate,
        end_datetime:   endDate,
        workers:       workers.split(',').map(s => s.trim()).filter(Boolean),
        approver_id:   approverID || null,
        hazards:       selHazards,
        precautions:   selPrecautions,
        additional_ppe: additionalPPE.trim() || null,
        requested_by_name: myName,
        status:        approverID ? 'pending_approval' : 'approved',
        created_at:    new Date().toISOString(),
      }).select().single();

      if (error) throw error;
      router.push('/permit');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="New Permit to Work">
      <div className="max-w-lg">

        {/* Warning banner */}
        <div className="card mb-5 flex items-start gap-3"
          style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }}/>
          <div>
            <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--red)' }}>
              Permit to Work — Safety Critical Document
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
              This permit authorises work on electrical equipment. Ensure all hazards are identified and all precautions are in place before work begins.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Work details */}
          <div className="card space-y-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Work Details</h3>

            <div>
              <label className="form-label">Equipment <span style={{ color: 'var(--red)' }}>*</span></label>
              <select className="form-input" value={equipmentId} onChange={e => setEquipmentId(e.target.value)}>
                <option value="">— Select equipment (optional) —</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag_id} — {eq.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Type of Work <span style={{ color: 'var(--red)' }}>*</span></label>
              <select className="form-input" value={workType} onChange={e => setWorkType(e.target.value)} required>
                <option value="">— Select work type —</option>
                {WORK_TYPES.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Work Description <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea className="form-input" rows={3} value={workDesc}
                onChange={e => setWorkDesc(e.target.value)}
                placeholder="Describe the exact work to be performed…" required/>
            </div>

            <div>
              <label className="form-label">Work Location</label>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. MCC Room 2, Bay 4"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Start Date & Time <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="datetime-local" className="form-input" value={startDate}
                  onChange={e => setStartDate(e.target.value)} required/>
              </div>
              <div>
                <label className="form-label">End Date & Time <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="datetime-local" className="form-input" value={endDate}
                  onChange={e => setEndDate(e.target.value)} required/>
              </div>
            </div>

            <div>
              <label className="form-label">Workers on the Job</label>
              <input className="form-input" value={workers} onChange={e => setWorkers(e.target.value)}
                placeholder="Comma-separated names e.g. Engr. Eze, Engr. Fatima"/>
            </div>
          </div>

          {/* Hazards */}
          <div className="card">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--red)' }}>⚠ Hazards Identified</h3>
            <div className="flex flex-wrap gap-2">
              {HAZARDS.map(h => {
                const sel = selHazards.includes(h);
                return (
                  <button type="button" key={h} onClick={() => toggleItem(selHazards, setSelHazards, h)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: sel ? 'rgba(248,81,73,0.2)' : 'var(--surface)',
                      color:      sel ? 'var(--red)'           : 'var(--text-2)',
                      border:     sel ? '1px solid rgba(248,81,73,0.4)' : '1px solid var(--border)',
                    }}>
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Precautions */}
          <div className="card">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--green)' }}>✓ Precautions in Place</h3>
            <div className="flex flex-wrap gap-2">
              {PRECAUTIONS.map(p => {
                const sel = selPrecautions.includes(p);
                return (
                  <button type="button" key={p} onClick={() => toggleItem(selPrecautions, setSelPrecautions, p)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: sel ? 'rgba(52,208,88,0.15)' : 'var(--surface)',
                      color:      sel ? 'var(--green)'          : 'var(--text-2)',
                      border:     sel ? '1px solid rgba(52,208,88,0.3)' : '1px solid var(--border)',
                    }}>
                    {sel ? '✓ ' : ''}{p}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <label className="form-label">Additional PPE Required</label>
              <input className="form-input" value={additionalPPE} onChange={e => setAdditionalPPE(e.target.value)}
                placeholder="e.g. Arc flash suit, insulated gloves Class 4"/>
            </div>
          </div>

          {/* Approver */}
          <div className="card">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--amber)' }}>Approval</h3>
            {orgMembers.length > 0 ? (
              <div>
                <label className="form-label">Send to Approver</label>
                <select className="form-input" value={approverID} onChange={e => setApproverID(e.target.value)}>
                  <option value="">— Self-approve (no senior available) —</option>
                  {orgMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.role.replace('_', ' ')})</option>
                  ))}
                </select>
                <p className="form-hint mt-1">
                  {approverID ? 'Permit will be marked "Pending Approval" until approved.' : 'Permit will be auto-approved.'}
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                No Senior Engineers or Admins in your plant yet. Permit will be self-approved.
              </p>
            )}
          </div>

          <button type="submit" disabled={saving || !workType || !workDesc || !startDate || !endDate}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: saving ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
            {saving
              ? <><Loader2 size={16} className="animate-spin"/> Issuing Permit…</>
              : <><ShieldCheck size={16}/> Issue Permit to Work</>
            }
          </button>
        </form>
      </div>
    </AppShell>
  );
}