-- 수동 푸시 발송 대상 (구독 있는 사용자, member_id 필터 선택)
create or replace function public.web_push_manual_targets(p_member_ids text[] default null)
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
  select distinct on (au.id)
    au.id as app_user_id,
    au.member_id,
    au.display_name,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  from public.app_users au
  inner join public.push_subscriptions ps on ps.app_user_id = au.id
  where au.member_id is not null
    and au.member_id <> ''
    and (
      p_member_ids is null
      or cardinality(p_member_ids) = 0
      or au.member_id = any (p_member_ids)
    )
  order by au.id, ps.updated_at desc;
$$;

revoke all on function public.web_push_manual_targets(text[]) from public;
grant execute on function public.web_push_manual_targets(text[]) to service_role;

notify pgrst, 'reload schema';
