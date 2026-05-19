-- jira_tasks: 이슈·서브태스크 캐시 (테이블 없을 때 생성 + 날짜·담당자·계층 컬럼)
-- Supabase SQL Editor: 이 파일 전체를 붙여넣어 Run

create table if not exists public.jira_tasks (
  id text primary key,
  issue_key text not null,
  sprint_id text not null default '',
  summary text not null default '',
  status text not null default 'TODO',
  priority text not null default 'MEDIUM',
  assignee_id text not null default 'jira-unassigned',
  assignee_name text not null default '미배정',
  assignee_role text not null default '—',
  assignee_color text not null default '#64748b',
  story_points numeric not null default 0,
  updated_at timestamptz not null default now(),
  labels jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  -- 확장 컬럼 (날짜·담당자·서브태스크)
  assignee_account_id text,
  assignee_email text,
  due_date date,
  start_date date,
  created_at timestamptz,
  resolved_at timestamptz,
  issue_type text not null default '',
  parent_issue_key text,
  parent_id text,
  is_subtask boolean not null default false,
  jira_status_name text not null default ''
);

-- 기존에 테이블만 있고 컬럼이 없는 경우 (재실행 안전)
alter table public.jira_tasks
  add column if not exists assignee_account_id text,
  add column if not exists assignee_email text,
  add column if not exists due_date date,
  add column if not exists start_date date,
  add column if not exists created_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists issue_type text not null default '',
  add column if not exists parent_issue_key text,
  add column if not exists parent_id text,
  add column if not exists is_subtask boolean not null default false,
  add column if not exists jira_status_name text not null default '';

create unique index if not exists jira_tasks_issue_key_key on public.jira_tasks (issue_key);
create index if not exists jira_tasks_sprint_id_idx on public.jira_tasks (sprint_id);
create index if not exists jira_tasks_assignee_id_idx on public.jira_tasks (assignee_id);
create index if not exists jira_tasks_parent_issue_key_idx on public.jira_tasks (parent_issue_key);
create index if not exists jira_tasks_is_subtask_idx on public.jira_tasks (is_subtask);

-- 자기 참조 FK (테이블 생성 후)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jira_tasks_parent_id_fkey'
  ) then
    alter table public.jira_tasks
      add constraint jira_tasks_parent_id_fkey
      foreign key (parent_id) references public.jira_tasks (id) on delete set null;
  end if;
exception
  when others then null;
end $$;

alter table public.jira_tasks enable row level security;

drop policy if exists "jira_tasks_select_anon" on public.jira_tasks;
create policy "jira_tasks_select_anon" on public.jira_tasks
  for select to anon, authenticated using (true);

drop policy if exists "jira_tasks_insert_anon" on public.jira_tasks;
create policy "jira_tasks_insert_anon" on public.jira_tasks
  for insert to anon, authenticated with check (true);

drop policy if exists "jira_tasks_update_anon" on public.jira_tasks;
create policy "jira_tasks_update_anon" on public.jira_tasks
  for update to anon, authenticated using (true);

drop policy if exists "jira_tasks_delete_anon" on public.jira_tasks;
create policy "jira_tasks_delete_anon" on public.jira_tasks
  for delete to anon, authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.jira_tasks;
exception
  when duplicate_object then null;
end $$;
