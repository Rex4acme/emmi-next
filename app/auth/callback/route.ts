// app/auth/callback/route.ts — OAuth Callback Handler
// After Google sign-in, Supabase redirects the browser here with a
// one-time code. This route exchanges the code for a session cookie,
// then redirects the user to /dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  // Extract the code from the URL: /auth/callback?code=xxxxx
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    // Exchange the OAuth code for a session
    // Supabase will set an auth cookie automatically
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully signed in — redirect to the app
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Something went wrong — redirect to auth page with error
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
