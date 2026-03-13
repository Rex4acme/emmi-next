// types/index.ts — All TypeScript type definitions for EMMI
// These match the Supabase database table columns exactly

// ── Engineer Profile ──────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  title?: string;
  employee_id?: string;
  organization?: string;
  department?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  certifications?: string[];
  // NEW: org grouping + role
  org_id?: string;           // e.g. "PLANT-001" — links engineers in same plant
  role?: UserRole;           // 'engineer' | 'senior_engineer' | 'admin'
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'engineer' | 'senior_engineer' | 'admin';

// ── Equipment Category ────────────────────────────────────────
export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color?: string;
  created_at?: string;
}

// ── Equipment ────────────────────────────────────────────────
export interface Equipment {
  id: string;
  user_id: string;
  tag_id: string;
  name: string;
  category_id?: string;
  category?: Category;
  status: EquipmentStatus;
  location?: string;
  area?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  voltage_rating?: string;
  power_rating?: string;
  installation_date?: string;
  warranty_expiry?: string;
  notes?: string;
  photo_urls?: string[];
  // NEW: joined health score
  health?: EquipmentHealth;
  created_at?: string;
  updated_at?: string;
}

export type EquipmentStatus =
  | 'operational'
  | 'faulty'
  | 'under_maintenance'
  | 'decommissioned';

// ── Equipment Health Score ────────────────────────────────────
export interface EquipmentHealth {
  id: string;
  equipment_id: string;
  user_id: string;
  health_score: number;       // 0–100
  status: HealthStatus;       // 'healthy' | 'warning' | 'critical'
  fault_count_30d: number;
  downtime_30d: number;       // minutes
  last_fault_at?: string;
  computed_at: string;
}

export type HealthStatus = 'healthy' | 'warning' | 'critical';

// ── Activity Type ─────────────────────────────────────────────
export interface ActivityType {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at?: string;
}

// ── Activity ──────────────────────────────────────────────────
export interface Activity {
  id: string;
  user_id: string;
  title: string;
  equipment_id?: string;
  equipment?: Equipment;
  activity_type_id?: string;
  activity_type?: ActivityType;
  status: ActivityStatus;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  work_order_ref?: string;
  permit_ref?: string;
  description?: string;
  findings?: string;
  actions_taken?: string;
  safety_notes?: string;
  recommendations?: string;
  colleagues?: string[];
  tools_used?: string[];
  parts_replaced?: PartItem[];
  photo_urls?: string[];
  signature_url?: string;
  // NEW: joined profile for feed display
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title'>;
  created_at?: string;
  updated_at?: string;
}

export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

// ── Fault Category ────────────────────────────────────────────
export interface FaultCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at?: string;
}

// ── Fault ─────────────────────────────────────────────────────
export interface Fault {
  id: string;
  user_id: string;
  fault_code?: string;
  title: string;
  equipment_id?: string;
  equipment?: Equipment;
  fault_category_id?: string;
  fault_category?: FaultCategory;
  activity_id?: string;
  severity: FaultSeverity;
  status: FaultStatus;
  detected_at: string;
  detected_by?: string;
  detection_method?: string;
  fault_location?: string;
  affected_circuit?: string;
  safety_impact?: SafetyImpact;
  downtime_minutes?: number;
  description?: string;
  symptoms?: string[];
  measurements?: Record<string, string>;
  is_recurring?: boolean;
  photo_urls?: string[];
  reminder_sent?: boolean;
  // NEW: joined profile for feed display
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title'>;
  created_at?: string;
  updated_at?: string;
}

export type FaultSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FaultStatus   = 'open' | 'under_investigation' | 'resolved' | 'recurring';
export type SafetyImpact  = 'none' | 'minor' | 'moderate' | 'severe';

// ── Resolution ───────────────────────────────────────────────
export interface Resolution {
  id: string;
  user_id: string;
  fault_id: string;
  fault?: Fault;
  title: string;
  outcome: ResolutionOutcome;
  root_cause?: string;
  root_cause_category?: string;
  actions_taken?: string;
  test_results?: string;
  recommendations?: string;
  resolved_at: string;
  duration_minutes?: number;
  resolved_by?: string;
  verified_by?: string;
  colleagues?: string[];
  tools_used?: string[];
  parts_replaced?: PartItem[];
  signature_url?: string;
  photo_urls?: string[];
  created_at?: string;
}

export type ResolutionOutcome = 'resolved' | 'partial' | 'deferred' | 'not_found';

// ── Shift Log ─────────────────────────────────────────────────
// NEW: Shift handover log — engineers log events at end of shift
export interface ShiftLog {
  id: string;
  user_id: string;
  org_id: string;
  shift_type: ShiftType;
  shift_date: string;           // YYYY-MM-DD
  summary?: string;             // Overall shift summary
  events?: ShiftEvent[];        // List of events during the shift
  open_issues?: string[];       // Unresolved items for next shift
  handover_notes?: string;      // Direct message to next shift
  logged_by_name?: string;      // Engineer's name (denormalized)
  // joined profile
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title'>;
  created_at?: string;
  updated_at?: string;
}

export type ShiftType = 'day' | 'night' | 'afternoon';

export interface ShiftEvent {
  time: string;                 // e.g. "14:23"
  description: string;          // e.g. "Motor M17 tripped — overload"
  equipment_tag?: string;       // e.g. "M-017"
}

// ── Maintenance Task ──────────────────────────────────────────
// NEW: Tasks assigned between engineers
export interface Task {
  id: string;
  org_id: string;
  created_by: string;
  assigned_to?: string;
  equipment_id?: string;
  equipment?: Pick<Equipment, 'id' | 'tag_id' | 'name'>;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  completed_at?: string;
  assigned_to_name?: string;
  // joined profiles
  creator_profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  assignee_profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  created_at?: string;
  updated_at?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus   = 'open' | 'in_progress' | 'completed' | 'cancelled';

// ── Shared sub-types ─────────────────────────────────────────
export interface PartItem {
  name: string;
  qty?: string;
  part_no?: string;
}

// ── Dashboard stats ───────────────────────────────────────────
export interface Stats {
  equipment: {
    total: number;
    operational: number;
    faulty: number;
    maintenance: number;
    decommissioned: number;
  };
  faults: {
    total: number;
    open: number;
    under_investigation: number;
    resolved: number;
    recurring: number;
    critical: number;
    total_downtime: number;
    resolutions: number;
  };
  activities: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
}

// ── Feed item ─────────────────────────────────────────────────
// NEW: Unified feed item (fault or activity from any org member)
export interface FeedItem {
  id: string;
  type: 'fault' | 'activity' | 'shift_log';
  created_at: string;
  user_id: string;
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'title'>;
  fault?: Fault;
  activity?: Activity;
  shift_log?: ShiftLog;
}

// ── AI response types ─────────────────────────────────────────
export interface AIFaultAnalysis {
  ok: boolean;
  error?: string;
  summary?: string;
  confidence?: 'high' | 'medium' | 'low';
  probable_causes?: Array<{
    cause: string;
    likelihood: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  recommended_actions?: Array<{
    step: number;
    action: string;
    detail: string;
    tools?: string;
  }>;
  safety_warnings?: string[];
  parts_needed?: string[];
  prevention_tip?: string;
}

export interface AIAssistantResult {
  ok: boolean;
  error?: string;
  summary?: string;
  key_points?: string[];
  safety_note?: string;
  next_step?: string;
}
