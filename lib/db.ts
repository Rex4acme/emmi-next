// lib/db-feed.ts
// Drop-in replacement for getPlantFeed in lib/db.ts
// 
// ROOT CAUSE OF EMPTY FEED:
// The old version relied 100% on RLS policies to filter by org_id.
// When RLS had the infinite recursion bug, Supabase silently returned 0 rows.
// Even after fixing RLS, the join to profiles can still fail if the
// policy isn't perfectly aligned.
//
// THIS FIX:
// 1. First gets the current user's org_id directly (no RLS dependency)
// 2. Gets all user_ids in that org explicitly
// 3. Filters faults/activities/shift_logs by those user_ids directly
// 4. Falls back to own entries if no org_id set
//
// PASTE THIS FUNCTION into your lib/db.ts replacing the existing getPlantFeed

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedItem } from '@/types';

export async function getPlantFeed(
  supabase: SupabaseClient,
  limit = 30
): Promise<FeedItem[]> {
  // Step 1: get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Step 2: get this user's org_id directly — bypass RLS with a simple own-row query
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single();

  const orgId = myProfile?.org_id || null;

  // Step 3: if in an org, get all member user_ids — use get_my_org_id() security definer
  // We query profiles filtered by org_id. Since the RLS fix installed get_my_org_id(),
  // we can now read org members without recursion.
  let memberIds: string[] = [user.id]; // always include self

  if (orgId) {
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId);

    if (members && members.length > 0) {
      memberIds = members.map(m => m.id);
    }
  }

  // Step 4: fetch faults, activities, shift_logs filtered by memberIds explicitly
  const [faultsRes, activitiesRes, shiftsRes] = await Promise.all([

    supabase
      .from('faults')
      .select(`
        id, title, severity, status, detected_at, created_at, user_id,
        equipment:equipment(id,tag_id,name),
        fault_category:fault_categories(id,name,icon,color)
      `)
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('activities')
      .select(`
        id, title, status, scheduled_date, created_at, user_id,
        equipment:equipment(id,tag_id,name),
        activity_type:activity_types(id,name,icon,color)
      `)
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('shift_logs')
      .select(`
        id, shift_type, shift_date, summary, handover_notes,
        open_issues, created_at, user_id, logged_by_name
      `)
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Step 5: get profile info for all members in one query (avatars, names)
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, title')
    .in('id', memberIds);

  const profileMap: Record<string, any> = {};
  (profilesData || []).forEach(p => { profileMap[p.id] = p; });

  // Step 6: assemble FeedItems
  const faultItems: FeedItem[] = (faultsRes.data || []).map(f => ({
    id:         f.id,
    type:       'fault' as const,
    created_at: f.created_at,
    user_id:    f.user_id,
    profile:    profileMap[f.user_id] || null,
    fault:      f as any,
  }));

  const activityItems: FeedItem[] = (activitiesRes.data || []).map(a => ({
    id:         a.id,
    type:       'activity' as const,
    created_at: a.created_at,
    user_id:    a.user_id,
    profile:    profileMap[a.user_id] || null,
    activity:   a as any,
  }));

  const shiftItems: FeedItem[] = (shiftsRes.data || []).map(s => ({
    id:         s.id,
    type:       'shift_log' as const,
    created_at: s.created_at,
    user_id:    s.user_id,
    profile:    profileMap[s.user_id] || null,
    shift_log:  s as any,
  }));

  return [...faultItems, ...activityItems, ...shiftItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}