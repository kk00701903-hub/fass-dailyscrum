-- Supabase SQL Editor에서 실행 — 앱 로그인 DB 구성 확인

-- 1) 테이블
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'app_users'
) as app_users_table;

-- 2) RPC 함수
select routine_name, data_type as returns
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'register_app_user',
    'login_app_user',
    'find_app_login_id',
    'reset_app_user_password'
  )
order by routine_name;

-- 3) 함수 파라미터
select p.proname, pg_get_function_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'register_app_user',
    'login_app_user',
    'find_app_login_id',
    'reset_app_user_password'
  )
order by p.proname;

-- 4) 권한 (anon 실행 가능)
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'register_app_user',
    'login_app_user',
    'find_app_login_id',
    'reset_app_user_password'
  )
  and grantee in ('anon', 'authenticated')
order by routine_name, grantee;

-- 5) 가입 수 (테스트 후)
select count(*) as user_count from public.app_users;
