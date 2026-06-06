create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null default 'Competitor Analysis',
  market text,
  research_date date,
  analyst text,
  current_state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  data jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

drop trigger if exists research_jobs_touch_updated_at on public.research_jobs;
create trigger research_jobs_touch_updated_at
before update on public.research_jobs
for each row execute function public.touch_updated_at();

create or replace function public.create_team(team_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
begin
  insert into public.teams (name, created_by)
  values (team_name, auth.uid())
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'owner');

  insert into public.projects (team_id, name, updated_by)
  values (new_team_id, 'Competitor Analysis', auth.uid());

  return new_team_id;
end;
$$;

create or replace function public.invite_team_member(
  target_team_id uuid,
  member_email text,
  member_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if member_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  if not exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  ) then
    raise exception 'Only owners and admins can add team members';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(member_email)
  limit 1;

  if target_user_id is null then
    raise exception 'User must create an account before they can be added';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (target_team_id, target_user_id, member_role)
  on conflict (team_id, user_id) do update set role = excluded.role;
end;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.snapshots enable row level security;
alter table public.research_jobs enable row level security;
alter table public.research_sources enable row level security;
alter table public.ai_insights enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;

drop policy if exists "Team members can read teams" on public.teams;
create policy "Team members can read teams"
on public.teams for select
using (public.is_team_member(teams.id));

drop policy if exists "Authenticated users can create teams" on public.teams;
create policy "Authenticated users can create teams"
on public.teams for insert
with check (created_by = auth.uid());

drop policy if exists "Team members can read memberships" on public.team_members;
create policy "Team members can read memberships"
on public.team_members for select
using (public.is_team_member(team_members.team_id));

drop policy if exists "Owners and admins can add members" on public.team_members;
create policy "Owners and admins can add members"
on public.team_members for insert
with check (public.is_team_admin(team_members.team_id));

drop policy if exists "Team members can read projects" on public.projects;
create policy "Team members can read projects"
on public.projects for select
using (public.is_team_member(projects.team_id));

drop policy if exists "Team members can create projects" on public.projects;
create policy "Team members can create projects"
on public.projects for insert
with check (public.is_team_member(projects.team_id));

drop policy if exists "Team members can update projects" on public.projects;
create policy "Team members can update projects"
on public.projects for update
using (public.is_team_member(projects.team_id))
with check (public.is_team_member(projects.team_id));

drop policy if exists "Team members can read snapshots" on public.snapshots;
create policy "Team members can read snapshots"
on public.snapshots for select
using (public.is_team_member(snapshots.team_id));

drop policy if exists "Team members can create snapshots" on public.snapshots;
create policy "Team members can create snapshots"
on public.snapshots for insert
with check (public.is_team_member(snapshots.team_id));

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
