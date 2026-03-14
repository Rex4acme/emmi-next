'use client';
// app/profile/page.tsx
// Plant ID is set here inside the app — engineers never touch Supabase.
// Profile save is fast: seedDefaults runs in background, text fields save instantly.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, saveProfile, seedDefaults } from '@/lib/db';
import { uploadPhoto } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import {
  Save, Loader2, LogOut, Camera, FolderOpen,
  User, Edit2, X, Check, Users, Copy,
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUserId(user.id);

      const profile = await getProfile(supabase, user.id);
      if (profile) {
        populateFields(profile);
        setStored(profile);
      } else {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setIsFirst(true);
        setEditing(true);
        // Run in background — do NOT await — this was causing the slowness
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
      // Save avatar immediately — separately from profile text
      await supabase.from('profiles').upsert({ id: userId, avatar_url: url, updated_at: new Date().toISOString() });
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !fullName.trim()) return;
    setSaving(true);
    try {
      const updated = await saveProfile(supabase, {
        id:             userId,
        full_name:      fullName.trim(),
        title:          title        || undefined,
        employee_id:    employeeId   || undefined,
        organization:   organization || undefined,
        department:     department   || undefined,
        email:          email        || undefined,
        phone:          phone        || undefined,
        avatar_url:     avatarUrl    || undefined,
        certifications: certifications ? certifications.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        org_id: orgId.trim().toUpperCase() || undefined,
        role:   role || 'engineer',
      });
      setStored(updated);
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

        {/* Header card */}
        <div className="card mb-5 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
              {avatarUrl
                ? <Image src={avatarUrl} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/>
                : <User size={32} style={{ color: 'var(--amber)' }}/>
              }
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }}/>
                </div>
              )}
            </div>
            {editing && !uploading && (
              <button onClick={() => cameraRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--amber)', color: '#000' }}>
                <Camera size={13}/>
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: '#ffffff' }}>{fullName || 'Your Name'}</p>
            {title        && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{title}</p>}
            {organization && <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{organization}</p>}
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

        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>
        <input ref={galleryRef} type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>

        {/* Plant ID — always visible */}
        <div className="card mb-5"
          style={{ background: 'rgba(240,165,0,0.04)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} style={{ color: 'var(--amber)' }}/>
            <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>Plant ID</p>
            {orgId && (
              <span className="ml-auto chip"
                style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.25)', fontSize: 9, padding: '1px 8px' }}>
                ● Connected
              </span>
            )}
          </div>
          {!orgId ? (
            <div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                Set a Plant ID to share faults, activities and shift logs with your colleagues.
                Everyone at your plant uses the <strong style={{ color: 'var(--amber)' }}>same Plant ID</strong>.
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
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Share this with colleagues — they enter it in their own profile to join your plant.
              </p>
              {role && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                  Role: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{roleLabel[role] || role}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* READ-ONLY */}
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
            <div className="pt-3">
              <button onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--surface)' }}>
                <FolderOpen size={13}/> Change Photo from Gallery
              </button>
            </div>
          </div>
        )}

        {/* EDIT FORM */}
        {editing && (
          <form onSubmit={handleSave} className="space-y-4 mb-5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}>
                <FolderOpen size={13}/> Choose Photo
              </button>
              {uploading && <span className="text-xs" style={{ color: 'var(--text-3)' }}>Uploading…</span>}
            </div>

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
              <input
                value={orgId}
                onChange={e => setOrgId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="e.g. DANGOTE-CEMENT-01"
                className="form-input font-mono"
                style={{ letterSpacing: '0.08em' }}
                maxLength={30}
              />
              <p className="form-hint mt-1">
                All engineers at your plant type the <strong>same Plant ID</strong> to share data.
                Example: <span className="font-mono" style={{ color: 'var(--amber)' }}>PLANT-001</span>
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
