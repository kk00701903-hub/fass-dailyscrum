-- 설정 화면·스크립트에서 daily_reports 일괄 삭제 허용
drop policy if exists "daily_reports_delete_anon" on public.daily_reports;
create policy "daily_reports_delete_anon" on public.daily_reports
  for delete to anon, authenticated
  using (true);
