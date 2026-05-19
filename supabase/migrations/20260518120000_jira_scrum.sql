-- JIRA 스프린트·이슈 캐시 + 데일리 스크럼 저장

create table if not exists public.jira_sprints (
  id text primary key,
  jira_sprint_id text not null unique,
  name text not null,
  state text not null check (state in ('active', 'closed', 'future')),
  start_date text not null default '—',
  end_date text not null default '—',
  goal text not null default '',
  board_id text,
  synced_at timestamptz not null default now()
);

create table if not exists public.jira_tasks (
  id text primary key,
  issue_key text not null unique,
  sprint_id text not null references public.jira_sprints (id) on delete cascade,
  summary text not null default '',
  status text not null,
  priority text not null,
  assignee_id text not null default 'jira-unassigned',
  assignee_name text not null default '미배정',
  assignee_role text not null default '—',
  assignee_color text not null default '#64748b',
  story_points numeric not null default 0,
  updated_at timestamptz not null default now(),
  labels jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists jira_tasks_sprint_id_idx on public.jira_tasks (sprint_id);
create index if not exists jira_tasks_assignee_id_idx on public.jira_tasks (assignee_id);

create table if not exists public.scrum_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  sprint_id text not null,
  member_id text not null,
  yesterday text not null default '',
  today text not null default '',
  blockers text not null default '없음',
  selected_tasks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_date, sprint_id, member_id)
);

create index if not exists scrum_entries_member_date_idx on public.scrum_entries (member_id, entry_date desc);

create table if not exists public.jira_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  sprints_count int not null default 0,
  tasks_count int not null default 0,
  error_message text
);

alter table public.jira_sprints enable row level security;
alter table public.jira_tasks enable row level security;
alter table public.scrum_entries enable row level security;
alter table public.jira_sync_runs enable row level security;

-- 내부 팀 도구: anon 키로 읽기·스크럼 작성 (Edge Function은 service_role로 JIRA 동기화)
create policy "jira_sprints_select_anon" on public.jira_sprints for select to anon, authenticated using (true);
create policy "jira_tasks_select_anon" on public.jira_tasks for select to anon, authenticated using (true);
create policy "scrum_entries_select_anon" on public.scrum_entries for select to anon, authenticated using (true);
create policy "scrum_entries_insert_anon" on public.scrum_entries for insert to anon, authenticated with check (true);
create policy "scrum_entries_update_anon" on public.scrum_entries for update to anon, authenticated using (true);
create policy "jira_sync_runs_select_anon" on public.jira_sync_runs for select to anon, authenticated using (true);

create or replace function public.set_scrum_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scrum_entries_updated_at on public.scrum_entries;
create trigger scrum_entries_updated_at
  before update on public.scrum_entries
  for each row execute function public.set_scrum_entry_updated_at();
