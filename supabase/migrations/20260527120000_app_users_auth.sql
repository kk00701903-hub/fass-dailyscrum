-- 앱 로그인 (아이디·비밀번호) + 담당자(member_id) 연결

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  password_hash text not null,
  member_id text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  constraint app_users_login_id_key unique (login_id)
);

create index if not exists app_users_member_id_idx on public.app_users (member_id);

alter table public.app_users enable row level security;

-- 직접 테이블 접근 차단 (RPC만 사용)
drop policy if exists "app_users_no_anon_select" on public.app_users;
create policy "app_users_no_anon_select" on public.app_users for select to anon, authenticated using (false);

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

create or replace function public.login_app_user(p_login_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.app_users%rowtype;
begin
  select * into u from public.app_users where login_id = lower(trim(p_login_id));
  if not found then
    raise exception '아이디 또는 비밀번호가 올바르지 않습니다.';
  end if;
  if u.password_hash is distinct from extensions.crypt(p_password, u.password_hash) then
    raise exception '아이디 또는 비밀번호가 올바르지 않습니다.';
  end if;

  return json_build_object(
    'id', u.id,
    'login_id', u.login_id,
    'member_id', u.member_id,
    'display_name', u.display_name
  );
end;
$$;

grant execute on function public.register_app_user(text, text, text, text) to anon, authenticated;
grant execute on function public.login_app_user(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
