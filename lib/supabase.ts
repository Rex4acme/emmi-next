// lib/supabase.ts — Browser Supabase client
// Used in all 'use client' components
// Does NOT import next/headers — safe for browser use only

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Call this inside client components to get a Supabase client
export function createBrowserClient() {
  return _createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}
