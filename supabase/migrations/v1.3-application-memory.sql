-- ============================================================
-- TestPilot AI V1.3 - Application Memory & UI Map
-- Safe to run after V1.2 migration.
-- Metadata lives in Postgres. Heavy screenshots/evidence remain
-- in Supabase Storage and are referenced by URL only.
-- ============================================================

create table if not exists application_memory_settings(
  project_id uuid primary key references projects(id) on delete cascade,
  promote_after_seen int not null default 2 check(promote_after_seen between 1 and 20),
  max_versions int not null default 5 check(max_versions between 1 and 50),
  stale_after_days int not null default 180 check(stale_after_days between 7 and 3650),
  pass_evidence_retention_days int not null default 30,
  fail_evidence_retention_days int not null default 180,
  blocked_evidence_retention_days int not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists application_screens(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  platform text not null check(platform in ('web','windows')),
  semantic_key text not null,
  name text not null,
  location_hint text,
  current_fingerprint text not null,
  current_version int not null default 1,
  canonical_screenshot_url text,
  status text not null default 'CANDIDATE' check(status in ('CANDIDATE','ACTIVE','STALE','ARCHIVED')),
  confidence numeric(5,4) not null default 0.70,
  seen_count bigint not null default 1,
  successful_use_count bigint not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_application_screen_scope
  on application_screens(project_id, coalesce(environment_id, '00000000-0000-0000-0000-000000000000'::uuid), platform, semantic_key);
create index if not exists idx_application_screens_project on application_screens(project_id, platform, last_seen_at desc);
create index if not exists idx_application_screens_fingerprint on application_screens(current_fingerprint);

create table if not exists screen_versions(
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references application_screens(id) on delete cascade,
  version int not null,
  fingerprint text not null,
  screenshot_url text,
  useful_element_count int not null default 0,
  change_summary text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count bigint not null default 1,
  unique(screen_id, version),
  unique(screen_id, fingerprint)
);
create index if not exists idx_screen_versions_screen on screen_versions(screen_id, version desc);

create table if not exists ui_elements(
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references application_screens(id) on delete cascade,
  semantic_key text not null,
  automation_id text,
  name text,
  role text,
  control_type text,
  class_name text,
  selector text,
  placeholder text,
  input_type text,
  is_interactive boolean not null default true,
  confidence numeric(5,4) not null default 0.80,
  seen_count bigint not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(screen_id, semantic_key)
);
create index if not exists idx_ui_elements_screen on ui_elements(screen_id, last_seen_at desc);
create index if not exists idx_ui_elements_automation_id on ui_elements(automation_id) where automation_id is not null;

create table if not exists navigation_edges(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  platform text not null check(platform in ('web','windows')),
  from_screen_id uuid not null references application_screens(id) on delete cascade,
  to_screen_id uuid not null references application_screens(id) on delete cascade,
  action_signature text not null,
  action_type text,
  target jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null default 0.75,
  success_count bigint not null default 1,
  failure_count bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_navigation_edge
  on navigation_edges(project_id, coalesce(environment_id, '00000000-0000-0000-0000-000000000000'::uuid), platform, from_screen_id, to_screen_id, action_signature);
create index if not exists idx_navigation_from on navigation_edges(from_screen_id, success_count desc);
create index if not exists idx_navigation_to on navigation_edges(to_screen_id, success_count desc);

alter table execution_steps add column if not exists memory_screen_id uuid references application_screens(id) on delete set null;
alter table execution_steps add column if not exists memory_fingerprint text;

-- Do not store binary screenshots or videos in these tables.
-- Existing test-evidence storage objects may be reused as canonical/version screenshots.
