-- 팀 구성: 담당자별 스크럼 일지·애널리틱스 표시 여부 (팀 공통 설정)

create table if not exists public.team_member_display_settings (
  member_id text primary key,
  show_scrum_history boolean not null default true,
  show_analytics boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists team_member_display_settings_scrum_idx
  on public.team_member_display_settings (show_scrum_history)
  where show_scrum_history = true;

drop trigger if exists team_member_display_settings_updated_at on public.team_member_display_settings;
create trigger team_member_display_settings_updated_at
  before update on public.team_member_display_settings
  for each row execute function public.set_scrum_entry_updated_at();

alter table public.team_member_display_settings enable row level security;

drop policy if exists "team_member_display_settings_anon_all" on public.team_member_display_settings;
create policy "team_member_display_settings_anon_all" on public.team_member_display_settings
  for all to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.team_member_display_settings to anon, authenticated;

notify pgrst, 'reload schema';
