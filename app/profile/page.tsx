'use client';
// app/profile/page.tsx — Engineer Profile Page
// Shows and edits the current user's profile.
// Also shows sign-out button.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { getProfile, saveProfile, seedDefaults } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import { Save, Loader2, LogOut } from 'lucide-react';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [userId,  setUserId]  = useState('');
  const [loading, setLoading] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [isFirst, setIsFirst] = useState(false); // first-time setup

  // Profile fields
  const [fullName,       setFullName]       = useState('');
  const [title,          setTitle]          = useState('');
  const [employeeId,     setEmployeeId]     = useState('');
  const [organization,   setOrganization]   = useState('');
  const [department,     setDepartment]     = useState('');
  const [email,          setEmail]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [certifications, setCertifications] = useState(''); // comma-separated

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
      } else {
        // First time — pre-fill email from auth
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setIsFirst(true);

        // Seed default categories/activity types/fault categories for new user
        await seedDefaults(supabase, user.id);
      }
    }
    load();
  }, []);

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
      certifications: certifications
        ? certifications.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    });

    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 2500);

    // If first setup, redirect to dashboard
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

        {/* First-time welcome message */}
        {isFirst && (
          <div className="card mb-5" style={{ border: '1px solid rgba(240,165,0,0.3)', background: 'rgba(240,165,0,0.05)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--amber)' }}>
              ⚡ Welcome to EMMI!
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>
              Set up your profile to get started. This takes less than a minute.
              Default equipment categories and fault types have been created for you.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">

          {/* Full name */}
          <div>
            <label className="form-label req">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Engr. Eze Onyebuchi" required className="form-input"/>
          </div>

          {/* Title + Employee ID */}
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

          {/* Organisation + Department */}
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

          {/* Email + Phone */}
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

          {/* Certifications */}
          <div>
            <label className="form-label">Certifications</label>
            <input value={certifications} onChange={e => setCertifications(e.target.value)}
              placeholder="e.g. PMP, COREN, IEEE, C&G (comma-separated)" className="form-input"/>
            <p className="form-hint">Shown on activity reports and sign-offs</p>
          </div>

          {/* Save button */}
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

        {/* Sign out */}
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all"
            style={{
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              background: 'var(--card)',
            }}>
            <LogOut size={15}/>
            Sign Out
          </button>
          <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
            Signs you out of EMMI on this device
          </p>
        </div>

      </div>
    </AppShell>
  );
}
