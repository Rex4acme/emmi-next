// app/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Root page — same auth logic as before, but now shows a boot splash
// instead of instantly redirecting.
//
// Two-file approach:
//   page.tsx         → server component (this file) — auth check only
//   splash-client.tsx → client component — all the visuals + navigation
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/supabase-server';
import SplashClient from './splash-client';

export default async function RootPage() {
  // Same auth logic as original — using your exact import
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const destination = user ? '/dashboard' : '/auth';

  // Hand off to the client splash — it will navigate after the sequence
  return <SplashClient destination={destination} />;
}
