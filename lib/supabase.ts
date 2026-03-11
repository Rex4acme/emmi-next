// lib/supabase.ts — Supabase client factory functions
// Two clients needed:
//   createBrowserClient() — used in React components (browser)
//   createServerClient() — used in Server Components and API routes
//
// Uses @supabase/ssr which handles cookie-based auth automatically
// so the user stays signed in across page navigations.

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import { createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ── Environment variable validation ──────────────────────────
// These must be set in .env.local (local dev) or Vercel (production)
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser client ────────────────────────────────────────────
// Use this in 'use client' components.
// Creates a singleton so we don't make a new client on every render.
export function createBrowserClient() {
  return _createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}

// ── Server client ─────────────────────────────────────────────
// Use this in Server Components, Server Actions, and API route handlers.
// Reads/writes auth cookies so the server knows who is signed in.
export async function createServerClient() {
  // cookies() from next/headers reads the request cookies on the server
  const cookieStore = await cookies();

  return _createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      // Read a cookie by name
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // Set a cookie (used when refreshing auth tokens)
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      // Remove a cookie (used on sign-out)
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
}
