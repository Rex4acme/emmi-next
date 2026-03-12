-- supabase/schema.sql
-- Run this in Supabase → SQL Editor to set up all tables
-- Execute the whole file at once.

-- ── Enable UUID extension ─────────────────────────────────────
-- Supabase provides gen_random_uuid() natively, but this ensures it's available
create extension if not exists "uuid-ossp";

-- ── profiles ─────────────────────────────────────────────────
-- One row per authenticated user. id = Supabase Auth user ID.
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  title           text,
  employee_id     text,
  organization    text,
  department      text,
  email           text,
  phone           text,
  avatar_url      text,
  certifications  text[],   -- array of certification strings
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── categories (equipment categories) ────────────────────────
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default '⚙',
  color      text not null default '#888888',
  created_at timestamptz default now()
);

-- ── activity_types ────────────────────────────────────────────
create table if not exists activity_types (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default '🔧',
  color      text not null default '#4a9eff',
  created_at timestamptz default now()
);

-- ── fault_categories ──────────────────────────────────────────
create table if not exists fault_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default '⚡',
  color      text not null default '#f0a500',
  created_at timestamptz default now()
);

-- ── equipment ─────────────────────────────────────────────────
create table if not exists equipment (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tag_id            text not null,          -- e.g. "TR-001"
  name              text not null,
  category_id       uuid references categories(id) on delete set null,
  status            text not null default 'operational'
                    check (status in ('operational','faulty','under_maintenance','decommissioned')),
  location          text,
  area              text,
  manufacturer      text,
  model             text,
  serial_number     text,
  voltage_rating    text,
  power_rating      text,
  installation_date date,
  warranty_expiry   date,
  notes             text,
  photo_urls        text[],
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (user_id, tag_id)  -- tag IDs must be unique per user
);

-- ── activities ────────────────────────────────────────────────
create table if not exists activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  equipment_id      uuid references equipment(id) on delete set null,
  activity_type_id  uuid references activity_types(id) on delete set null,
  status            text not null default 'planned'
                    check (status in ('planned','in_progress','completed','cancelled')),
  scheduled_date    timestamptz,
  start_time        timestamptz,
  end_time          timestamptz,
  duration_minutes  integer,
  work_order_ref    text,
  permit_ref        text,
  description       text,
  findings          text,
  actions_taken     text,
  safety_notes      text,
  recommendations   text,
  colleagues        text[],
  tools_used        text[],
  parts_replaced    jsonb,    -- array of {name, qty, part_no}
  photo_urls        text[],
  signature_url     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── faults ────────────────────────────────────────────────────
create table if not exists faults (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  fault_code          text,                -- auto-generated e.g. "FLT-TR001-001"
  title               text not null,
  equipment_id        uuid references equipment(id) on delete set null,
  fault_category_id   uuid references fault_categories(id) on delete set null,
  activity_id         uuid references activities(id) on delete set null,
  severity            text not null default 'medium'
                      check (severity in ('low','medium','high','critical')),
  status              text not null default 'open'
                      check (status in ('open','under_investigation','resolved','recurring')),
  detected_at         timestamptz not null default now(),
  detected_by         text,
  detection_method    text,
  fault_location      text,
  affected_circuit    text,
  safety_impact       text check (safety_impact in ('none','minor','moderate','severe')),
  downtime_minutes    integer default 0,
  description         text,
  symptoms            text[],
  measurements        jsonb,             -- key-value pairs e.g. {"resistance": "0.5Ω"}
  is_recurring        boolean default false,
  photo_urls          text[],
  reminder_sent       boolean default false,  -- has 7am reminder been shown?
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── resolutions ───────────────────────────────────────────────
create table if not exists resolutions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  fault_id              uuid not null references faults(id) on delete cascade,
  title                 text not null,
  outcome               text not null default 'resolved'
                        check (outcome in ('resolved','partial','deferred','not_found')),
  root_cause            text,
  root_cause_category   text,
  actions_taken         text,
  test_results          text,
  recommendations       text,
  resolved_at           timestamptz not null default now(),
  duration_minutes      integer,
  resolved_by           text,
  verified_by           text,
  colleagues            text[],
  tools_used            text[],
  parts_replaced        jsonb,
  signature_url         text,
  photo_urls            text[],
  created_at            timestamptz default now()
);

-- ── Row Level Security (RLS) ──────────────────────────────────
-- Each user can ONLY see and modify their own data.
-- This is enforced at the database level — not just in app code.

alter table profiles       enable row level security;
alter table categories     enable row level security;
alter table activity_types enable row level security;
alter table fault_categories enable row level security;
alter table equipment      enable row level security;
alter table activities     enable row level security;
alter table faults         enable row level security;
alter table resolutions    enable row level security;

-- Profiles: user can read/write only their own profile
create policy "profiles_own" on profiles
  for all using (auth.uid() = id);

-- All other tables: user_id must match the signed-in user
create policy "categories_own"      on categories      for all using (auth.uid() = user_id);
create policy "activity_types_own"  on activity_types  for all using (auth.uid() = user_id);
create policy "fault_categories_own" on fault_categories for all using (auth.uid() = user_id);
create policy "equipment_own"       on equipment       for all using (auth.uid() = user_id);
create policy "activities_own"      on activities      for all using (auth.uid() = user_id);
create policy "faults_own"          on faults          for all using (auth.uid() = user_id);
create policy "resolutions_own"     on resolutions     for all using (auth.uid() = user_id);

-- ── Storage bucket ────────────────────────────────────────────
-- Create a public bucket called "photos" for fault/equipment images.
-- Run this AFTER creating the bucket in Supabase → Storage.
-- Or create via dashboard: Storage → New bucket → name "photos" → Public

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Storage policy: authenticated users can upload to their own folder
create policy "photos_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policy: anyone can view photos (they're public URLs)
create policy "photos_view" on storage.objects
  for select using (bucket_id = 'photos');

-- Storage policy: users can delete their own photos
create policy "photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
