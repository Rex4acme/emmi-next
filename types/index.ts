// types/index.ts — All TypeScript type definitions for EMMI
// These match the Supabase database table columns exactly

// ── Engineer Profile ──────────────────────────────────────────
// Stored in the 'profiles' table, one row per authenticated user
export interface Profile {
  id: string;               // Supabase auth user ID (UUID)
  full_name: string;        // e.g. "Engr. Eze Onyebuchi"
  title?: string;           // e.g. "Senior Electrical Engineer"
  employee_id?: string;     // e.g. "ENG-001"
  organization?: string;    // Company name
  department?: string;      // e.g. "Electrical Engineering"
  email?: string;
  phone?: string;
  avatar_url?: string;      // URL to photo in Supabase Storage
  certifications?: string[];// e.g. ["PMP", "COREN", "IEEE"]
  created_at?: string;
  updated_at?: string;
}

// ── Equipment Category ────────────────────────────────────────
// e.g. "Transformer", "Generator", "Switchgear"
export interface Category {
  id: string;
  user_id: string;
  name: string;             // Category name
  icon: string;             // Emoji icon e.g. "⚡"
  color?: string;           // Hex colour for UI
  created_at?: string;
}

// ── Equipment ────────────────────────────────────────────────
// A physical piece of electrical equipment being tracked
export interface Equipment {
  id: string;
  user_id: string;
  tag_id: string;           // e.g. "TR-001" — unique tag
  name: string;             // Full name e.g. "Main Power Transformer"
  category_id?: string;     // FK → categories.id
  category?: Category;      // Joined relation
  status: EquipmentStatus;
  location?: string;        // e.g. "Substation A — Bay 1"
  area?: string;            // e.g. "Zone A"
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  voltage_rating?: string;  // e.g. "11kV / 415V"
  power_rating?: string;    // e.g. "2.5 MVA"
  installation_date?: string;
  warranty_expiry?: string;
  notes?: string;
  photo_urls?: string[];    // Array of photo URLs from Supabase Storage
  created_at?: string;
  updated_at?: string;
}

// Equipment operational status values
export type EquipmentStatus =
  | 'operational'
  | 'faulty'
  | 'under_maintenance'
  | 'decommissioned';

// ── Activity Type ─────────────────────────────────────────────
// Seeded categories like "Preventive Maintenance", "Inspection" etc.
export interface ActivityType {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at?: string;
}

// ── Activity ──────────────────────────────────────────────────
// A maintenance task or inspection — planned or completed
export interface Activity {
  id: string;
  user_id: string;
  title: string;
  equipment_id?: string;
  equipment?: Equipment;    // Joined relation
  activity_type_id?: string;
  activity_type?: ActivityType; // Joined relation
  status: ActivityStatus;
  scheduled_date?: string;
  start_time?: string;      // ISO datetime when work started
  end_time?: string;        // ISO datetime when work ended
  duration_minutes?: number;
  work_order_ref?: string;  // e.g. "WO-2024-001"
  permit_ref?: string;      // Permit to Work reference
  description?: string;     // Scope of work
  findings?: string;        // Observations during work
  actions_taken?: string;   // Work actually performed
  safety_notes?: string;    // LOTO, PPE, PTW notes
  recommendations?: string;
  colleagues?: string[];    // Names of other engineers present
  tools_used?: string[];    // Equipment/instruments used
  parts_replaced?: PartItem[];
  photo_urls?: string[];    // Photos from local device or camera
  signature_url?: string;   // Sign-off photo
  created_at?: string;
  updated_at?: string;
}

export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

// ── Fault Category ────────────────────────────────────────────
// e.g. "Protection Relay", "Insulation Failure", "Overheating"
export interface FaultCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at?: string;
}

// ── Fault ─────────────────────────────────────────────────────
// A recorded equipment fault or failure
export interface Fault {
  id: string;
  user_id: string;
  fault_code?: string;       // Auto-generated e.g. "FLT-TR001-001"
  title: string;             // Short description
  equipment_id?: string;
  equipment?: Equipment;     // Joined relation
  fault_category_id?: string;
  fault_category?: FaultCategory; // Joined relation
  activity_id?: string;      // Linked maintenance activity if any
  severity: FaultSeverity;
  status: FaultStatus;
  detected_at: string;       // ISO datetime fault was first observed
  detected_by?: string;      // Name of person who detected it
  detection_method?: string; // How it was found
  fault_location?: string;   // Physical location on equipment
  affected_circuit?: string; // Circuit/feeder affected
  safety_impact?: SafetyImpact;
  downtime_minutes?: number; // Total downtime caused
  description?: string;      // Full narrative
  symptoms?: string[];       // List of observed symptoms
  measurements?: Record<string, string>; // Key-value readings
  is_recurring?: boolean;    // Has this fault occurred before?
  photo_urls?: string[];     // Photos from local device or camera
  reminder_sent?: boolean;   // Has the 7am reminder been shown?
  created_at?: string;
  updated_at?: string;
}

export type FaultSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FaultStatus   = 'open' | 'under_investigation' | 'resolved' | 'recurring';
export type SafetyImpact  = 'none' | 'minor' | 'moderate' | 'severe';

// ── Resolution ───────────────────────────────────────────────
// A logged fix/repair for a fault — one fault can have multiple resolutions
export interface Resolution {
  id: string;
  user_id: string;
  fault_id: string;          // FK → faults.id
  fault?: Fault;             // Joined relation
  title: string;             // Brief summary of what was done
  outcome: ResolutionOutcome;
  root_cause?: string;       // Root cause analysis narrative
  root_cause_category?: string; // e.g. "wear", "installation", "overload"
  actions_taken?: string;    // Detailed repair steps
  test_results?: string;     // Post-repair test readings
  recommendations?: string;  // Future prevention advice
  resolved_at: string;       // ISO datetime of resolution
  duration_minutes?: number;
  resolved_by?: string;
  verified_by?: string;
  colleagues?: string[];
  tools_used?: string[];
  parts_replaced?: PartItem[];
  signature_url?: string;    // Engineer sign-off photo
  photo_urls?: string[];
  created_at?: string;
}

export type ResolutionOutcome = 'resolved' | 'partial' | 'deferred' | 'not_found';

// ── Shared sub-types ─────────────────────────────────────────
// A replaced/used part with optional quantity and part number
export interface PartItem {
  name: string;
  qty?: string;
  part_no?: string;
}

// ── Dashboard stats ───────────────────────────────────────────
// Aggregated counts returned by lib/db.ts getStats()
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
    total_downtime: number; // minutes
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

// ── AI response types ─────────────────────────────────────────
// Shape of parsed response from /api/ai endpoint
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
