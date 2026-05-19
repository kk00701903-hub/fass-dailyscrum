import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import type { JiraTask, TaskStatus } from "@/lib/index";

const STATUS_ORDER: Record<TaskStatus, number> = {
  IN_PROGRESS: 0,
  IN_REVIEW: 1,
  BLOCKED: 2,
  TODO: 3,
  DONE: 4,
};

/** 담당자·스프린트 기준 백로그(배정 JIRA 이슈) */
export function getMemberBacklog(memberId: string, sprintId: string): JiraTask[] {
  return getActiveJiraTasks()
    .filter((t) => t.assignee.id === memberId && t.sprintId === sprintId)
    .sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 9;
      const ob = STATUS_ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return a.key.localeCompare(b.key);
    });
}

export function taskKeysToSummary(keys: string[], backlog: JiraTask[]): string {
  if (keys.length === 0) return "";
  const lines = keys
    .map((k) => backlog.find((t) => t.key === k))
    .filter(Boolean)
    .map((t) => `· ${t!.key} ${t!.summary}`);
  return lines.join("\n");
}
