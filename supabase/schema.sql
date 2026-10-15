create extension if not exists pgcrypto;

create table if not exists projects(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists environments(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  platform text not null check(platform in ('web','windows')),
  base_url text,
  app_path text,
  created_at timestamptz not null default now()
);

create table if not exists user_stories(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  story text not null,
  created_at timestamptz not null default now()
);

create table if not exists acceptance_criteria(
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references user_stories(id) on delete cascade,
  position int not null,
  text text not null
);

create table if not exists test_cases(
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references user_stories(id) on delete cascade,
  source_type text not null,
  ac_ref text,
  title text not null,
  preconditions jsonb not null default '[]'::jsonb,
  expected jsonb not null default '{}'::jsonb,
  test_data jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists test_runs(
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  status text not null default 'QUEUED',
  runtime_context jsonb not null default '{}'::jsonb,
  browser_session_id text,
  replay_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists execution_steps(
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references test_runs(id) on delete cascade,
  step_no int not null,
  intent text,
  action_type text,
  target jsonb,
  input jsonb,
  expected jsonb,
  actual jsonb,
  captured_output jsonb,
  result text,
  before_asset_url text,
  after_asset_url text,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists test_reviews(
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references test_runs(id) on delete cascade,
  verdict text not null check(verdict in ('APPROVED','NEEDS_CHANGE','INVALID_TEST')),
  reason text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_env_project on environments(project_id);
create index if not exists idx_story_project on user_stories(project_id);
create index if not exists idx_ac_story on acceptance_criteria(story_id);
create index if not exists idx_cases_story on test_cases(story_id);
create index if not exists idx_runs_project on test_runs(project_id);
create index if not exists idx_steps_run on execution_steps(run_id, step_no);

-- Evidence bucket. Public is acceptable for MVP screenshots containing non-sensitive UAT data.
-- For sensitive environments switch to a private bucket + signed URLs in V1.2.
insert into storage.buckets (id, name, public)
values ('test-evidence', 'test-evidence', true)
on conflict (id) do update set public = excluded.public;

-- The server uses SUPABASE_SERVICE_ROLE_KEY. No browser-side writes are required in V1.1.

-- ============================================================
-- TestPilot AI V1.2 - Windows Forms Runner MVP migration
-- Safe to run after the V1.1.1 schema.
-- ============================================================

alter table test_runs add column if not exists platform text not null default 'web';
alter table test_runs add column if not exists runner_id uuid;

create table if not exists runner_agents(
  id uuid primary key,
  name text not null,
  machine_name text not null,
  platform text not null default 'windows',
  version text not null,
  status text not null default 'OFFLINE',
  capabilities jsonb not null default '{}'::jsonb,
  current_job_id uuid,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists runner_jobs(
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references test_runs(id) on delete cascade,
  platform text not null check(platform in ('web','windows')),
  status text not null default 'QUEUED',
  assigned_runner_id uuid references runner_agents(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create table if not exists runner_job_events(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references runner_jobs(id) on delete cascade,
  runner_id uuid references runner_agents(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_runner_agents_heartbeat on runner_agents(last_heartbeat_at desc);
create index if not exists idx_runner_jobs_status on runner_jobs(platform, status, created_at);
create index if not exists idx_runner_jobs_run on runner_jobs(run_id);
create index if not exists idx_runner_events_job on runner_job_events(job_id, created_at);

-- V1.2 still uses server-side service-role access. Runner traffic is authenticated
-- by RUNNER_SHARED_SECRET at the Next.js API boundary and never talks to Supabase directly.
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
