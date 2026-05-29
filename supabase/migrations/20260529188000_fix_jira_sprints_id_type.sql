-- jira_sprints.id: uuid → text 변경
-- jira-sync Edge Function 이 생성하는 id "jira-sprint-173" 형식이 uuid 타입과 불일치 → upsert 실패
-- jira_sprints 는 현재 0건이므로 타입 변경이 안전함

-- 기존 PK 제약 제거 후 타입 변경
alter table public.jira_sprints drop constraint if exists jira_sprints_pkey;

alter table public.jira_sprints
  alter column id drop default,
  alter column id type text using id::text;

-- PK 재설정
alter table public.jira_sprints add primary key (id);

-- sync function 이 사용하는 나머지 컬럼 보강 (이미 존재하면 무시)
alter table public.jira_sprints
  add column if not exists jira_sprint_id text,
  add column if not exists name          text not null default '',
  add column if not exists state         text not null default '',
  add column if not exists goal          text not null default '',
  add column if not exists board_id      text,
  add column if not exists synced_at     timestamptz not null default now();

-- 기존 sprint_name/status 컬럼이 있으면 name/state 에 반영
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jira_sprints' and column_name = 'sprint_name'
  ) then
    update public.jira_sprints set name = sprint_name where name = '' and sprint_name is not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jira_sprints' and column_name = 'status'
  ) then
    update public.jira_sprints set state = status where state = '' and status is not null;
  end if;
end $$;

-- RLS 정책 재설정
alter table public.jira_sprints enable row level security;

drop policy if exists "jira_sprints_select_anon"  on public.jira_sprints;
drop policy if exists "jira_sprints_insert_anon"  on public.jira_sprints;
drop policy if exists "jira_sprints_update_anon"  on public.jira_sprints;
drop policy if exists "jira_sprints_delete_anon"  on public.jira_sprints;

create policy "jira_sprints_select_anon" on public.jira_sprints for select to anon, authenticated using (true);
create policy "jira_sprints_insert_anon" on public.jira_sprints for insert to anon, authenticated with check (true);
create policy "jira_sprints_update_anon" on public.jira_sprints for update to anon, authenticated using (true);
create policy "jira_sprints_delete_anon" on public.jira_sprints for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.jira_sprints to anon, authenticated;

notify pgrst, 'reload schema';
