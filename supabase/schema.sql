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
