-- 배치 전체 갱신 시 service_role·anon delete 허용 (스프린트 rename 시 구 데이터 제거)

drop policy if exists "jira_sprints_delete_anon" on public.jira_sprints;
create policy "jira_sprints_delete_anon" on public.jira_sprints
  for delete to anon, authenticated using (true);
