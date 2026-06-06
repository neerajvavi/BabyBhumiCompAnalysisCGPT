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
