import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseUrlFromEnv(): string {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

export function getSupabaseAnonKeyFromEnv(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
}

/** UI 표시용 — 앞·뒤만 노출 */
export function maskSupabaseAnonKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrlFromEnv() && getSupabaseAnonKeyFromEnv());
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 .env.local 에 설정하세요.");
  }
  if (!client) {
    client = createClient(getSupabaseUrlFromEnv(), getSupabaseAnonKeyFromEnv());
  }
  return client;
}
