// lib/db.ts — All database query functions
// Every function here maps to a Supabase table operation.
// All functions take a supabase client so they work in both
// browser (client components) and server (server components/API routes).
//
// Usage:
//   const supabase = createBrowserClient();
//   const faults = await getFaults(supabase, userId);

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Profile, Equipment, Fault, Activity, Resolution,
  Category, ActivityType, FaultCategory, Stats, PartItem
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────

// Generate a fault code from equipment tag + sequence
// e.g. "FLT-TR001-004"
export function generateFaultCode(tagId: string, count: number): string {
  const seq = String(count + 1).padStart(3, '0');
  return `FLT-${tagId.replace(/[^A-Z0-9]/gi, '').toUpperCase()}-${seq}`;
}

// ── Profile ───────────────────────────────────────────────────

// Get the engineer's profile. Returns null if not yet created (first run).
export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)       // Profile ID = Supabase Auth user ID
    .single();
  return data;
}

// Create or update the profile (upsert = insert if new, update if exists)
export async function saveProfile(supabase: SupabaseClient, profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Categories (Equipment) ────────────────────────────────────

export async function getCategories(supabase: SupabaseClient, userId: string): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  return data || [];
}

// Add a new custom category (e.g. when user types a new one in the combobox)
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

// Get all equipment, with category joined
export async function getEquipment(
  supabase: SupabaseClient,
  userId: string,
  filters?: { status?: string; category_id?: string; search?: string }
): Promise<Equipment[]> {
  let query = supabase
    .from('equipment')
    .select('*, category:categories(*)')  // Join category table
    .eq('user_id', userId)
    .order('tag_id');

  if (filters?.status)      query = query.eq('status', filters.status);
  if (filters?.category_id) query = query.eq('category_id', filters.category_id);
  if (filters?.search) {
    // Search across tag_id, name, and location
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
    .select('*, category:categories(*)')
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
    .order('detected_at', { ascending: false }); // newest first

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

export async function getFaultById(supabase: SupabaseClient, id: string): Promise<Fault | null> {
  const { data } = await supabase
    .from('faults')
    .select('*, equipment:equipment(*), fault_category:fault_categories(*)')
    .eq('id', id)
    .single();
  return data;
}

// Get faults that are still unresolved after midnight (for 7am reminder)
export async function getUnresolvedFaultsSince(supabase: SupabaseClient, userId: string, since: string): Promise<Fault[]> {
  const { data } = await supabase
    .from('faults')
    .select('id, title, severity, detected_at, status, reminder_sent')
    .eq('user_id', userId)
    .in('status', ['open', 'under_investigation', 'recurring']) // not resolved
    .lt('detected_at', since)   // detected before midnight
    .eq('reminder_sent', false) // haven't shown reminder yet
    .order('severity');         // critical first
  return data || [];
}

export async function createFault(supabase: SupabaseClient, userId: string, fault: Omit<Fault, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Fault> {
  const { data, error } = await supabase
    .from('faults')
    .insert({ ...fault, user_id: userId, reminder_sent: false })
    .select()
    .single();
  if (error) throw error;
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

// Mark fault reminder as sent so it doesn't fire again
export async function markReminderSent(supabase: SupabaseClient, faultId: string): Promise<void> {
  await supabase.from('faults').update({ reminder_sent: true }).eq('id', faultId);
}

// ── Resolutions ───────────────────────────────────────────────

export async function getResolutionsForFault(supabase: SupabaseClient, faultId: string): Promise<Resolution[]> {
  const { data } = await supabase
    .from('resolutions')
    .select('*')
    .eq('fault_id', faultId)
    .order('resolved_at', { ascending: false });
  return data || [];
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

export async function updateResolution(supabase: SupabaseClient, id: string, updates: Partial<Resolution>): Promise<Resolution> {
  const { data, error } = await supabase
    .from('resolutions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Activities ────────────────────────────────────────────────

export async function getActivities(
  supabase: SupabaseClient,
  userId: string,
  filters?: { status?: string; activity_type_id?: string; equipment_id?: string; search?: string }
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select('*, equipment:equipment(id,tag_id,name), activity_type:activity_types(id,name,icon,color)')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: false });

  if (filters?.status)           query = query.eq('status', filters.status);
  if (filters?.activity_type_id) query = query.eq('activity_type_id', filters.activity_type_id);
  if (filters?.equipment_id)     query = query.eq('equipment_id', filters.equipment_id);
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,work_order_ref.ilike.%${filters.search}%`);
  }

  const { data } = await query;
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

// ── Stats ─────────────────────────────────────────────────────
// Aggregate counts for the dashboard KPI cards
export async function getStats(supabase: SupabaseClient, userId: string): Promise<Stats> {
  // Run all count queries in parallel for speed
  const [eqData, faultData, actData, resCount] = await Promise.all([
    supabase.from('equipment').select('status').eq('user_id', userId),
    supabase.from('faults').select('status,severity,downtime_minutes').eq('user_id', userId),
    supabase.from('activities').select('status').eq('user_id', userId),
    supabase.from('resolutions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const eq     = eqData.data    || [];
  const faults = faultData.data || [];
  const acts   = actData.data   || [];

  // Count downtime — sum all downtime_minutes from all faults
  const totalDowntime = faults.reduce((sum, f) => sum + (f.downtime_minutes || 0), 0);

  return {
    equipment: {
      total:           eq.length,
      operational:     eq.filter(e => e.status === 'operational').length,
      faulty:          eq.filter(e => e.status === 'faulty').length,
      maintenance:     eq.filter(e => e.status === 'under_maintenance').length,
      decommissioned:  eq.filter(e => e.status === 'decommissioned').length,
    },
    faults: {
      total:                faults.length,
      open:                 faults.filter(f => f.status === 'open').length,
      under_investigation:  faults.filter(f => f.status === 'under_investigation').length,
      resolved:             faults.filter(f => f.status === 'resolved').length,
      recurring:            faults.filter(f => f.status === 'recurring').length,
      critical:             faults.filter(f => f.severity === 'critical').length,
      total_downtime:       totalDowntime,
      resolutions:          resCount.count || 0,
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
// Called once on first login to populate categories with sensible defaults

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

// Seed all defaults for a new user (run once on first login)
export async function seedDefaults(supabase: SupabaseClient, userId: string): Promise<void> {
  // Check if already seeded by looking for existing categories
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existing && existing.length > 0) return; // already seeded

  // Insert all defaults in parallel
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
