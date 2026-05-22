-- JIRA 절대 이슈 ID 기준 upsert (가변 issue_key 갱신 허용)

alter table public.jira_tasks
  add column if not exists jira_issue_id text;

update public.jira_tasks
set jira_issue_id = id
where jira_issue_id is null and id is not null;

alter table public.jira_tasks
  alter column jira_issue_id set not null;

create unique index if not exists jira_tasks_jira_issue_id_key
  on public.jira_tasks (jira_issue_id);

comment on column public.jira_tasks.jira_issue_id is 'JIRA REST issue.id — upsert conflict target';
comment on column public.jira_tasks.id is 'Same as jira_issue_id (legacy PK / parent_id FK)';
