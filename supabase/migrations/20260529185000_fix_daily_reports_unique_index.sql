-- daily_reports: partial index → full unique index 교체
-- partial index (WHERE member_id IS NOT NULL ...)는 PostgREST upsert onConflict 대상이 될 수 없음
-- full unique index로 교체하여 onConflict: "member_id,report_date" 가 정상 동작하도록 수정

drop index if exists public.daily_reports_member_date_key;

create unique index daily_reports_member_date_key
  on public.daily_reports (member_id, report_date);

notify pgrst, 'reload schema';
