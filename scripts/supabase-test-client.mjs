/**
 * CLI·통합테스트용 Supabase 클라이언트 (TLS 검사 환경 대응)
 */
import { createClient } from "@supabase/supabase-js";

export function applySupabaseTestTls(env = process.env) {
  const tlsInsecure =
    env.SUPABASE_TEST_TLS_INSECURE === "1" ||
    env.JIRA_TEST_TLS_INSECURE === "1" ||
    env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (tlsInsecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  return tlsInsecure;
}

export function createSupabaseTestClient(url, anonKey, env = process.env) {
  applySupabaseTestTls(env);
  return createClient(url, anonKey);
}
