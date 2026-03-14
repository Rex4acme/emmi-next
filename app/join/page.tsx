'use client';
// app/join/page.tsx
// Where invite email links land.
// Reads ?plantId= from URL, shows signup form with Plant ID already filled in.
// After signup + email confirm, the onboarding sets their org_id automatically.

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Zap, Loader2, AlertCircle, CheckCircle, Users } from 'lucide-react';

function JoinForm() {
  const router       = useRouter();
  const supabase     = createBrowserClient();
  const searchParams = useSearchParams();

  const plantId = searchParams.get('plantId') || '';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  // If already signed in, just set the org_id and go to dashboard
  useEffect(() => {
    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && plantId) {
        await supabase.from('profiles').upsert({
          id:         user.id,
          org_id:     plantId.toUpperCase(),
          updated_at: new Date().toISOString(),
        });
        router.push('/dashboard');
      }
    }
    checkExisting();
  }, [plantId]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          org_id:    plantId.toUpperCase(), // stored in user metadata too
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?plantId=${encodeURIComponent(plantId)}`,
      },
    });

    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(52,208,88,0.12)', border: '1px solid rgba(52,208,88,0.3)' }}>
            <CheckCircle size={28} style={{ color: 'var(--green)' }}/>
          </div>
        </div>
        <h2 className="text-base font-bold mb-2" style={{ color: '#fff' }}>Almost there!</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
          Check your email for a confirmation link, then sign in to join{' '}
          <span className="font-mono font-bold" style={{ color: 'var(--amber)' }}>{plantId}</span>.
        </p>
        <button onClick={() => router.push('/auth')}
          className="px-5 py-2.5 rounded-lg text-sm font-bold"
          style={{ background: 'var(--amber)', color: '#000' }}>
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3">

      {/* Plant ID banner — shows what plant they're joining */}
      {plantId && (
        <div className="flex items-center gap-3 p-3 rounded-xl mb-2"
          style={{ background: 'rgba(240,165,0,0.07)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <Users size={16} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>You're joining plant</p>
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--amber)' }}>{plantId.toUpperCase()}</p>
          </div>
        </div>
      )}

      <div>
        <label className="form-label req">Full Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Engr. Your Name" required className="form-input"/>
      </div>

      <div>
        <label className="form-label req">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" required className="form-input"/>
      </div>

      <div>
        <label className="form-label req">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Min. 6 characters" required minLength={6} className="form-input"/>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
          <span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
        style={{ background: loading ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
        {loading && <Loader2 size={15} className="animate-spin"/>}
        Create Account & Join Plant
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
        Already have an account?{' '}
        <a href="/auth" style={{ color: 'var(--amber)' }}>Sign in instead</a>
      </p>
    </form>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-dvh bg-base flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 600px 400px at 50% 30%, rgba(240,165,0,0.06) 0%, transparent 70%)' }}/>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
            <Zap size={32} style={{ color: 'var(--amber)' }} strokeWidth={2.5}/>
          </div>
          <h1 className="text-3xl font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>You've been invited to join a plant</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <h2 className="text-base font-bold mb-1" style={{ color: '#fff' }}>Create your account</h2>
          <p className="text-xs mb-5" style={{ color: 'var(--text-2)' }}>
            Set up your EMMI engineer profile to get started.
          </p>
          <Suspense fallback={<div className="text-center py-4"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--amber)' }}/></div>}>
            <JoinForm/>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
