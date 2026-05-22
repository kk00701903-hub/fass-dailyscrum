import type { Blocker, JiraTask, ScrumEntry } from "@/lib/index";
import { getTeamMember } from "@/lib/index";
import { blockersFromJiraTasks, resolveSprintName } from "@/lib/jira-live-data";

/** DailyScrum.tsx 와 동일 — 병목 없음 표기 */
export const SCRUM_BLOCKER_EMPTY_LABELS = new Set(["", "없음", "병목없음"]);

export function isMeaningfulScrumBlocker(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  return t.length > 0 && !SCRUM_BLOCKER_EMPTY_LABELS.has(t);
}

export type AnalyticsBlockerSource = "scrum" | "jira";

export type AnalyticsBlockerItem = Blocker & {
  source: AnalyticsBlockerSource;
  /** scrum: entry_date (YYYY-MM-DD) */
  sprintName?: string;
};

function cutoffDateString(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** 데일리 스크럼 scrum_entries · daily_reports(병목)에 해당하는 병목 텍스트 */
export function blockersFromScrumEntries(
  entries: ScrumEntry[],
  options?: { daysBack?: number }
): AnalyticsBlockerItem[] {
  const daysBack = options?.daysBack ?? 14;
  const cutoff = cutoffDateString(daysBack);
  const items: AnalyticsBlockerItem[] = [];

  for (const e of entries) {
    if (e.date < cutoff) continue;
    if (!isMeaningfulScrumBlocker(e.blockers)) continue;
    const member = getTeamMember(e.memberId);
    items.push({
      id: `scrum-${e.date}-${e.memberId}-${e.sprintId}`,
      description: e.blockers.trim(),
      severity: "high",
      reportedBy: member,
      reportedAt: e.date,
      status: "open",
      relatedTask: e.selectedTasks[0],
      source: "scrum",
      sprintName: resolveSprintName(e.sprintId),
    });
  }

  return items.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

export function blockersFromJiraTasksForAnalytics(
  tasks: JiraTask[] = []
): AnalyticsBlockerItem[] {
  return blockersFromJiraTasks(tasks).map((b) => ({
    ...b,
    source: "jira" as const,
  }));
}

/** 스크럼 병목을 먼저, 이어서 JIRA BLOCKED (중복 키는 각각 유지) */
export function mergeAnalyticsBlockers(
  scrum: AnalyticsBlockerItem[],
  jira: AnalyticsBlockerItem[]
): AnalyticsBlockerItem[] {
  return [...scrum, ...jira];
}

export function analyticsBlockerCounts(items: AnalyticsBlockerItem[]): {
  total: number;
  scrum: number;
  jira: number;
} {
  const scrum = items.filter((b) => b.source === "scrum").length;
  const jira = items.filter((b) => b.source === "jira").length;
  return { total: items.length, scrum, jira };
}
