// lib/utils.ts — Shared utility functions used across the app

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns';

// ── Tailwind class merging ────────────────────────────────────
// Merges Tailwind classes safely — handles conflicting classes
// e.g. cn('text-red-500', 'text-blue-500') → 'text-blue-500'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date formatting ───────────────────────────────────────────

// Format ISO date as "15 Jan 2024"
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'd MMM yyyy'); }
  catch { return iso.slice(0, 10); }
}

// Format ISO datetime as "15 Jan · 14:30"
export function fmtDatetime(iso?: string | null): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'd MMM · HH:mm'); }
  catch { return iso.slice(0, 16).replace('T', ' '); }
}

// Format minutes as "2h 30m" or "45m" or "—"
export function fmtDuration(mins?: number | null): string {
  if (mins == null || isNaN(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Relative date: "Today", "Yesterday", "Tomorrow", "3d ago", "In 5d"
export function fmtRelative(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso.slice(0, 10)); // use date part only
    if (isToday(d))     return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isTomorrow(d))  return 'Tomorrow';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch { return ''; }
}

// Convert ISO string to HTML datetime-local input format "YYYY-MM-DDTHH:MM"
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 16); }
  catch { return ''; }
}

// ── Severity colours ──────────────────────────────────────────
// Returns Tailwind CSS classes for fault severity badges

export function severityBg(severity: string): string {
  return {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    high:     'bg-amber/15 text-amber border-amber/30',
    medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    low:      'bg-green/15 text-green border-green/30',
  }[severity] || 'bg-white/10 text-text-2 border-white/10';
}

// Returns Tailwind CSS classes for status chips
export function statusBg(status: string): string {
  return {
    operational:       'bg-green/15 text-green border-green/30',
    open:              'bg-red/15 text-red border-red/30',
    faulty:            'bg-red/15 text-red border-red/30',
    under_maintenance: 'bg-amber/15 text-amber border-amber/30',
    under_investigation: 'bg-blue/15 text-blue border-blue/30',
    resolved:          'bg-green/15 text-green border-green/30',
    recurring:         'bg-purple/15 text-purple border-purple/30',
    planned:           'bg-blue/15 text-blue border-blue/30',
    in_progress:       'bg-amber/15 text-amber border-amber/30',
    completed:         'bg-green/15 text-green border-green/30',
    cancelled:         'bg-white/10 text-text-2 border-white/20',
    decommissioned:    'bg-white/10 text-text-2 border-white/20',
  }[status] || 'bg-white/10 text-text-2 border-white/20';
}

// Human-readable status labels
export function statusLabel(status: string): string {
  return {
    operational:       'Operational',
    faulty:            'Faulty',
    under_maintenance: 'Maintenance',
    decommissioned:    'Decommissioned',
    open:              'Open',
    under_investigation: 'Investigating',
    resolved:          'Resolved',
    recurring:         'Recurring',
    planned:           'Planned',
    in_progress:       'In Progress',
    completed:         'Completed',
    cancelled:         'Cancelled',
  }[status] || status;
}

// Severity dot emoji
export function severityDot(severity: string): string {
  return { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[severity] || '⚪';
}

// ── File upload helpers ───────────────────────────────────────

// Convert a File object to a base64 data URL string
// Used when storing images in Supabase Storage
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file); // produces "data:image/jpeg;base64,..."
  });
}

// Upload a file (from camera or local device) to Supabase Storage
// Returns the public URL of the uploaded file
export async function uploadPhoto(
  supabase: any,
  userId: string,
  file: File,
  folder: string // e.g. 'faults', 'equipment', 'signatures'
): Promise<string> {
  // Create a unique filename: userId/folder/timestamp-originalname
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('photos') // Supabase Storage bucket named "photos"
    .upload(path, file, {
      cacheControl: '3600',  // cache for 1 hour
      upsert: false,          // don't overwrite existing files
    });

  if (error) throw error;

  // Get the public URL for the uploaded file
  const { data } = supabase.storage.from('photos').getPublicUrl(path);
  return data.publicUrl;
}
