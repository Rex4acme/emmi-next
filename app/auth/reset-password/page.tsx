'use client';
// app/auth/reset-password/page.tsx
// Supabase sends the engineer here after they click the reset link in their email.
// The URL contains a token — Supabase handles it automatically via onAuthStateChange.
// Engineer just types their new password and confirms.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Zap, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [ready,     setReady]     = useState(false); // true once Supabase confirms the token

  // Supabase injects the token from the URL hash into the session automatically.
  // We listen for PASSWORD_RECOVERY event to know the token is valid.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(error.message); return; }

    setDone(true);
    // Redirect to dashboard after 2.5 seconds
    setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 2500);
  }

  return (
    <div className="min-h-dvh bg-base flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 600px 400px at 50% 30%, rgba(240,165,0,0.06) 0%, transparent 70%)' }}/>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)' }}>
            <Zap size={32} style={{ color: 'var(--amber)' }} strokeWidth={2.5}/>
          </div>
          <h1 className="text-3xl font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Electrical Maintenance Intelligence</p>
        </div>

        <div className="card" style={{ padding: 28 }}>

          {/* Success state */}
          {done ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(52,208,88,0.12)', border: '1px solid rgba(52,208,88,0.3)' }}>
                  <CheckCircle size={28} style={{ color: 'var(--green)' }}/>
                </div>
              </div>
              <h2 className="text-base font-bold mb-2" style={{ color: '#fff' }}>Password updated</h2>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Your password has been changed. Taking you to the dashboard…
              </p>
            </div>

          ) : !ready ? (
            // Waiting for token from URL
            <div className="text-center py-6">
              <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: 'var(--amber)' }}/>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>Verifying reset link…</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                If this takes too long, the link may have expired.{' '}
                <a href="/auth" style={{ color: 'var(--amber)' }}>Request a new one.</a>
              </p>
            </div>

          ) : (
            // Form
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <h2 className="text-base font-bold mb-1" style={{ color: '#fff' }}>Set new password</h2>
                <p className="text-xs mb-5" style={{ color: 'var(--text-2)' }}>
                  Choose a strong password for your EMMI account.
                </p>
              </div>

              {/* New password */}
              <div>
                <label className="form-label req">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required minLength={6}
                    className="form-input"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="form-label req">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Type password again"
                    required
                    className="form-input"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showConf ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                {/* Live match indicator */}
                {confirm.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: password === confirm ? 'var(--green)' : 'var(--red)' }}>
                    {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.2)' }}>
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading || password !== confirm || password.length < 6}
                className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  background: (loading || password !== confirm || password.length < 6) ? 'rgba(240,165,0,0.4)' : 'var(--amber)',
                  color: '#000',
                }}>
                {loading && <Loader2 size={15} className="animate-spin"/>}
                {loading ? 'Updating password…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
