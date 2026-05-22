import {
  getJiraEmailFromEnv,
  getJiraApiTokenFromEnv,
  canSyncJiraFromBrowser,
} from "@/lib/jira-env";
import { syncJiraSprintsFromBrowser } from "@/lib/jira-sprint-sync-client";
import { syncJiraTasksFromBrowser } from "@/lib/jira-tasks-sync-client";

/** JIRA API → DB (스프린트 + 이슈) — 개발 프록시 · 운영 빌드(VITE_JIRA_*) 공통 */
export async function runBrowserJiraFullSync(): Promise<{
  ok: boolean;
  count?: number;
  tasksCount?: number;
  keyMigrations?: Map<string, string>;
  error?: string;
}> {
  if (!canSyncJiraFromBrowser()) {
    return {
      ok: false,
      error:
        "VITE_SUPABASE_* · VITE_JIRA_BOARD_ID 가 필요합니다. Edge 미사용 시 로컬 fallback용 VITE_JIRA_EMAIL · VITE_JIRA_API_TOKEN 도 설정하세요. docs/JIRA_AUTH.md",
    };
  }

  if (!getJiraEmailFromEnv() || !getJiraApiTokenFromEnv()) {
    return { ok: false, error: "JIRA 인증 정보가 없습니다." };
  }

  const sprints = await syncJiraSprintsFromBrowser();
  if (!sprints.ok) {
    return { ok: false, error: sprints.error ?? "스프린트 동기화에 실패했습니다." };
  }

  const tasks = await syncJiraTasksFromBrowser();
  if (!tasks.ok) {
    return { ok: false, count: sprints.count, error: tasks.error ?? "이슈 동기화에 실패했습니다." };
  }

  return {
    ok: true,
    count: sprints.count,
    tasksCount: tasks.count,
    keyMigrations: tasks.keyMigrations,
    linksCount: tasks.linksCount,
  };
}
