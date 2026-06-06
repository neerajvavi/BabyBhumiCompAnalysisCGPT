create table if not exists public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  competitor_name text not null,
  domain text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'needs_review', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.research_jobs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  source_type text not null,
  url text not null,
  title text,
  raw_text text,
  snippets jsonb not null default '[]'::jsonb,
  normalized jsonb not null default '{}'::jsonb,
  status text not null default 'captured' check (status in ('queued', 'captured', 'analyzed', 'failed')),
  captured_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.research_jobs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  insight_type text not null,
  title text not null,
  summary text not null,
  citations jsonb not null default '[]'::jsonb,
  confidence integer not null default 50 check (confidence between 0 and 100),
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists research_jobs_touch_updated_at on public.research_jobs;
create trigger research_jobs_touch_updated_at
before update on public.research_jobs
for each row execute function public.touch_updated_at();

alter table public.research_jobs enable row level security;
alter table public.research_sources enable row level security;
alter table public.ai_insights enable row level security;

drop policy if exists "Team members can read research jobs" on public.research_jobs;
create policy "Team members can read research jobs"
on public.research_jobs for select
using (public.is_team_member(research_jobs.team_id));

drop policy if exists "Team members can create research jobs" on public.research_jobs;
create policy "Team members can create research jobs"
on public.research_jobs for insert
with check (public.is_team_member(research_jobs.team_id));

drop policy if exists "Team members can update research jobs" on public.research_jobs;
create policy "Team members can update research jobs"
on public.research_jobs for update
using (public.is_team_member(research_jobs.team_id))
with check (public.is_team_member(research_jobs.team_id));

drop policy if exists "Team members can read research sources" on public.research_sources;
create policy "Team members can read research sources"
on public.research_sources for select
using (public.is_team_member(research_sources.team_id));

drop policy if exists "Team members can create research sources" on public.research_sources;
create policy "Team members can create research sources"
on public.research_sources for insert
with check (public.is_team_member(research_sources.team_id));

drop policy if exists "Team members can update research sources" on public.research_sources;
create policy "Team members can update research sources"
on public.research_sources for update
using (public.is_team_member(research_sources.team_id))
with check (public.is_team_member(research_sources.team_id));

drop policy if exists "Team members can read ai insights" on public.ai_insights;
create policy "Team members can read ai insights"
on public.ai_insights for select
using (public.is_team_member(ai_insights.team_id));

drop policy if exists "Team members can create ai insights" on public.ai_insights;
create policy "Team members can create ai insights"
on public.ai_insights for insert
with check (public.is_team_member(ai_insights.team_id));

drop policy if exists "Team members can update ai insights" on public.ai_insights;
create policy "Team members can update ai insights"
on public.ai_insights for update
using (public.is_team_member(ai_insights.team_id))
with check (public.is_team_member(ai_insights.team_id));
