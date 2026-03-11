'use client';
// app/profile/page.tsx — Engineer Profile Page with photo upload

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, saveProfile, seedDefaults } from '@/lib/db';
import { uploadPhoto } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import { Save, Loader2, LogOut, Camera, FolderOpen, User } from 'lucide-react';
import Image from 'next/image';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [userId,       setUserId]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [isFirst,      setIsFirst]      = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState('');
  const [uploading,    setUploading]    = useState(false);

  // Profile fields
  const [fullName,       setFullName]       = useState('');
  const [title,          setTitle]          = useState('');
  const [employeeId,     setEmployeeId]     = useState('');
  const [organization,   setOrganization]   = useState('');
  const [department,     setDepartment]     = useState('');
  const [email,          setEmail]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [certifications, setCertifications] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profile = await getProfile(supabase, user.id);
      if (profile) {
        setFullName(profile.full_name || '');
        setTitle(profile.title || '');
        setEmployeeId(profile.employee_id || '');
        setOrganization(profile.organization || '');
        setDepartment(profile.department || '');
        setEmail(profile.email || user.email || '');
        setPhone(profile.phone || '');
        setCertifications((profile.certifications || []).join(', '));
        setAvatarUrl(profile.avatar_url || '');
      } else {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setIsFirst(true);
        await seedDefaults(supabase, user.id);
      }
    }
    load();
  }, []);

  // Handle photo upload from camera or gallery
  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    setUploading(true);
    try {
      const file = files[0];
      if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
      if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5MB'); return; }
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !fullName.trim()) return;
    setLoading(true);

    await saveProfile(supabase, {
      id:             userId,
      full_name:      fullName.trim(),
      title:          title         || undefined,
      employee_id:    employeeId    || undefined,
      organization:   organization  || undefined,
      department:     department    || undefined,
      email:          email         || undefined,
      phone:          phone         || undefined,
      avatar_url:     avatarUrl     || undefined,
      certifications: certifications
        ? certifications.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    });

    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 2500);
    if (isFirst) router.push('/dashboard');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  return (
    <AppShell title="Profile">
      <div className="max-w-lg">

        {isFirst && (
          <div className="card mb-5" style={{ border: '1px solid rgba(240,165,0,0.3)', background: 'rgba(240,165,0,0.05)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--amber)' }}>⚡ Welcome to EMMI!</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              Set up your profile to get started. Default categories have been created for you.
            </p>
          </div>
        )}

        {/* ── Profile Photo ─────────────────────────────────── */}
        <div className="card mb-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Profile Photo
          </p>
          <div className="flex items-center gap-4">
            {/* Avatar display */}
            <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ border: '2px solid var(--border)', background: 'var(--surface)' }}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/>
              ) : (
                <User size={32} style={{ color: 'var(--text-3)' }}/>
              )}
            </div>

            {/* Upload buttons */}
            <div className="flex-1">
              {uploading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <Loader2 size={16} className="animate-spin"/> Uploading…
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Camera button — opens device camera */}
                  <button type="button" onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}>
                    <Camera size={14}/> Take Photo
                  </button>
                  {/* Gallery button — opens file picker */}
                  <button type="button" onClick={() => galleryRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}>
                    <FolderOpen size={14}/> Choose from Device
                  </button>
                </div>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Max 5MB · JPG, PNG</p>
            </div>
          </div>

          {/* Hidden inputs */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>
          <input ref={galleryRef} type="file" accept="image/*"
            onChange={e => handlePhotoUpload(e.target.files)} className="hidden"/>
        </div>

        <form onSubmit={handleSave} className="space-y-4">

          <div>
            <label className="form-label req">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Engr. Eze Onyebuchi" required className="form-input"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Job Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Senior Electrical Engineer" className="form-input"/>
            </div>
            <div>
              <label className="form-label">Employee ID</label>
              <input value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                placeholder="e.g. ENG-001" className="form-input font-mono"/>
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
                placeholder="e.g. Electrical Dept." className="form-input"/>
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
              placeholder="e.g. PMP, COREN, IEEE (comma-separated)" className="form-input"/>
          </div>

          <button type="submit" disabled={loading || !fullName.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: saved ? 'var(--green)' : loading ? 'rgba(240,165,0,0.5)' : 'var(--amber)',
              color: saved ? '#fff' : '#000',
            }}>
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            {saved ? '✓ Profile Saved' : loading ? 'Saving…' : isFirst ? 'Complete Setup' : 'Save Profile'}
          </button>
        </form>

        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
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
