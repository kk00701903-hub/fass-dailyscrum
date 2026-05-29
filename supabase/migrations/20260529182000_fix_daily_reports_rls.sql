-- daily_reports RLS 정책 완전 재설정
-- INSERT 정책 누락으로 anon 키 저장 불가 문제 수정

alter table public.daily_reports enable row level security;

-- 기존 정책 전부 제거 후 재생성 (충돌 방지)
drop policy if exists "daily_reports_select_anon"  on public.daily_reports;
drop policy if exists "daily_reports_insert_anon"  on public.daily_reports;
drop policy if exists "daily_reports_update_anon"  on public.daily_reports;
drop policy if exists "daily_reports_delete_anon"  on public.daily_reports;
-- Dashboard 자동생성 정책 제거
drop policy if exists "Enable read access for all users"   on public.daily_reports;
drop policy if exists "Enable insert for authenticated users only" on public.daily_reports;
drop policy if exists "Enable update for authenticated users only" on public.daily_reports;
drop policy if exists "Enable delete for authenticated users only" on public.daily_reports;

create policy "daily_reports_select_anon"
  on public.daily_reports for select
  to anon, authenticated
  using (true);

create policy "daily_reports_insert_anon"
  on public.daily_reports for insert
  to anon, authenticated
  with check (true);

create policy "daily_reports_update_anon"
  on public.daily_reports for update
  to anon, authenticated
  using (true);

create policy "daily_reports_delete_anon"
  on public.daily_reports for delete
  to anon, authenticated
  using (true);
