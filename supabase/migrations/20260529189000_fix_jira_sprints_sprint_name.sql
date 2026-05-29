-- jira_sprints.sprint_name: NOT NULL → default '' 완화
-- sync function 은 name 컬럼을 제공하고 sprint_name 은 미제공 → NOT NULL 위반 방지

alter table public.jira_sprints
  alter column sprint_name set default '';

-- 기존 null 값 처리 (혹시 있으면)
update public.jira_sprints set sprint_name = coalesce(sprint_name, name, '') where sprint_name is null;

-- status 도 동일하게 기본값 설정 (sync function 은 state 컬럼 사용)
alter table public.jira_sprints
  alter column status set default '';

notify pgrst, 'reload schema';
