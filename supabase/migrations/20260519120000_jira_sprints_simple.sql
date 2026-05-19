-- jira_sprints (대시보드용 단순 스키마) — 이미 테이블이 있으면 sprint_name unique 만 보강

create table if not exists public.jira_sprints (
  id uuid primary key default gen_random_uuid(),
  sprint_name text not null,
  status text not null default '',
  remaining_days int4 not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jira_sprints_sprint_name_key on public.jira_sprints (sprint_name);

alter table public.jira_sprints enable row level security;

drop policy if exists "jira_sprints_select_anon" on public.jira_sprints;
create policy "jira_sprints_select_anon" on public.jira_sprints for select to anon, authenticated using (true);

drop policy if exists "jira_sprints_insert_anon" on public.jira_sprints;
create policy "jira_sprints_insert_anon" on public.jira_sprints for insert to anon, authenticated with check (true);

drop policy if exists "jira_sprints_update_anon" on public.jira_sprints;
create policy "jira_sprints_update_anon" on public.jira_sprints for update to anon, authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.jira_sprints;
exception
  when duplicate_object then null;
end $$;
