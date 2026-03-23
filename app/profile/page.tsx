'use client';
// app/profile/page.tsx
// Saves directly via supabase.from('profiles').upsert()
// so it works regardless of which version of db.ts is deployed.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { seedDefaults } from '@/lib/db';
import { uploadPhoto } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Save, Loader2, LogOut, Camera, FolderOpen,
  User, Edit2, X, Check, Users, Copy, UserPlus, Send,
} from 'lucide-react';

export default function ProfilePage() {
  const router     = useRouter();
  const supabase   = createBrowserClient();
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [userId,    setUserId]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [isFirst,   setIsFirst]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [stored,    setStored]    = useState<any>({});

  const [fullName,       setFullName]       = useState('');
  const [title,          setTitle]          = useState('');
  const [employeeId,     setEmployeeId]     = useState('');
  const [organization,   setOrganization]   = useState('');
  const [department,     setDepartment]     = useState('');
  const [email,          setEmail]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [certifications, setCertifications] = useState('');
  const [avatarUrl,      setAvatarUrl]      = useState('');
  const [orgId,          setOrgId]          = useState('');
  const [role,           setRole]           = useState('engineer');

  // Invite
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteDone,    setInviteDone]    = useState(false);
  const [inviteError,   setInviteError]   = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        populateFields(profile);
        setStored(profile);
      } else {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setIsFirst(true);
        setEditing(true);
        seedDefaults(supabase, user.id).catch(() => {});
      }
    }
    load();
  }, []);

  function populateFields(p: any) {
    setFullName(p.full_name || '');
    setTitle(p.title || '');
    setEmployeeId(p.employee_id || '');
    setOrganization(p.organization || '');
    setDepartment(p.department || '');
    setEmail(p.email || '');
    setPhone(p.phone || '');
    setCertifications((p.certifications || []).join(', '));
    setAvatarUrl(p.avatar_url || '');
    setOrgId(p.org_id || '');
    setRole(p.role || 'engineer');
  }

  function cancelEdit() { populateFields(stored); setEditing(false); }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || !files[0] || !userId) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { alert('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB'); return; }
    setUploading(true);
    try {
      const url = await uploadPhoto(supabase, userId, file, 'avatars');
      setAvatarUrl(url);
      await supabase.from('profiles')
        .upsert({ id: userId, avatar_url: url, updated_at: new Date().toISOString() });
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (cameraRef.current)  cameraRef.current.value  = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  // ── Save — direct Supabase upsert, no db.ts dependency ───
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !fullName.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        id:             userId,
        full_name:      fullName.trim(),
        updated_at:     new Date().toISOString(),
      };
      if (title)          payload.title          = title;
      if (employeeId)     payload.employee_id    = employeeId;
      if (organization)   payload.organization   = organization;
      if (department)     payload.department     = department;
      if (email)          payload.email          = email;
      if (phone)          payload.phone          = phone;
      if (avatarUrl)      payload.avatar_url     = avatarUrl;
      if (orgId.trim())   payload.org_id         = orgId.trim().toUpperCase();
      if (role)           payload.role           = role;
      payload.certifications = certifications
        ? certifications.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      setStored(data);
      populateFields(data);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
      if (isFirst) { setIsFirst(false); router.push('/dashboard'); }
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  function copyOrgId() {
    if (!orgId) return;
    navigator.clipboard.writeText(orgId.toUpperCase()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviteSending(true); setInviteError('');
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: inviteEmail.trim(),
          orgId:          orgId.toUpperCase(),
          inviterName:    fullName || 'A colleague',
          plantName:      organization || orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setInviteDone(true);
      setInviteEmail('');
      setTimeout(() => { setInviteDone(false); setShowInvite(false); }, 3000);
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviteSending(false);
    }
  }

  function ViewField({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
      <div className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</p>
      </div>
    );
  }

  const roleLabel: Record<string, string> = {
    engineer: 'Engineer', senior_engineer: 'Senior Engineer', admin: 'Admin',
  };

  return (
    <AppShell title="Profile">
      <div className="max-w-lg">

        {/* ── Header card ─────────────────────────────────── */}
        <div className="card mb-5">
          <div className="flex items-center gap-4">

            {/* Avatar + photo buttons directly below */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative w-20 h-20">
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                  style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
                  {avatarUrl
                    ? <Image src={avatarUrl} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/>
                    : <User size={32} style={{ color: 'var(--amber)' }}/>
                  }
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(0,0,0,0.65)' }}>
                      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }}/>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => cameraRef.current?.click()} title="Camera"
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)', color: 'var(--amber)' }}>
                  <Camera size={14}/>
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} title="Gallery"
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  <FolderOpen size={14}/>
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate" style={{ color: '#fff' }}>{fullName || 'Your Name'}</p>
              {title        && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{title}</p>}
              {organization && <p className="text-xs truncate"         style={{ color: 'var(--text-3)' }}>{organization}</p>}
              {orgId        && <p className="text-xs mt-1 font-mono font-bold" style={{ color: 'var(--amber)' }}>Plant: {orgId}</p>}
              {saved && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--green)' }}>
                  <Check size={12}/> Saved
                </div>
              )}
            </div>

            {!editing
              ? <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(240,165,0,0.1)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.2)' }}>
                  <Edit2 size={12}/> Edit
                </button>
              : <button onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  <X size={12}/> Cancel
                </button>
            }
          </div>
        </div>

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>
        <input ref={galleryRef} type="file" accept="image/*"                        onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>

        {/* ── Plant ID card ────────────────────────────────── */}
        <div className="card mb-5"
          style={{ background: 'rgba(240,165,0,0.04)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} style={{ color: 'var(--amber)' }}/>
            <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Plant ID</p>
            {orgId && (
              <span className="ml-auto" style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.25)', fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                ● Connected
              </span>
            )}
          </div>

          {!orgId ? (
            <div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                Set a Plant ID to share faults and activities with colleagues. Everyone at your plant uses the <strong style={{ color: 'var(--amber)' }}>same Plant ID</strong>.
              </p>
              {!editing && (
                <button onClick={() => setEditing(true)}
                  className="text-xs px-3 py-2 rounded-lg font-bold"
                  style={{ background: 'rgba(240,165,0,0.15)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.3)' }}>
                  + Set Plant ID
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 px-3 py-2 rounded-lg font-mono text-sm font-bold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--amber)' }}>
                  {orgId.toUpperCase()}
                </div>
                <button onClick={copyOrgId}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--card)', color: copied ? 'var(--green)' : 'var(--text-2)', border: '1px solid var(--border)' }}>
                  <Copy size={12}/> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {role && <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Role: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{roleLabel[role] || role}</span></p>}

              {/* Invite button */}
              {!showInvite ? (
                <button onClick={() => { setShowInvite(true); setInviteError(''); setInviteDone(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold w-full justify-center"
                  style={{ background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.25)' }}>
                  <UserPlus size={13}/> Invite Colleague to Plant
                </button>
              ) : (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold" style={{ color: 'var(--blue)' }}>Invite to {orgId.toUpperCase()}</p>
                    <button onClick={() => { setShowInvite(false); setInviteError(''); }}
                      style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={13}/>
                    </button>
                  </div>
                  {inviteDone ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
                      style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                      <Check size={13}/> Invite sent!
                    </div>
                  ) : (
                    <form onSubmit={sendInvite} className="flex gap-2">
                      <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com" required className="flex-1 form-input" style={{ fontSize: 12 }}/>
                      <button type="submit" disabled={inviteSending || !inviteEmail.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                        style={{ background: inviteSending ? 'rgba(74,158,255,0.3)' : 'var(--blue)', color: '#fff' }}>
                        {inviteSending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                        {inviteSending ? '' : 'Send'}
                      </button>
                    </form>
                  )}
                  {inviteError && <p className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>⚠ {inviteError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── READ-ONLY ──────────────────────────────────── */}
        {!editing && (
          <div className="card mb-5">
            <ViewField label="Full Name"      value={fullName}      />
            <ViewField label="Job Title"      value={title}         />
            <ViewField label="Employee ID"    value={employeeId}    />
            <ViewField label="Organisation"   value={organization}  />
            <ViewField label="Department"     value={department}    />
            <ViewField label="Email"          value={email}         />
            <ViewField label="Phone"          value={phone}         />
            <ViewField label="Certifications" value={certifications}/>
          </div>
        )}

        {/* ── EDIT FORM ──────────────────────────────────── */}
        {editing && (
          <form onSubmit={handleSave} className="space-y-4 mb-5">

            <div>
              <label className="form-label req">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Engr. Eze Onyebuchi" required className="form-input"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Job Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior Electrical Engineer" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Employee ID</label>
                <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="ENG-001" className="form-input font-mono"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Organisation</label>
                <input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company name" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Department</label>
                <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Electrical Dept." className="form-input"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 800 000 0000" className="form-input"/>
              </div>
            </div>

            <div>
              <label className="form-label">Certifications</label>
              <input value={certifications} onChange={e => setCertifications(e.target.value)}
                placeholder="PMP, COREN, IEEE (comma-separated)" className="form-input"/>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} style={{ color: 'var(--amber)' }}/>
                <label className="form-label" style={{ marginBottom: 0, color: 'var(--amber)' }}>Plant ID</label>
              </div>
              <input value={orgId}
                onChange={e => setOrgId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="e.g. DANGOTE-CEMENT-01"
                className="form-input font-mono" style={{ letterSpacing: '0.08em' }} maxLength={30}/>
              <p className="form-hint mt-1">
                All engineers at your plant type the <strong>same Plant ID</strong>. Example: <span className="font-mono" style={{ color: 'var(--amber)' }}>PLANT-001</span>
              </p>
            </div>

            <div>
              <label className="form-label">Your Role</label>
              <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="engineer">Engineer</option>
                <option value="senior_engineer">Senior Engineer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" disabled={saving || !fullName.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: saving ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
              {saving ? <><Loader2 size={16} className="animate-spin"/> Saving…</> : <><Save size={16}/> {isFirst ? 'Complete Setup' : 'Save Profile'}</>}
            </button>
          </form>
        )}

        <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)', background: 'var(--card)' }}>
            <LogOut size={15}/> Sign Out
          </button>
        </div>

      </div>
    </AppShell>
  );
}
