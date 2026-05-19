-- daily_reports: 담당자·일자별 1건 (데일리 스크럼 저장과 연동)

alter table public.daily_reports
  add column if not exists member_id text,
  add column if not exists report_date date;

create unique index if not exists daily_reports_member_date_key
  on public.daily_reports (member_id, report_date)
  where member_id is not null and report_date is not null;

drop policy if exists "daily_reports_insert_anon" on public.daily_reports;
create policy "daily_reports_insert_anon" on public.daily_reports for insert to anon, authenticated with check (true);

drop policy if exists "daily_reports_update_anon" on public.daily_reports;
create policy "daily_reports_update_anon" on public.daily_reports for update to anon, authenticated using (true);

drop policy if exists "daily_reports_select_anon" on public.daily_reports;
create policy "daily_reports_select_anon" on public.daily_reports for select to anon, authenticated using (true);
