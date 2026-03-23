// lib/supabase-server.ts — Server-side Supabase client
// Used ONLY in Server Components and API route handlers
// This file imports next/headers which is server-only

import { createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Call this in Server Components or API routes to get an auth-aware client
export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
}
