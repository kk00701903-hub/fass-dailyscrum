/** JIRA Cloud 연동용 환경 변수 (`VITE_*` — 개발 서버/빌드 시 주입). */

import { normalizeJiraCredential } from "@/lib/jira-basic-auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function getJiraBaseUrlFromEnv(): string {
  return normalizeJiraCredential(import.meta.env.VITE_JIRA_BASE_URL);
}

export function getJiraEmailFromEnv(): string {
  return normalizeJiraCredential(import.meta.env.VITE_JIRA_EMAIL);
}

/** 브라우저·Vite 프록시 — `VITE_JIRA_API_TOKEN` ( `JIRA_API_TOKEN` 은 Node/Edge 전용 ) */
export function getJiraApiTokenFromEnv(): string {
  return normalizeJiraCredential(import.meta.env.VITE_JIRA_API_TOKEN);
}

export function hasJiraApiTokenFromEnv(): boolean {
  return getJiraApiTokenFromEnv().length > 0;
}

export function getJiraProjectKeyFromEnv(): string {
  return import.meta.env.VITE_JIRA_PROJECT_KEY?.trim() ?? "";
}

export function getJiraBoardIdFromEnv(): string {
  return import.meta.env.VITE_JIRA_BOARD_ID?.trim() ?? "";
}

/** 스토리 포인트 커스텀 필드 id (사이트마다 다름). 기본값은 Jira Cloud 흔한 값. */
export function getJiraStoryPointsFieldIdFromEnv(): string {
  const v = import.meta.env.VITE_JIRA_STORY_POINTS_FIELD?.trim();
  return v || "customfield_10016";
}

/** 시작일 커스텀 필드 id (미설정 시 customfield_10015 시도 — 사이트마다 다름) */
export function getJiraStartDateFieldIdFromEnv(): string {
  return import.meta.env.VITE_JIRA_START_DATE_FIELD?.trim() ?? "";
}

/** Supabase Edge `jira-proxy` / `sync-jira-all` 사용 가능 */
export function canUseJiraEdgeProxy(): boolean {
  return isSupabaseConfigured();
}

/** 로컬 Vite JIRA 프록시 fallback (Edge 미배포·디버그용) */
export function hasLocalJiraViteProxyCredentials(): boolean {
  return Boolean(
    import.meta.env.DEV &&
      getJiraBaseUrlFromEnv() &&
      getJiraEmailFromEnv() &&
      hasJiraApiTokenFromEnv()
  );
}

/** 브라우저에서 JIRA → Supabase 동기화 가능 여부 */
export function canSyncJiraFromBrowser(): boolean {
  if (!isSupabaseConfigured()) return false;
  if (!/^\d+$/.test(getJiraBoardIdFromEnv())) return false;
  // Edge 우선: Supabase + 보드 ID (개발·운영 공통)
  if (canUseJiraEdgeProxy()) return true;
  // Edge 없을 때만 로컬 프록시로 직접 JIRA 호출
  return hasLocalJiraViteProxyCredentials();
}
