-- JIRA issuelink 자동 동기화용 컬럼

alter table public.jira_dependencies
  add column if not exists source text not null default 'manual';

alter table public.jira_dependencies
  add column if not exists jira_link_id text;

do $$
begin
  alter table public.jira_dependencies
    add constraint jira_dependencies_source_check
    check (source in ('manual', 'jira'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists jira_dependencies_jira_link_id_key
  on public.jira_dependencies (jira_link_id)
  where jira_link_id is not null;

notify pgrst, 'reload schema';
