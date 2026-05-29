-- jira_sprints: sync function 이 사용하는 컬럼 추가 (누락된 board_id, name, state, goal, synced_at)
-- jira-sync Edge Function 은 이 컬럼들로 upsert 하므로 없으면 400 오류 후 스프린트 미저장

alter table public.jira_sprints
  add column if not exists name          text,
  add column if not exists state         text,
  add column if not exists goal          text not null default '',
  add column if not exists board_id      text,
  add column if not exists synced_at     timestamptz not null default now();

-- sprint_name(기존) → name 동기화 (없으면 name 값을 sprint_name 으로, 있으면 name 도 함께 유지)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jira_sprints' and column_name = 'sprint_name'
  ) then
    -- sprint_name 이 있고 name 이 null 이면 sprint_name 값 복사
    update public.jira_sprints
    set name = sprint_name
    where name is null and sprint_name is not null;
  end if;
end $$;

-- state 컬럼: status 가 있으면 그 값을 state 로 복사
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jira_sprints' and column_name = 'status'
  ) then
    update public.jira_sprints
    set state = status
    where state is null and status is not null;
  end if;
end $$;

-- RLS INSERT/UPDATE 정책 보강 (anon·authenticated 모두 허용)
drop policy if exists "jira_sprints_insert_anon" on public.jira_sprints;
create policy "jira_sprints_insert_anon" on public.jira_sprints
  for insert to anon, authenticated with check (true);

drop policy if exists "jira_sprints_update_anon" on public.jira_sprints;
create policy "jira_sprints_update_anon" on public.jira_sprints
  for update to anon, authenticated using (true);

grant select, insert, update, delete on public.jira_sprints to anon, authenticated;

notify pgrst, 'reload schema';
