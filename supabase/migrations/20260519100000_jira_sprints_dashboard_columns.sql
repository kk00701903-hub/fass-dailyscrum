-- JiraSyncDashboard용 컬럼 (기존 jira_sprints 테이블에 추가)

alter table public.jira_sprints
  add column if not exists sprint_name text,
  add column if not exists status text,
  add column if not exists remaining_days int4 default 0;

-- 기존 name/state 컬럼이 있으면 백필
update public.jira_sprints
set sprint_name = coalesce(sprint_name, name),
    status = coalesce(status, state)
where sprint_name is null or status is null;

create unique index if not exists jira_sprints_sprint_name_uidx
  on public.jira_sprints (sprint_name)
  where sprint_name is not null;

-- Realtime 목록 갱신 (이미 추가된 경우 무시)
do $$
begin
  alter publication supabase_realtime add table public.jira_sprints;
exception
  when duplicate_object then null;
end $$;
