-- 담당자별 데일리 스크럼 등록 스프린트 (브라우저 localStorage 대신 DB 영구 저장)

create table if not exists public.scrum_member_sprints (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  sprint_id text not null,
  sprint_name text not null default '',
  created_at timestamptz not null default now(),
  unique (member_id, sprint_id)
);

create index if not exists scrum_member_sprints_member_idx
  on public.scrum_member_sprints (member_id);

alter table public.scrum_member_sprints enable row level security;

drop policy if exists "scrum_member_sprints_select_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_select_anon" on public.scrum_member_sprints
  for select to anon, authenticated using (true);

drop policy if exists "scrum_member_sprints_insert_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_insert_anon" on public.scrum_member_sprints
  for insert to anon, authenticated with check (true);

drop policy if exists "scrum_member_sprints_update_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_update_anon" on public.scrum_member_sprints
  for update to anon, authenticated using (true);

drop policy if exists "scrum_member_sprints_delete_anon" on public.scrum_member_sprints;
create policy "scrum_member_sprints_delete_anon" on public.scrum_member_sprints
  for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';
