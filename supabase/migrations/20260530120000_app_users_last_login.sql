-- 팀원 로그인 상태 조회: last_login_at + RPC

alter table public.app_users
  add column if not exists last_login_at timestamptz;

create or replace function public.login_app_user(p_login_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
  v_login text := lower(trim(p_login_id));
begin
  if v_login = '' then
    raise exception '아이디를 입력하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;

  select * into u from public.app_users where login_id = v_login;
  if not found then
    raise exception '등록된 아이디가 없습니다. 회원가입 또는 아이디 찾기를 이용하세요.';
  end if;
  if u.password_hash <> extensions.crypt(p_password, u.password_hash) then
    raise exception '비밀번호가 올바르지 않습니다.';
  end if;

  update public.app_users
  set last_login_at = now()
  where id = u.id;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.list_team_member_login_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select json_agg(
        json_build_object(
          'member_id', u.member_id,
          'registered', true,
          'login_id', u.login_id,
          'last_login_at', u.last_login_at,
          'registered_at', u.created_at
        )
        order by u.member_id
      )
      from public.app_users u
    ),
    '[]'::json
  );
end;
$$;

grant execute on function public.list_team_member_login_status() to anon, authenticated;

notify pgrst, 'reload schema';
