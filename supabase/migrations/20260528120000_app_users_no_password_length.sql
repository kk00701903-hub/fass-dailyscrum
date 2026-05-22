-- 아이디·비밀번호 길이 제한 제거 (빈 값만 검증)

create or replace function public.register_app_user(
  p_login_id text,
  p_password text,
  p_member_id text,
  p_display_name text default ''
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(p_login_id));
  u public.app_users%rowtype;
begin
  if v_login = '' then
    raise exception '아이디를 입력하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if exists (select 1 from public.app_users where login_id = v_login) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.app_users (login_id, password_hash, member_id, display_name)
  values (
    v_login,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    trim(p_member_id),
    coalesce(nullif(trim(p_display_name), ''), trim(p_member_id))
  )
  returning * into u;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

notify pgrst, 'reload schema';
