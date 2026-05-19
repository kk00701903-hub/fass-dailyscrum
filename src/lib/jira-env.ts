/** JIRA Cloud 연동용 환경 변수 (`VITE_*` — 개발 서버/빌드 시 주입). */

import { isSupabaseConfigured } from "@/lib/supabase/client";

export function getJiraBaseUrlFromEnv(): string {
  return import.meta.env.VITE_JIRA_BASE_URL?.trim() ?? "";
}

export function getJiraEmailFromEnv(): string {
  return import.meta.env.VITE_JIRA_EMAIL?.trim() ?? "";
}

export function getJiraApiTokenFromEnv(): string {
  return import.meta.env.VITE_JIRA_API_TOKEN?.trim() ?? "";
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

/** 브라우저에서 JIRA API → Supabase 동기화 가능 여부 (빌드 시 VITE_JIRA_* 주입 필요) */
export function canSyncJiraFromBrowser(): boolean {
  return (
    isSupabaseConfigured() &&
    Boolean(getJiraBaseUrlFromEnv()) &&
    Boolean(getJiraEmailFromEnv()) &&
    hasJiraApiTokenFromEnv() &&
    /^\d+$/.test(getJiraBoardIdFromEnv())
  );
}
