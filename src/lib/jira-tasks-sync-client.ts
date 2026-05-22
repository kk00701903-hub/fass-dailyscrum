import { jiraFetch } from "@/lib/jira-client";
import {
  canSyncJiraFromBrowser,
  getJiraBoardIdFromEnv,
  getJiraStartDateFieldIdFromEnv,
  getJiraStoryPointsFieldIdFromEnv,
} from "@/lib/jira-env";
import { extractTaskLinksFromIssue } from "@/lib/jira-issue-links";
import {
  rollupTaskLinksToSprintDependencies,
  type JiraDependencyUpsert,
  type TaskLinkSeed,
} from "@/lib/jira-dependencies";
import { replaceJiraSyncedDependencies } from "@/lib/jira-dependencies-sync";
import {
  jiraIssueFieldsQuery,
  mapIssueToDbRow,
  type JiraIssueRaw,
  type JiraTaskDbRow,
} from "@/lib/jira-issue-mapper";
import { JIRA_BACKLOG_SPRINT_ID } from "@/lib/jira-sprint-map";
import { upsertJiraTasksInDb } from "@/lib/jira-tasks-upsert";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
}

function sprintIdFromJira(sp: JiraSprintApiValue): string {
  return `jira-sprint-${sp.id}`;
}

/** 보드 스프린트별 이슈·서브태스크 조회 (active/future + 최근 closed 3개) */
export async function fetchTasksFromJiraViaProxy(): Promise<{
  rows: JiraTaskDbRow[];
  linkDeps: JiraDependencyUpsert[];
}> {
  if (!canSyncJiraFromBrowser()) {
    throw new Error("JIRA 동기화 설정을 확인하세요. VITE_JIRA_* · VITE_SUPABASE_* 환경 변수가 필요합니다.");
  }

  const boardId = getJiraBoardIdFromEnv();
  if (!/^\d+$/.test(boardId)) {
    throw new Error("VITE_JIRA_BOARD_ID 를 숫자 보드 ID로 설정하세요.");
  }

  const storyField = getJiraStoryPointsFieldIdFromEnv();
  const startField = getJiraStartDateFieldIdFromEnv();
  const fields = jiraIssueFieldsQuery(storyField, startField);
  const syncedAt = new Date().toISOString();

  const sprintRes = await jiraFetch<{ values?: JiraSprintApiValue[] }>(
    `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&maxResults=50`
  );

  const sprints = sprintRes.values ?? [];
  const closed = sprints.filter((s) => s.state === "closed").slice(-3);
  const toSync = [...sprints.filter((s) => s.state === "active" || s.state === "future"), ...closed];

  const byId = new Map<string, JiraTaskDbRow>();
  const taskLinksById = new Map<string, TaskLinkSeed>();
  const issueKeyToSprintId = new Map<string, string>();

  const ingestIssues = (issues: JiraIssueRaw[], sprintId: string) => {
    for (const issue of issues) {
      const row = mapIssueToDbRow(issue, sprintId, storyField, syncedAt, startField);
      byId.set(issue.id, row);
      issueKeyToSprintId.set(issue.key, sprintId);
      for (const link of extractTaskLinksFromIssue(issue.key, issue.fields?.issuelinks)) {
        taskLinksById.set(link.jira_link_id, link);
      }
    }
  };

  const fetchIssuePages = async (pathPrefix: string, sprintId: string) => {
    let startAt = 0;
    const maxResults = 50;
    for (;;) {
      const path = `${pathPrefix}?startAt=${startAt}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
      const page = await jiraFetch<{ issues?: JiraIssueRaw[]; isLast?: boolean }>(path);
      const issues = page.issues ?? [];
      ingestIssues(issues, sprintId);
      if (page.isLast === true || issues.length < maxResults) break;
      startAt += maxResults;
      if (startAt > 500) break;
    }
  };

  for (const sp of toSync) {
    await fetchIssuePages(`/rest/agile/1.0/sprint/${sp.id}/issue`, sprintIdFromJira(sp));
  }

  await fetchIssuePages(`/rest/agile/1.0/board/${boardId}/backlog`, JIRA_BACKLOG_SPRINT_ID);

  const linkDeps = rollupTaskLinksToSprintDependencies(
    [...taskLinksById.values()],
    issueKeyToSprintId
  );

  return {
    rows: [...byId.values()].sort((a, b) => a.issue_key.localeCompare(b.issue_key)),
    linkDeps,
  };
}

/** jira_tasks — JIRA issue.id 기준 upsert (issue_key·제목·상태 갱신) */
export async function replaceJiraTasksInDb(rows: JiraTaskDbRow[]): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.");
  }

  const { upserted } = await upsertJiraTasksInDb(supabase, rows, {
    logPrefix: "[syncJiraTasks/browser]",
  });
  return upserted;
}

export async function syncJiraTasksFromBrowser(): Promise<{
  ok: boolean;
  count?: number;
  linksCount?: number;
  error?: string;
}> {
  try {
    const { rows, linkDeps } = await fetchTasksFromJiraViaProxy();
    const count = await replaceJiraTasksInDb(rows);
    console.info(`[syncJiraTasks/browser] ${count} issue(s) synced via upsert`);
    const linksCount = await replaceJiraSyncedDependencies(linkDeps);
    return { ok: true, count, linksCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
