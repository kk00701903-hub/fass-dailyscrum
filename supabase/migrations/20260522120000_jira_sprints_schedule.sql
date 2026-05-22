-- jira_sprints: JIRA 스프린트 ID·일정 (태스크 sprint_id 와 조인)

alter table public.jira_sprints
  add column if not exists jira_sprint_id text,
  add column if not exists start_date date,
  add column if not exists end_date date;

create unique index if not exists jira_sprints_jira_sprint_id_key
  on public.jira_sprints (jira_sprint_id)
  where jira_sprint_id is not null;

-- PostgREST 스키마 캐시 갱신 (동기화 직후 반영)
notify pgrst, 'reload schema';
