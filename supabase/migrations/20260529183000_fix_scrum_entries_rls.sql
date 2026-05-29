-- scrum_entries RLS 정책 완전 재설정
-- INSERT 정책 누락으로 anon 키 저장 불가 문제 수정

alter table public.scrum_entries enable row level security;

drop policy if exists "scrum_entries_select_anon"  on public.scrum_entries;
drop policy if exists "scrum_entries_insert_anon"  on public.scrum_entries;
drop policy if exists "scrum_entries_update_anon"  on public.scrum_entries;
drop policy if exists "scrum_entries_delete_anon"  on public.scrum_entries;
-- Dashboard 자동생성 정책 제거
drop policy if exists "Enable read access for all users"          on public.scrum_entries;
drop policy if exists "Enable insert for authenticated users only" on public.scrum_entries;
drop policy if exists "Enable update for authenticated users only" on public.scrum_entries;
drop policy if exists "Enable delete for authenticated users only" on public.scrum_entries;

create policy "scrum_entries_select_anon"
  on public.scrum_entries for select
  to anon, authenticated
  using (true);

create policy "scrum_entries_insert_anon"
  on public.scrum_entries for insert
  to anon, authenticated
  with check (true);

create policy "scrum_entries_update_anon"
  on public.scrum_entries for update
  to anon, authenticated
  using (true);

create policy "scrum_entries_delete_anon"
  on public.scrum_entries for delete
  to anon, authenticated
  using (true);
