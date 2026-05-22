-- 로그인 bcrypt 검증 수정 + 아이디 찾기 / 비밀번호 재설정 RPC

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

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.find_app_login_id(p_member_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
begin
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if p_password is null or p_password = '' then
    raise exception '비밀번호를 입력하세요.';
  end if;

  select * into u
  from public.app_users
  where member_id = trim(p_member_id)
    and password_hash = extensions.crypt(p_password, password_hash)
  limit 1;

  if not found then
    raise exception '담당자와 비밀번호가 일치하는 계정이 없습니다.';
  end if;

  return json_build_object(
    'login_id', u.login_id,
    'display_name', u.display_name
  );
end;
$$;

create or replace function public.reset_app_user_password(
  p_login_id text,
  p_member_id text,
  p_new_password text
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
  if trim(p_member_id) = '' then
    raise exception '담당자를 선택하세요.';
  end if;
  if p_new_password is null or p_new_password = '' then
    raise exception '새 비밀번호를 입력하세요.';
  end if;

  select * into u
  from public.app_users
  where login_id = v_login and member_id = trim(p_member_id);

  if not found then
    raise exception '아이디와 담당자가 일치하는 계정이 없습니다.';
  end if;

  update public.app_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  where id = u.id
  returning * into u;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

grant execute on function public.find_app_login_id(text, text) to anon, authenticated;
grant execute on function public.reset_app_user_password(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
