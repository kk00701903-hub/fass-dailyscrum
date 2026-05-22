-- JIRA 스프린트·태스크 사용자 정의 의존성

create table if not exists public.jira_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('sprint', 'task')),
  source_ref text not null,
  target_kind text not null check (target_kind in ('sprint', 'task')),
  target_ref text not null,
  relation text not null default 'depends_on'
    check (relation in ('depends_on', 'blocks', 'relates_to')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jira_dependencies_no_self check (
    not (source_kind = target_kind and source_ref = target_ref)
  )
);

create unique index if not exists jira_dependencies_edge_key
  on public.jira_dependencies (source_kind, source_ref, target_kind, target_ref, relation);

create index if not exists jira_dependencies_source_idx
  on public.jira_dependencies (source_kind, source_ref);

create index if not exists jira_dependencies_target_idx
  on public.jira_dependencies (target_kind, target_ref);

alter table public.jira_dependencies enable row level security;

drop policy if exists "jira_dependencies_select_anon" on public.jira_dependencies;
create policy "jira_dependencies_select_anon" on public.jira_dependencies
  for select to anon, authenticated using (true);

drop policy if exists "jira_dependencies_insert_anon" on public.jira_dependencies;
create policy "jira_dependencies_insert_anon" on public.jira_dependencies
  for insert to anon, authenticated with check (true);

drop policy if exists "jira_dependencies_update_anon" on public.jira_dependencies;
create policy "jira_dependencies_update_anon" on public.jira_dependencies
  for update to anon, authenticated using (true);

drop policy if exists "jira_dependencies_delete_anon" on public.jira_dependencies;
create policy "jira_dependencies_delete_anon" on public.jira_dependencies
  for delete to anon, authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.jira_dependencies;
exception
  when duplicate_object then null;
end $$;
