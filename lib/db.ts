// lib/db.ts — All database query functions
// Every function here maps to a Supabase table operation.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Profile, Equipment, Fault, Activity, Resolution,
  Category, ActivityType, FaultCategory, Stats, PartItem,
  ShiftLog, Task, EquipmentHealth, FeedItem,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────

export function generateFaultCode(tagId: string, count: number): string {
  const seq = String(count + 1).padStart(3, '0');
  return `FLT-${tagId.replace(/[^A-Z0-9]/gi, '').toUpperCase()}-${seq}`;
}

// ── Profile ───────────────────────────────────────────────────

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function saveProfile(supabase: SupabaseClient, profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// NEW: Get all engineers in the same org (for task assignment, feed)
export async function getOrgMembers(supabase: SupabaseClient, orgId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, title, avatar_url, role, employee_id')
    .eq('org_id', orgId)
    .order('full_name');
  return data || [];
}

// ── Categories ────────────────────────────────────────────────

export async function getCategories(supabase: SupabaseClient, userId: string): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  return data || [];
}

export async function addCategory(supabase: SupabaseClient, userId: string, name: string, icon = '⚙'): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, icon, color: '#888888' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Activity Types ────────────────────────────────────────────

export async function getActivityTypes(supabase: SupabaseClient, userId: string): Promise<ActivityType[]> {
  const { data } = await supabase
    .from('activity_types')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  return data || [];
}

// ── Fault Categories ──────────────────────────────────────────

export async function getFaultCategories(supabase: SupabaseClient, userId: string): Promise<FaultCategory[]> {
  const { data } = await supabase
    .from('fault_categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  return data || [];
}

// ── Equipment ─────────────────────────────────────────────────

export async function getEquipment(
  supabase: SupabaseClient,
  userId: string,
  filters?: { status?: string; category_id?: string; search?: string }
): Promise<Equipment[]> {
  let query = supabase
    .from('equipment')
    .select('*, category:categories(*), health:equipment_health(*)')
    .eq('user_id', userId)
    .order('tag_id');

  if (filters?.status)      query = query.eq('status', filters.status);
  if (filters?.category_id) query = query.eq('category_id', filters.category_id);
  if (filters?.search) {
    query = query.or(
      `tag_id.ilike.%${filters.search}%,name.ilike.%${filters.search}%,location.ilike.%${filters.search}%`
    );
  }

  const { data } = await query;
  return data || [];
}

export async function getEquipmentById(supabase: SupabaseClient, id: string): Promise<Equipment | null> {
  const { data } = await supabase
    .from('equipment')
    .select('*, category:categories(*), health:equipment_health(*)')
    .eq('id', id)
    .single();
  return data;
}

export async function createEquipment(supabase: SupabaseClient, userId: string, eq: Omit<Equipment, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .insert({ ...eq, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipment(supabase: SupabaseClient, id: string, updates: Partial<Equipment>): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipment')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEquipment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}

// ── Equipment Health Score ────────────────────────────────────

// NEW: Compute and save health score for a piece of equipment
// Score is based on: fault count (last 30 days) + downtime + recency
export async function computeAndSaveHealthScore(
  supabase: SupabaseClient,
  userId: string,
  equipmentId: string
): Promise<EquipmentHealth> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get faults in last 30 days for this equipment
  const { data: faults } = await supabase
    .from('faults')
    .select('id, downtime_minutes, severity, detected_at, status')
    .eq('equipment_id', equipmentId)
    .eq('user_id', userId)
    .gte('detected_at', thirtyDaysAgo.toISOString());

  const recentFaults = faults || [];
  const faultCount   = recentFaults.length;
  const totalDowntime = recentFaults.reduce((sum, f) => sum + (f.downtime_minutes || 0), 0);
  const lastFault    = recentFaults[0];

  // Score calculation
  // Start at 100, deduct for:
  // - Each fault in 30 days: -8 points
  // - Each critical fault: -5 extra
  // - Each hour of downtime: -2 points (capped at -30)
  // - Open/recurring faults: -5 each
  let score = 100;
  score -= faultCount * 8;
  score -= recentFaults.filter(f => f.severity === 'critical').length * 5;
  score -= Math.min(Math.floor(totalDowntime / 60) * 2, 30);
  score -= recentFaults.filter(f => ['open', 'recurring'].includes(f.status)).length * 5;
  score  = Math.max(0, Math.min(100, score));

  const healthStatus: EquipmentHealth['status'] =
    score >= 75 ? 'healthy' :
    score >= 40 ? 'warning' : 'critical';

  const { data, error } = await supabase
    .from('equipment_health')
    .upsert({
      equipment_id:    equipmentId,
      user_id:         userId,
      health_score:    score,
      status:          healthStatus,
      fault_count_30d: faultCount,
      downtime_30d:    totalDowntime,
      last_fault_at:   lastFault?.detected_at || null,
      computed_at:     new Date().toISOString(),
    }, { onConflict: 'equipment_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// NEW: Recompute health scores for all equipment owned by user
export async function recomputeAllHealthScores(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: equipment } = await supabase
    .from('equipment')
    .select('id')
    .eq('user_id', userId);

  if (!equipment) return;

  await Promise.all(
    equipment.map(eq => computeAndSaveHealthScore(supabase, userId, eq.id))
  );
}

// NEW: Get equipment sorted by health score (worst first) for reliability ranking
export async function getEquipmentByHealth(
  supabase: SupabaseClient,
  userId: string
): Promise<Equipment[]> {
  const { data } = await supabase
    .from('equipment')
    .select('*, category:categories(*), health:equipment_health(*)')
    .eq('user_id', userId)
    .order('tag_id');

  if (!data) return [];

  // Sort: critical first, then by score ascending (worst health first)
  return data.sort((a, b) => {
    const sa = a.health?.health_score ?? 100;
    const sb = b.health?.health_score ?? 100;
    return sa - sb;
  });
}

// ── Faults ────────────────────────────────────────────────────

export async function getFaults(
  supabase: SupabaseClient,
  userId: string,
  filters?: {
    status?: string; severity?: string;
    fault_category_id?: string; equipment_id?: string; search?: string;
  }
): Promise<Fault[]> {
  let query = supabase
    .from('faults')
    .select('*, equipment:equipment(id,tag_id,name), fault_category:fault_categories(id,name,icon,color)')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false });

  if (filters?.status)           query = query.eq('status', filters.status);
  if (filters?.severity)         query = query.eq('severity', filters.severity);
  if (filters?.fault_category_id) query = query.eq('fault_category_id', filters.fault_category_id);
  if (filters?.equipment_id)     query = query.eq('equipment_id', filters.equipment_id);
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,fault_code.ilike.%${filters.search}%,affected_circuit.ilike.%${filters.search}%`);
  }

  const { data } = await query;
  return data || [];
}

// NEW: Get faults from entire org (for shared feed)
export async function getOrgFaults(
  supabase: SupabaseClient,
  limit = 20
): Promise<Fault[]> {
  const { data } = await supabase
    .from('faults')
    .select(`
      *,
      equipment:equipment(id,tag_id,name),
      fault_category:fault_categories(id,name,icon,color),
      profile:profiles(id,full_name,avatar_url,title)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getFaultById(supabase: SupabaseClient, id: string): Promise<Fault | null> {
  const { data } = await supabase
    .from('faults')
    .select('*, equipment:equipment(*), fault_category:fault_categories(*)')
    .eq('id', id)
    .single();
  return data;
}

export async function getUnresolvedFaultsSince(supabase: SupabaseClient, userId: string, since: string): Promise<Fault[]> {
  const { data } = await supabase
    .from('faults')
    .select('id, title, severity, detected_at, status, reminder_sent')
    .eq('user_id', userId)
    .in('status', ['open', 'under_investigation', 'recurring'])
    .lt('detected_at', since)
    .eq('reminder_sent', false)
    .order('severity');
  return data || [];
}

export async function createFault(supabase: SupabaseClient, userId: string, fault: Omit<Fault, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Fault> {
  const { data, error } = await supabase
    .from('faults')
    .insert({ ...fault, user_id: userId })
    .select()
    .single();
  if (error) throw error;

  // Recompute health score for affected equipment
  if (fault.equipment_id) {
    computeAndSaveHealthScore(supabase, userId, fault.equipment_id).catch(() => {});
  }

  return data;
}

export async function updateFault(supabase: SupabaseClient, id: string, updates: Partial<Fault>): Promise<Fault> {
  const { data, error } = await supabase
    .from('faults')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFault(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('faults').delete().eq('id', id);
  if (error) throw error;
}

// ── Resolutions ───────────────────────────────────────────────

export async function getResolutionsForFault(supabase: SupabaseClient, faultId: string): Promise<Resolution[]> {
  const { data } = await supabase
    .from('resolutions')
    .select('*')
    .eq('fault_id', faultId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getResolutions(supabase: SupabaseClient, faultId: string): Promise<Resolution[]> {
  return getResolutionsForFault(supabase, faultId);
}

export async function createResolution(supabase: SupabaseClient, userId: string, resolution: Omit<Resolution, 'id' | 'user_id' | 'created_at'>): Promise<Resolution> {
  const { data, error } = await supabase
    .from('resolutions')
    .insert({ ...resolution, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Activities ────────────────────────────────────────────────

export async function getActivities(
  supabase: SupabaseClient,
  userId: string,
  filters?: { status?: string; equipment_id?: string; search?: string }
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select('*, equipment:equipment(id,tag_id,name), activity_type:activity_types(id,name,icon,color)')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: false });

  if (filters?.status)       query = query.eq('status', filters.status);
  if (filters?.equipment_id) query = query.eq('equipment_id', filters.equipment_id);
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data } = await query;
  return data || [];
}

// NEW: Get activities from entire org (for shared feed)
export async function getOrgActivities(
  supabase: SupabaseClient,
  limit = 20
): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select(`
      *,
      equipment:equipment(id,tag_id,name),
      activity_type:activity_types(id,name,icon,color),
      profile:profiles(id,full_name,avatar_url,title)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getActivityById(supabase: SupabaseClient, id: string): Promise<Activity | null> {
  const { data } = await supabase
    .from('activities')
    .select('*, equipment:equipment(*), activity_type:activity_types(*)')
    .eq('id', id)
    .single();
  return data;
}

export async function createActivity(supabase: SupabaseClient, userId: string, activity: Omit<Activity, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...activity, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateActivity(supabase: SupabaseClient, id: string, updates: Partial<Activity>): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteActivity(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

// ── Shift Logs ────────────────────────────────────────────────

// NEW: Create a shift handover log
export async function createShiftLog(
  supabase: SupabaseClient,
  userId: string,
  log: Omit<ShiftLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<ShiftLog> {
  const { data, error } = await supabase
    .from('shift_logs')
    .insert({ ...log, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// NEW: Get shift logs for the org (all engineers see all shifts)
export async function getOrgShiftLogs(
  supabase: SupabaseClient,
  orgId: string,
  limit = 10
): Promise<ShiftLog[]> {
  const { data } = await supabase
    .from('shift_logs')
    .select('*, profile:profiles(id,full_name,avatar_url,title)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// NEW: Get today's shift log for current user
export async function getTodayShiftLog(
  supabase: SupabaseClient,
  userId: string
): Promise<ShiftLog | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('shift_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('shift_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ── Maintenance Tasks ─────────────────────────────────────────

// NEW: Create a maintenance task
export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  task: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// NEW: Get tasks for org
export async function getOrgTasks(
  supabase: SupabaseClient,
  orgId: string,
  filters?: { status?: string; assigned_to?: string }
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*, equipment:equipment(id,tag_id,name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.status)      query = query.eq('status', filters.status);
  if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

  const { data } = await query;
  return data || [];
}

// NEW: Get tasks assigned to current user
export async function getMyTasks(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<Task[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*, equipment:equipment(id,tag_id,name)')
    .eq('org_id', orgId)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order('created_at', { ascending: false });
  return data || [];
}

// NEW: Update task status
export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Task>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Shared Plant Feed ─────────────────────────────────────────

// NEW: Get unified feed of faults + activities from all org members
// Returns most recent items first, merged and sorted
export async function getPlantFeed(
  supabase: SupabaseClient,
  limit = 30
): Promise<FeedItem[]> {
  const [faultsRes, activitiesRes, shiftsRes] = await Promise.all([
    supabase
      .from('faults')
      .select(`
        id, title, severity, status, detected_at, created_at, user_id,
        equipment:equipment(id,tag_id,name),
        fault_category:fault_categories(id,name,icon,color),
        profile:profiles(id,full_name,avatar_url,title)
      `)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('activities')
      .select(`
        id, title, status, scheduled_date, created_at, user_id,
        equipment:equipment(id,tag_id,name),
        activity_type:activity_types(id,name,icon,color),
        profile:profiles(id,full_name,avatar_url,title)
      `)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('shift_logs')
      .select(`
        id, shift_type, shift_date, summary, handover_notes, created_at, user_id, logged_by_name,
        profile:profiles(id,full_name,avatar_url,title)
      `)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const faultItems: FeedItem[] = (faultsRes.data || []).map(f => ({
    id:         f.id,
    type:       'fault' as const,
    created_at: f.created_at,
    user_id:    f.user_id,
    profile:    (f as any).profile,
    fault:      f as any,
  }));

  const activityItems: FeedItem[] = (activitiesRes.data || []).map(a => ({
    id:         a.id,
    type:       'activity' as const,
    created_at: a.created_at,
    user_id:    a.user_id,
    profile:    (a as any).profile,
    activity:   a as any,
  }));

  const shiftItems: FeedItem[] = (shiftsRes.data || []).map(s => ({
    id:         s.id,
    type:       'shift_log' as const,
    created_at: s.created_at,
    user_id:    s.user_id,
    profile:    (s as any).profile,
    shift_log:  s as any,
  }));

  // Merge and sort by created_at descending
  return [...faultItems, ...activityItems, ...shiftItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

// ── Stats ─────────────────────────────────────────────────────

export async function getStats(supabase: SupabaseClient, userId: string): Promise<Stats> {
  const [eqData, faultData, actData, resCount] = await Promise.all([
    supabase.from('equipment').select('status').eq('user_id', userId),
    supabase.from('faults').select('status,severity,downtime_minutes').eq('user_id', userId),
    supabase.from('activities').select('status').eq('user_id', userId),
    supabase.from('resolutions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const eq     = eqData.data    || [];
  const faults = faultData.data || [];
  const acts   = actData.data   || [];
  const totalDowntime = faults.reduce((sum, f) => sum + (f.downtime_minutes || 0), 0);

  return {
    equipment: {
      total:          eq.length,
      operational:    eq.filter(e => e.status === 'operational').length,
      faulty:         eq.filter(e => e.status === 'faulty').length,
      maintenance:    eq.filter(e => e.status === 'under_maintenance').length,
      decommissioned: eq.filter(e => e.status === 'decommissioned').length,
    },
    faults: {
      total:               faults.length,
      open:                faults.filter(f => f.status === 'open').length,
      under_investigation: faults.filter(f => f.status === 'under_investigation').length,
      resolved:            faults.filter(f => f.status === 'resolved').length,
      recurring:           faults.filter(f => f.status === 'recurring').length,
      critical:            faults.filter(f => f.severity === 'critical').length,
      total_downtime:      totalDowntime,
      resolutions:         resCount.count || 0,
    },
    activities: {
      total:       acts.length,
      planned:     acts.filter(a => a.status === 'planned').length,
      in_progress: acts.filter(a => a.status === 'in_progress').length,
      completed:   acts.filter(a => a.status === 'completed').length,
      cancelled:   acts.filter(a => a.status === 'cancelled').length,
    },
  };
}

// ── Seed defaults ─────────────────────────────────────────────

export const DEFAULT_EQUIPMENT_CATEGORIES = [
  { name: 'Transformer',         icon: '🔌', color: '#f0a500' },
  { name: 'Generator',           icon: '⚡', color: '#34d058' },
  { name: 'Switchgear',          icon: '🔧', color: '#4a9eff' },
  { name: 'Motor',               icon: '⚙',  color: '#a371f7' },
  { name: 'Panel / MCC',         icon: '📦', color: '#f85149' },
  { name: 'Cable & Wiring',      icon: '〰', color: '#d29922' },
  { name: 'Protection Relay',    icon: '🛡',  color: '#79c0ff' },
  { name: 'UPS / Battery',       icon: '🔋', color: '#56d364' },
  { name: 'Lighting',            icon: '💡', color: '#e3b341' },
  { name: 'Instrumentation',     icon: '📊', color: '#bc8cff' },
  { name: 'Other',               icon: '🔩', color: '#8b949e' },
];

export const DEFAULT_ACTIVITY_TYPES = [
  { name: 'Preventive Maintenance', icon: '🔧', color: '#4a9eff' },
  { name: 'Corrective Maintenance', icon: '🔨', color: '#f85149' },
  { name: 'Inspection',             icon: '🔍', color: '#f0a500' },
  { name: 'Testing & Commissioning',icon: '📋', color: '#34d058' },
  { name: 'Calibration',            icon: '📐', color: '#a371f7' },
  { name: 'Overhaul',               icon: '⚙',  color: '#d29922' },
  { name: 'Installation',           icon: '🏗',  color: '#79c0ff' },
  { name: 'Decommissioning',        icon: '🚫', color: '#8b949e' },
  { name: 'Emergency Response',     icon: '🚨', color: '#f85149' },
  { name: 'Routine Check',          icon: '✅', color: '#56d364' },
];

export const DEFAULT_FAULT_CATEGORIES = [
  { name: 'Overheating',           icon: '🌡', color: '#f85149' },
  { name: 'Insulation Failure',    icon: '⚡', color: '#f0a500' },
  { name: 'Protection Trip',       icon: '🛡', color: '#4a9eff' },
  { name: 'Mechanical Fault',      icon: '⚙',  color: '#8b949e' },
  { name: 'Overload',              icon: '📈', color: '#d29922' },
  { name: 'Earth Fault',           icon: '🌍', color: '#56d364' },
  { name: 'Corrosion / Wear',      icon: '🔩', color: '#79c0ff' },
  { name: 'Communication Failure', icon: '📡', color: '#a371f7' },
  { name: 'Power Quality',         icon: '〰', color: '#e3b341' },
  { name: 'Control Circuit Fault', icon: '🎛',  color: '#bc8cff' },
];

export async function seedDefaults(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existing && existing.length > 0) return;

  await Promise.all([
    supabase.from('categories').insert(
      DEFAULT_EQUIPMENT_CATEGORIES.map(c => ({ ...c, user_id: userId }))
    ),
    supabase.from('activity_types').insert(
      DEFAULT_ACTIVITY_TYPES.map(t => ({ ...t, user_id: userId }))
    ),
    supabase.from('fault_categories').insert(
      DEFAULT_FAULT_CATEGORIES.map(f => ({ ...f, user_id: userId }))
    ),
  ]);
}

// ── KPI / Appraisal Data ───────────────────────────────────────

export async function getKPIData(supabase: SupabaseClient, userId: string, year: number) {
  const start = `${year}-01-01T00:00:00.000Z`;
  const end   = `${year}-12-31T23:59:59.999Z`;

  const [faultsRes, activitiesRes] = await Promise.all([
    supabase
      .from('faults')
      .select('*, equipment(name, tag_id), fault_category(name)')
      .eq('user_id', userId)
      .gte('detected_at', start)
      .lte('detected_at', end)
      .order('detected_at', { ascending: false }),
    supabase
      .from('activities')
      .select('*, equipment(name, tag_id), activity_type(name, icon)')
      .eq('user_id', userId)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date', { ascending: false }),
  ]);

  const faults     = faultsRes.data     || [];
  const activities = activitiesRes.data || [];

  const resolvedFaults   = faults.filter((f: any) => f.status === 'resolved');
  const criticalResolved = resolvedFaults.filter((f: any) => f.severity === 'critical');
  const totalDowntime    = faults.reduce((sum: number, f: any) => sum + (f.downtime_minutes || 0), 0);
  const completedActs    = activities.filter((a: any) => a.status === 'completed');

  return {
    year,
    faults,
    activities,
    stats: {
      totalFaults:         faults.length,
      resolvedFaults:      resolvedFaults.length,
      criticalResolved:    criticalResolved.length,
      totalDowntimeMins:   totalDowntime,
      totalActivities:     activities.length,
      completedActivities: completedActs.length,
      resolutionRate:      faults.length > 0 ? Math.round((resolvedFaults.length / faults.length) * 100) : 0,
    },
  };
}
