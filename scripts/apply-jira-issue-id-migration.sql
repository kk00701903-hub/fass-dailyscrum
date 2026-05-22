-- Supabase Dashboard → SQL Editor → Run once
-- Fixes: column jira_tasks.jira_issue_id does not exist

-- Step 1: add column + backfill
alter table public.jira_tasks
  add column if not exists jira_issue_id text;

update public.jira_tasks
set jira_issue_id = coalesce(jira_issue_id, id)
where jira_issue_id is null and id is not null;

update public.jira_tasks
set id = jira_issue_id
where id is distinct from jira_issue_id and jira_issue_id is not null;

alter table public.jira_tasks
  alter column jira_issue_id set not null;

-- Step 2: master key = jira_issue_id (issue_key is mutable)
drop index if exists public.jira_tasks_issue_key_key;

create unique index if not exists jira_tasks_jira_issue_id_key
  on public.jira_tasks (jira_issue_id);

create index if not exists jira_tasks_issue_key_idx
  on public.jira_tasks (issue_key);

notify pgrst, 'reload schema';
