import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/auth/types";

interface UserJson {
  id: string;
  login_id: string;
  member_id: string;
  display_name: string;
}

interface FindLoginIdJson {
  login_id: string;
  display_name: string;
}

/** DB 저장 형식과 동일하게 정규화 */
export function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}

function parseUser(row: UserJson): AppUser {
  return {
    id: row.id,
    loginId: row.login_id,
    memberId: row.member_id,
    displayName: row.display_name || row.login_id,
  };
}

function rpcErrorMessage(error: { message: string; details?: string; hint?: string }): string {
  const msg = error.message?.trim();
  if (msg) return msg;
  return error.details || error.hint || "요청에 실패했습니다.";
}

export async function registerAppUser(
  loginId: string,
  password: string,
  memberId: string,
  displayName?: string
): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const { data, error } = await getSupabase().rpc("register_app_user", {
    p_login_id: normalizeLoginId(loginId),
    p_password: password,
    p_member_id: memberId,
    p_display_name: displayName ?? "",
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return parseUser(data as UserJson);
}

export async function loginAppUser(loginId: string, password: string): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const { data, error } = await getSupabase().rpc("login_app_user", {
    p_login_id: normalizeLoginId(loginId),
    p_password: password,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return parseUser(data as UserJson);
}

export async function findAppLoginId(memberId: string, password: string): Promise<FindLoginIdJson> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const { data, error } = await getSupabase().rpc("find_app_login_id", {
    p_member_id: memberId,
    p_password: password,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as FindLoginIdJson;
}

export async function resetAppUserPassword(
  loginId: string,
  memberId: string,
  newPassword: string
): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  const { data, error } = await getSupabase().rpc("reset_app_user_password", {
    p_login_id: normalizeLoginId(loginId),
    p_member_id: memberId,
    p_new_password: newPassword,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return parseUser(data as UserJson);
}
