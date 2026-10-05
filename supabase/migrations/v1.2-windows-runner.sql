-- TestPilot AI V1.2 - Windows Forms Runner MVP
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
