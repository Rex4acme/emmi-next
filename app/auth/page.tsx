'use client';
// app/auth/page.tsx
// FIXED: Google OAuth shows helpful setup guide if provider not enabled in Supabase
// FIXED: Forgot password button now sits BELOW the Sign In button (not inline with label)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Zap, AlertCircle, Loader2, CheckCircle, Settings } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [mode,          setMode]          = useState<Mode>('signin');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [name,          setName]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState('');
  const [googleError,   setGoogleError]   = useState('');
  const [message,       setMessage]       = useState('');

  function switchMode(m: Mode) { setMode(m); setError(''); setMessage(''); setGoogleError(''); }

  async function handleGoogleSignIn() {
    setGoogleLoading(true); setGoogleError(''); setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      if (
        error.message.toLowerCase().includes('provider') ||
        error.message.toLowerCase().includes('not enabled') ||
        error.message.toLowerCase().includes('unsupported') ||
        error.message.toLowerCase().includes('validation')
      ) {
        setGoogleError('setup');
      } else {
        setGoogleError(error.message);
      }
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMessage('Password reset link sent. Check your email inbox (and spam folder).');
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else { router.push('/dashboard'); router.refresh(); }
    }
    setLoading(false);
  }

  // ── Forgot password view ─────────────────────────────────
  if (mode === 'forgot') {
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
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Electrical Maintenance Intelligence</p>
          </div>
          <div className="card" style={{ padding: 28 }}>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>Reset your password</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-2)' }}>
              Enter your email and we'll send you a link to set a new password.
            </p>
            {message ? (
              <div>
                <div className="flex items-start gap-3 p-4 rounded-xl mb-5"
                  style={{ background: 'rgba(52,208,88,0.08)', border: '1px solid rgba(52,208,88,0.25)' }}>
                  <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }}/>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--green)' }}>Email sent</p>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{message}</p>
                  </div>
                </div>
                <button onClick={() => switchMode('signin')}
                  className="w-full py-3 rounded-lg text-sm font-bold"
                  style={{ background: 'var(--amber)', color: '#000' }}>
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div>
                  <label className="form-label req">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required className="form-input"/>
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                    style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/><span>{error}</span>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: loading ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
                  {loading && <Loader2 size={15} className="animate-spin"/>}
                  Send Reset Link
                </button>
                <button type="button" onClick={() => switchMode('signin')}
                  className="w-full py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  ← Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main sign in / sign up view ──────────────────────────
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Electrical Maintenance Intelligence</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {/* Mode toggle */}
          <div className="flex mb-6 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? 'var(--card)' : 'transparent',
                  color:      mode === m ? 'var(--text)'  : 'var(--text-2)',
                  border:     mode === m ? '1px solid var(--border)' : '1px solid transparent',
                }}>
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogleSignIn} disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-semibold transition-all mb-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {googleLoading
              ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }}/>
              : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
            Continue with Google
          </button>

          {/* Google provider not enabled — helpful guide */}
          {googleError === 'setup' && (
            <div className="mb-4 p-3 rounded-xl text-xs leading-relaxed"
              style={{ background: 'rgba(240,165,0,0.07)', border: '1px solid rgba(240,165,0,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Settings size={13} style={{ color: 'var(--amber)', flexShrink: 0 }}/>
                <span className="font-bold" style={{ color: 'var(--amber)' }}>Google Sign-In setup required</span>
              </div>
              <p style={{ color: 'var(--text-2)' }} className="mb-1.5">
                Enable Google in your <strong>Supabase Dashboard</strong>:
              </p>
              <div className="space-y-1 pl-1" style={{ color: 'var(--text-2)' }}>
                <p>① Authentication → Providers → <strong>Google → Enable</strong></p>
                <p>② Add your Google OAuth Client ID &amp; Secret</p>
                <p>③ Redirect URL: <code style={{ color: 'var(--amber)', fontSize: 10, wordBreak: 'break-all' }}>{typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com'}/auth/callback</code></p>
              </div>
              <p className="mt-2 font-semibold" style={{ color: 'var(--amber)' }}>
                Use email sign-in below in the meantime ↓
              </p>
            </div>
          )}
          {googleError && googleError !== 'setup' && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm mb-3"
              style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/><span>{googleError}</span>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }}/>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>or with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }}/>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="form-label req">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Engr. Your Name" required={mode === 'signup'} className="form-input"/>
              </div>
            )}
            <div>
              <label className="form-label req">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" required className="form-input"/>
            </div>
            <div>
              <label className="form-label req">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                required minLength={6} className="form-input"/>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/><span>{error}</span>
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg text-sm"
                style={{ background: 'rgba(52,208,88,0.1)', color: 'var(--green)', border: '1px solid rgba(52,208,88,0.2)' }}>
                ✓ {message}
              </div>
            )}

            {/* PRIMARY ACTION BUTTON */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: loading ? 'rgba(240,165,0,0.5)' : 'var(--amber)', color: '#000' }}>
              {loading && <Loader2 size={15} className="animate-spin"/>}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            {/* ── FORGOT PASSWORD — BELOW SIGN IN BUTTON ── */}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="w-full py-2 text-sm text-center font-medium"
                style={{ color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Forgot password?
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
          EMMI — Personal Engineering Logbook
        </p>
      </div>
    </div>
  );
}
