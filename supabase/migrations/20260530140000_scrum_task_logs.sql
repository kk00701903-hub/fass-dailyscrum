-- 태스크(이슈 키)별 전일 성과·오늘 계획 (데일리 스크럼 멀티 입력)
create table if not exists public.scrum_task_logs (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  sprint_id text not null,
  member_id text not null,
  issue_key text not null,
  jira_issue_id text,
  yesterday text not null default '',
  today text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_date, sprint_id, member_id, issue_key)
);

create index if not exists scrum_task_logs_member_date_idx
  on public.scrum_task_logs (member_id, entry_date);

alter table public.scrum_task_logs enable row level security;

drop policy if exists "scrum_task_logs_select_anon" on public.scrum_task_logs;
create policy "scrum_task_logs_select_anon" on public.scrum_task_logs
  for select to anon, authenticated using (true);

drop policy if exists "scrum_task_logs_insert_anon" on public.scrum_task_logs;
create policy "scrum_task_logs_insert_anon" on public.scrum_task_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "scrum_task_logs_update_anon" on public.scrum_task_logs;
create policy "scrum_task_logs_update_anon" on public.scrum_task_logs
  for update to anon, authenticated using (true);

drop policy if exists "scrum_task_logs_delete_anon" on public.scrum_task_logs;
create policy "scrum_task_logs_delete_anon" on public.scrum_task_logs
  for delete to anon, authenticated using (true);
