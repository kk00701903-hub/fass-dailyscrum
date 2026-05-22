-- 웹 푸시: 알림 설정 + 구독 정보
-- Edge Function(service_role)만 직접 쓰기 — anon/authenticated는 테이블에 grant 없음

-- 1) 사용자별 스크럼 미입력 알림 ON/OFF
create table if not exists public.notification_preferences (
  app_user_id uuid primary key references public.app_users (id) on delete cascade,
  scrum_reminder_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists notification_preferences_reminder_idx
  on public.notification_preferences (scrum_reminder_enabled)
  where scrum_reminder_enabled = true;

-- 2) PushSubscription (브라우저당 endpoint 유일)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_app_user_idx
  on public.push_subscriptions (app_user_id);

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_scrum_entry_updated_at();

-- (위 트리거가 scrum_entries용 이름이지만 updated_at만 세팅하므로 재사용 가능)
-- set_scrum_entry_updated_at 은 new.updated_at = now(); 만 수행

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

-- 직접 테이블 접근 차단 — RPC/Edge Function에서 service_role로만 접근
drop policy if exists "notification_preferences_service_only" on public.notification_preferences;
create policy "notification_preferences_service_only" on public.notification_preferences
  for all to public using (false) with check (false);

drop policy if exists "push_subscriptions_service_only" on public.push_subscriptions;
create policy "push_subscriptions_service_only" on public.push_subscriptions
  for all to public using (false) with check (false);

revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.notification_preferences to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- 3) 오늘(Asia/Seoul) 스크럼 미작성 + 알림 ON + 구독 있는 사용자 조회 (Edge Function에서 사용)
create or replace function public.web_push_scrum_reminder_targets()
returns table (
  app_user_id uuid,
  member_id text,
  display_name text,
  endpoint text,
  p256dh text,
  auth text
)
language sql
stable
security definer
set search_path = public
as $$
  with seoul_today as (
    select (timezone('Asia/Seoul', now()))::date as d
  ),
  written_today as (
    select distinct se.member_id
    from public.scrum_entries se
    cross join seoul_today t
    where se.entry_date = t.d
      and (
        length(trim(se.yesterday)) > 0
        or length(trim(se.today)) > 0
        or cardinality(se.selected_tasks) > 0
      )
  ),
  daily_written as (
    select distinct dr.member_id
    from public.daily_reports dr
    cross join seoul_today t
    where dr.report_date = t.d
      and coalesce(dr.is_completed, false) = true
  )
  select distinct on (au.id)
    au.id as app_user_id,
    au.member_id,
    au.display_name,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  from public.app_users au
  inner join public.push_subscriptions ps on ps.app_user_id = au.id
  left join public.notification_preferences np on np.app_user_id = au.id
  cross join seoul_today t
  where coalesce(np.scrum_reminder_enabled, true) = true
    and au.member_id is not null
    and au.member_id <> ''
    and not exists (
      select 1 from written_today w where w.member_id = au.member_id
    )
    and not exists (
      select 1 from daily_written d where d.member_id = au.member_id
    )
  order by au.id, ps.updated_at desc;
$$;

revoke all on function public.web_push_scrum_reminder_targets() from public;
grant execute on function public.web_push_scrum_reminder_targets() to service_role;

notify pgrst, 'reload schema';
