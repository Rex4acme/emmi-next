'use client';
// app/auth/page.tsx — Login / Sign-up page
// Supports:
//   - Google OAuth (one-click sign in)
//   - Email + password (sign up and sign in)
// On success: Supabase sets a cookie and Next.js redirects to /dashboard

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Zap, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function AuthPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  // Toggle between sign-in and sign-up modes
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');  // only used in signup mode
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [message,  setMessage]  = useState(''); // success messages

  // ── Google OAuth ─────────────────────────────────────────────
  // Opens Google account chooser. On success, Supabase redirects back
  // to /auth/callback which sets the cookie and redirects to /dashboard.
  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // If no error, browser will be redirected by Supabase — no need to setLoading(false)
  }

  // ── Email / Password ─────────────────────────────────────────
  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault(); // prevent default form submit reload
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      // Sign up — create new account
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }, // stored in user_metadata
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        // Supabase sends a confirmation email
        setMessage('Check your email for a confirmation link. Then sign in.');
      }
    } else {
      // Sign in — authenticate existing account
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard'); // signed in — go to app
        router.refresh();          // refresh server components with new session
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-dvh bg-base flex flex-col items-center justify-center p-4">

      {/* Background glow effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at 50% 30%, rgba(240,165,0,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">

        {/* ── Logo ────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
            <Zap size={32} className="text-amber-400" style={{ color: 'var(--amber)' }} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Electrical Maintenance Intelligence
          </p>
        </div>

        {/* ── Auth card ────────────────────────────────────────── */}
        <div className="card" style={{ padding: '28px' }}>

          {/* Mode toggle — Sign In / Sign Up */}
          <div className="flex mb-6 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setMessage(''); }}
                className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? 'var(--card)' : 'transparent',
                  color:      mode === m ? 'var(--text)'  : 'var(--text-2)',
                  border:     mode === m ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Google Sign-In button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-semibold transition-all mb-4"
            style={{
              background: 'var(--surface)',
              border:     '1px solid var(--border)',
              color:      'var(--text)',
            }}
          >
            {/* Google logo SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }}/>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>or with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }}/>
          </div>

          {/* Email / password form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">

            {/* Name field — only shown in signup mode */}
            {mode === 'signup' && (
              <div>
                <label className="form-label req">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-3)' }}/>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Engr. Your Name"
                    required={mode === 'signup'}
                    className="form-input pl-9"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="form-label req">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}/>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="form-input pl-9"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="form-label req">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}/>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  required
                  minLength={6}
                  className="form-input pl-9"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
                <span>{error}</span>
              </div>
            )}

            {/* Success message (after sign-up) */}
            {message && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                <span>✓ {message}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{
                background: loading ? 'rgba(240,165,0,0.5)' : 'var(--amber)',
                color: '#000',
              }}
            >
              {loading && <Loader2 size={15} className="animate-spin"/>}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
          EMMI — Personal Engineering Logbook
        </p>
      </div>
    </div>
  );
}
