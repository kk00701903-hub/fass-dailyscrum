-- team_member_display_settings: 의존 함수 없이 독립 실행 가능한 버전

-- updated_at 트리거 함수 (없으면 생성)
create or replace function public.set_scrum_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
