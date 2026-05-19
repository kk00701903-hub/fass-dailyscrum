-- daily_reports 컬럼명 오타 수정 + 데일리 스크럼 연동 컬럼
-- (Dashboard에서 idyesterday_achievement 로 만든 경우)

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_reports' and column_name = 'idyesterday_achievement'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_reports' and column_name = 'yesterday_achievement'
  ) then
    alter table public.daily_reports rename column idyesterday_achievement to yesterday_achievement;
  end if;
end $$;

alter table public.daily_reports
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists member_id text,
  add column if not exists report_date date,
  add column if not exists yesterday_achievement text,
  add column if not exists today_plan text,
  add column if not exists bottleneck text,
  add column if not exists is_completed boolean not null default false;

-- upsert(onConflict: member_id,report_date) 에 필요 (partial index 는 PostgREST upsert 와 맞지 않을 수 있음)
create unique index if not exists daily_reports_member_date_key
  on public.daily_reports (member_id, report_date);

-- scrum_entries (없으면 생성)
create table if not exists public.scrum_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  sprint_id text not null,
  member_id text not null,
  yesterday text not null default '',
  today text not null default '',
  blockers text not null default '없음',
  selected_tasks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_date, sprint_id, member_id)
);

alter table public.scrum_entries enable row level security;

drop policy if exists "scrum_entries_select_anon" on public.scrum_entries;
create policy "scrum_entries_select_anon" on public.scrum_entries for select to anon, authenticated using (true);

drop policy if exists "scrum_entries_insert_anon" on public.scrum_entries;
create policy "scrum_entries_insert_anon" on public.scrum_entries for insert to anon, authenticated with check (true);

drop policy if exists "scrum_entries_update_anon" on public.scrum_entries;
create policy "scrum_entries_update_anon" on public.scrum_entries for update to anon, authenticated using (true);

drop policy if exists "scrum_entries_delete_anon" on public.scrum_entries;
create policy "scrum_entries_delete_anon" on public.scrum_entries for delete to anon, authenticated using (true);
