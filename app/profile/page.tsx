'use client';
// app/profile/page.tsx — Engineer Profile
// Default: READ-ONLY view. Edit button switches to form mode.
// After saving, returns to read-only. Save button only visible during edit.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, saveProfile, seedDefaults } from '@/lib/db';
import { uploadPhoto } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import Image from 'next/image';
import { Save, Loader2, LogOut, Camera, FolderOpen, User, Edit2, X, Check } from 'lucide-react';

export default function ProfilePage() {
  const router   = useRouter();
  const supabase = createBrowserClient();
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [userId,    setUserId]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [isFirst,   setIsFirst]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved,     setSaved]     = useState(false);

  // View vs edit mode — default is VIEW (read-only)
  const [editing, setEditing] = useState(false);

  // Stored profile data (what's saved in DB)
  const [stored, setStored] = useState<any>({});

  // Editable form fields (only active during edit mode)
  const [fullName,       setFullName]       = useState('');
  const [title,          setTitle]          = useState('');
  const [employeeId,     setEmployeeId]     = useState('');
  const [organization,   setOrganization]   = useState('');
  const [department,     setDepartment]     = useState('');
  const [email,          setEmail]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [certifications, setCertifications] = useState('');
  const [avatarUrl,      setAvatarUrl]      = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profile = await getProfile(supabase, user.id);
      if (profile) {
        populateFields(profile);
        setStored(profile);
      } else {
        // First time — go straight to edit mode
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setIsFirst(true);
        setEditing(true);
        await seedDefaults(supabase, user.id);
      }
    }
    load();
  }, []);

  function populateFields(profile: any) {
    setFullName(profile.full_name || '');
    setTitle(profile.title || '');
    setEmployeeId(profile.employee_id || '');
    setOrganization(profile.organization || '');
    setDepartment(profile.department || '');
    setEmail(profile.email || '');
    setPhone(profile.phone || '');
    setCertifications((profile.certifications || []).join(', '));
    setAvatarUrl(profile.avatar_url || '');
  }

  // ── Cancel edit — restore stored values ─────────────────
  function cancelEdit() {
    populateFields(stored);
    setEditing(false);
  }

  // ── Upload photo ─────────────────────────────────────────
  async function handlePhotoUpload(files: FileList | null) {
    if (!files || !files[0] || !userId) return;
    setUploading(true);
    try {
      const file = files[0];
      if (!file.type.startsWith('image/')) { alert('Please select an image'); return; }
      if (file.size > 5 * 1024 * 1024)    { alert('Photo must be under 5MB'); return; }
      const url = await uploadPhoto(supabase, userId, file, 'avatars');
      setAvatarUrl(url);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (cameraRef.current)  cameraRef.current.value  = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  // ── Save profile ─────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !fullName.trim()) return;
    setLoading(true);

    const updated = await saveProfile(supabase, {
      id:             userId,
      full_name:      fullName.trim(),
      title:          title          || undefined,
      employee_id:    employeeId     || undefined,
      organization:   organization   || undefined,
      department:     department     || undefined,
      email:          email          || undefined,
      phone:          phone          || undefined,
      avatar_url:     avatarUrl      || undefined,
      certifications: certifications
        ? certifications.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    });

    setStored(updated);
    setSaved(true);
    setLoading(false);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
    if (isFirst) router.push('/dashboard');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  // ── Read-only field renderer ──────────────────────────────
  function ViewField({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
      <div className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</p>
      </div>
    );
  }

  return (
    <AppShell title="Profile">
      <div className="max-w-lg">

        {/* ── Profile photo + name header ───────────────── */}
        <div className="card mb-5 flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '2px solid var(--amber)', background: 'var(--surface)' }}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/>
              ) : (
                <User size={32} style={{ color: 'var(--amber)' }}/>
              )}
            </div>
            {/* Camera button — only in edit mode */}
            {editing && (
              <button onClick={() => cameraRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--amber)', color: '#000' }}>
                <Camera size={13}/>
              </button>
            )}
          </div>

          <div className="flex-1">
            <p className="font-bold text-base">{fullName || 'Your Name'}</p>
            {title        && <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{title}</p>}
            {organization && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{organization}</p>}
            {saved && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--green)' }}>
                <Check size={12}/> Saved
              </div>
            )}
          </div>

          {/* Edit / Cancel button — top right of card */}
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(240,165,0,0.1)', color: 'var(--amber)', border: '1px solid rgba(240,165,0,0.2)' }}>
              <Edit2 size={12}/> Edit
            </button>
          ) : (
            <button onClick={cancelEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              <X size={12}/> Cancel
            </button>
          )}
        </div>

        {/* Hidden file inputs for photo */}
        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>
        <input ref={galleryRef} type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>

        {/* ── READ-ONLY VIEW ─────────────────────────────── */}
        {!editing && (
          <div className="card mb-5">
            <ViewField label="Full Name"       value={fullName}      />
            <ViewField label="Job Title"       value={title}         />
            <ViewField label="Employee ID"     value={employeeId}    />
            <ViewField label="Organisation"    value={organization}  />
            <ViewField label="Department"      value={department}    />
            <ViewField label="Email"           value={email}         />
            <ViewField label="Phone"           value={phone}         />
            <ViewField label="Certifications"  value={certifications}/>

            {/* Choose photo from gallery — also in view mode */}
            <div className="pt-3">
              <button onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--surface)' }}>
                <FolderOpen size={13}/> Change Photo from Gallery
              </button>
              {uploading && <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>Uploading…</p>}
            </div>
          </div>
        )}

        {/* ── EDIT FORM — only shown when editing ───────── */}
        {editing && (
          <form onSubmit={handleSave} className="space-y-4 mb-5">

            {/* Photo from gallery in edit mode */}
            <div className="flex items-center gap-3">
              {uploading ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                  <Loader2 size={14} className="animate-spin"/> Uploading photo…
                </div>
              ) : (
                <button type="button" onClick={() => galleryRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}>
                  <FolderOpen size={13}/> Choose Photo from Gallery
                </button>
              )}
            </div>

            <div>
              <label className="form-label req">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Engr. Eze Onyebuchi" required className="form-input"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Job Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Senior Electrical Engineer" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Employee ID</label>
                <input value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                  placeholder="ENG-001" className="form-input font-mono"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Organisation</label>
                <input value={organization} onChange={e => setOrganization(e.target.value)}
                  placeholder="Company name" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Department</label>
                <input value={department} onChange={e => setDepartment(e.target.value)}
                  placeholder="Electrical Dept." className="form-input"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="form-input"/>
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000" className="form-input"/>
              </div>
            </div>

            <div>
              <label className="form-label">Certifications</label>
              <input value={certifications} onChange={e => setCertifications(e.target.value)}
                placeholder="PMP, COREN, IEEE (comma-separated)" className="form-input"/>
            </div>

            {/* Save button — ONLY shown inside the edit form */}
            <button type="submit" disabled={loading || !fullName.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
              style={{
                background: loading ? 'rgba(240,165,0,0.4)' : 'var(--amber)',
                color: '#000',
              }}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
              {loading ? 'Saving…' : isFirst ? 'Complete Setup' : 'Save Profile'}
            </button>
          </form>
        )}

        {/* Sign out — always visible */}
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
