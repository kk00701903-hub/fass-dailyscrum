-- 스크럼 미팅 메모 (데일리 스크럼 소주제·결정사항·액션아이템 기록)

create table if not exists public.scrum_notes (
  id         uuid primary key default gen_random_uuid(),
  sprint_id  text,
  note_date  date not null default current_date,
  title      text not null default '',
  content    text not null default '',
  category   text not null default 'general'
               check (category in ('general', 'decision', 'action_item', 'blocker', 'share')),
  author_id  text not null default '',
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scrum_notes_date_idx     on public.scrum_notes (note_date desc);
create index if not exists scrum_notes_sprint_idx   on public.scrum_notes (sprint_id);
create index if not exists scrum_notes_category_idx on public.scrum_notes (category);

drop trigger if exists scrum_notes_updated_at on public.scrum_notes;
create trigger scrum_notes_updated_at
  before update on public.scrum_notes
  for each row execute function public.set_scrum_entry_updated_at();

alter table public.scrum_notes enable row level security;

drop policy if exists "scrum_notes_anon_all" on public.scrum_notes;
create policy "scrum_notes_anon_all" on public.scrum_notes
  for all to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.scrum_notes to anon, authenticated;

notify pgrst, 'reload schema';
