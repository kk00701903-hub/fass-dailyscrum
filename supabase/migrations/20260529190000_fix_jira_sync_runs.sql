-- jira_sync_runs 테이블 생성 (20260518120000_jira_scrum.sql 에서 누락됨)
create table if not exists public.jira_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  sprints_count int not null default 0,
  tasks_count int not null default 0,
  error_message text
);

alter table public.jira_sync_runs enable row level security;

drop policy if exists "jira_sync_runs_select_anon" on public.jira_sync_runs;
create policy "jira_sync_runs_select_anon" on public.jira_sync_runs
  for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
