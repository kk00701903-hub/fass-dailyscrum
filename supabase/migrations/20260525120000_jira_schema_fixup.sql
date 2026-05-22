-- 현재 Supabase(단순 jira_sprints) → 앱 전체 기능용 스키마 보완
-- SQL Editor에서 이 파일 전체를 한 번 실행하세요.

-- ─── 1) jira_sprints: WBS From/To · 태스크 조인 키 ─────────────────────────
alter table public.jira_sprints
  add column if not exists jira_sprint_id text,
  add column if not exists start_date date,
  add column if not exists end_date date;

create unique index if not exists jira_sprints_jira_sprint_id_key
  on public.jira_sprints (jira_sprint_id)
  where jira_sprint_id is not null;

-- 동기화 시 전체 교체(delete) 허용
drop policy if exists "jira_sprints_delete_anon" on public.jira_sprints;
create policy "jira_sprints_delete_anon" on public.jira_sprints
  for delete to anon, authenticated using (true);

-- ─── 2) jira_tasks: 이슈·담당자·일정·서브태스크 ───────────────────────────
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

-- ─── 3) jira_dependencies: 의존성 맵 + JIRA issuelink ───────────────────────
create table if not exists public.jira_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('sprint', 'task')),
  source_ref text not null,
  target_kind text not null check (target_kind in ('sprint', 'task')),
  target_ref text not null,
  relation text not null default 'depends_on'
    check (relation in ('depends_on', 'blocks', 'relates_to')),
  note text not null default '',
  source text not null default 'manual',
  jira_link_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jira_dependencies_no_self check (
    not (source_kind = target_kind and source_ref = target_ref)
  )
);

alter table public.jira_dependencies
  add column if not exists source text not null default 'manual';

alter table public.jira_dependencies
  add column if not exists jira_link_id text;

create unique index if not exists jira_dependencies_edge_key
  on public.jira_dependencies (source_kind, source_ref, target_kind, target_ref, relation);

create unique index if not exists jira_dependencies_jira_link_id_key
  on public.jira_dependencies (jira_link_id)
  where jira_link_id is not null;

alter table public.jira_dependencies enable row level security;

drop policy if exists "jira_dependencies_select_anon" on public.jira_dependencies;
create policy "jira_dependencies_select_anon" on public.jira_dependencies
  for select to anon, authenticated using (true);

drop policy if exists "jira_dependencies_insert_anon" on public.jira_dependencies;
create policy "jira_dependencies_insert_anon" on public.jira_dependencies
  for insert to anon, authenticated with check (true);

drop policy if exists "jira_dependencies_update_anon" on public.jira_dependencies;
create policy "jira_dependencies_update_anon" on public.jira_dependencies
  for update to anon, authenticated using (true);

drop policy if exists "jira_dependencies_delete_anon" on public.jira_dependencies;
create policy "jira_dependencies_delete_anon" on public.jira_dependencies
  for delete to anon, authenticated using (true);

-- Realtime (이미 있으면 무시)
do $$
begin
  alter publication supabase_realtime add table public.jira_sprints;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.jira_tasks;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.jira_dependencies;
exception when duplicate_object then null;
end $$;

-- ─── 5) scrum_member_sprints: 담당자별 등록 스프린트 ─────────────────────────
create table if not exists public.scrum_member_sprints (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  sprint_id text not null,
  sprint_name text not null default '',
  created_at timestamptz not null default now(),
  unique (member_id, sprint_id)
);

create index if not exists scrum_member_sprints_member_idx
  on public.scrum_member_sprints (member_id);

alter table public.scrum_member_sprints enable row level security;

drop policy if exists "scrum_member_sprints_select_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_select_anon" on public.scrum_member_sprints
  for select to anon, authenticated using (true);

drop policy if exists "scrum_member_sprints_insert_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_insert_anon" on public.scrum_member_sprints
  for insert to anon, authenticated with check (true);

drop policy if exists "scrum_member_sprints_update_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_update_anon" on public.scrum_member_sprints
  for update to anon, authenticated using (true);

drop policy if exists "scrum_member_sprints_delete_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_delete_anon" on public.scrum_member_sprints
  for delete to anon, authenticated using (true);

-- ─── 앱 로그인 (app_users + register/login RPC) ───────────────────────────────
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  password_hash text not null,
  member_id text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  constraint app_users_login_id_key unique (login_id)
);

create index if not exists app_users_member_id_idx on public.app_users (member_id);

alter table public.app_users enable row level security;

drop policy if exists "app_users_no_anon_select" on public.app_users;
create policy "app_users_no_anon_select" on public.app_users
  for select to anon, authenticated using (false);

create or replace function public.register_app_user(
  p_login_id text,
  p_password text,
  p_member_id text,
  p_display_name text default ''
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(p_login_id));
  u public.app_users%rowtype;
begin
  if v_login = '' then
    raise exception '아이디를 입력하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if exists (select 1 from public.app_users where login_id = v_login) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.app_users (login_id, password_hash, member_id, display_name)
  values (
    v_login,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    trim(p_member_id),
    coalesce(nullif(trim(p_display_name), ''), trim(p_member_id))
  )
  returning * into u;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.login_app_user(p_login_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
  v_login text := lower(trim(p_login_id));
begin
  if v_login = '' then
    raise exception '아이디를 입력하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;

  select * into u from public.app_users where login_id = v_login;
  if not found then
    raise exception '등록된 아이디가 없습니다. 회원가입 또는 아이디 찾기를 이용하세요.';
  end if;
  if u.password_hash <> extensions.crypt(p_password, u.password_hash) then
    raise exception '비밀번호가 올바르지 않습니다.';
  end if;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.find_app_login_id(p_member_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
begin
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;

  select * into u
  from public.app_users
  where member_id = trim(p_member_id)
    and password_hash = extensions.crypt(p_password, password_hash)
  limit 1;

  if not found then
    raise exception '담당자와 비밀번호가 일치하는 계정이 없습니다.';
  end if;

  return json_build_object(
    'login_id', u.login_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.reset_app_user_password(
  p_login_id text,
  p_member_id text,
  p_new_password text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(p_login_id));
  u public.app_users%rowtype;
begin
  if v_login = '' then
    raise exception '아이디를 입력하세요.';
  end if;
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if p_new_password is null or p_new_password = '' then
    raise exception '새 비밀번호를 입력하세요.';
  end if;

  select * into u
  from public.app_users
  where login_id = v_login and member_id = trim(p_member_id);

  if not found then
    raise exception '아이디와 담당자가 일치하는 계정이 없습니다.';
  end if;

  update public.app_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  where id = u.id
  returning * into u;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

grant execute on function public.register_app_user(text, text, text, text) to anon, authenticated;
grant execute on function public.login_app_user(text, text) to anon, authenticated;
grant execute on function public.find_app_login_id(text, text) to anon, authenticated;
grant execute on function public.reset_app_user_password(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
