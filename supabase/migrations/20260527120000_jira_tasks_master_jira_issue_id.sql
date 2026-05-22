-- jira_issue_id = JIRA REST issue.id (마스터 키)
-- issue_key 는 가변 — 유니크 제약 제거 (번호 변경·재사용 시 고스트/충돌 방지)

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

-- 레거시: issue_key 단독 유니크 → 삭제 (upsert는 jira_issue_id 만 사용)
drop index if exists public.jira_tasks_issue_key_key;

create unique index if not exists jira_tasks_jira_issue_id_key
  on public.jira_tasks (jira_issue_id);

create index if not exists jira_tasks_issue_key_idx
  on public.jira_tasks (issue_key);

comment on column public.jira_tasks.jira_issue_id is 'JIRA REST issue.id — upsert onConflict, 불변 마스터 키';
comment on column public.jira_tasks.id is 'PK = jira_issue_id (parent_id FK)';
comment on column public.jira_tasks.issue_key is '가변 FWK-xxx — 동기화 시 항상 JIRA 최신값으로 덮어씀';
