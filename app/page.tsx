// app/page.tsx — Root page
// Checks if user is signed in:
//   - Signed in  → redirect to /dashboard
//   - Not signed in → redirect to /auth

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

export default async function RootPage() {
  // createServerClient reads auth cookies on the server
  const supabase = await createServerClient();

  // getUser() verifies the session token with Supabase
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard'); // signed in → go to app
  } else {
    redirect('/auth');      // not signed in → go to login
  }
}
