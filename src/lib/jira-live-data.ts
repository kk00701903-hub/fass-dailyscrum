import { getActiveJiraSprints, getActiveJiraTasks } from "@/lib/jira-data-registry";
import { JIRA_BACKLOG_SPRINT_ID } from "@/lib/jira-sprint-map";
import type { Blocker, JiraTask, Sprint, TaskStatus } from "@/lib/index";
import { STATUS_CONFIG, TEAM_MEMBERS, type TeamMember } from "@/lib/index";
import { getMembersForAnalytics } from "@/lib/team-member-preferences";

export const EMPTY_SPRINT: Sprint = {
  id: "",
  name: "스프린트 없음",
  state: "future",
  startDate: "—",
  endDate: "—",
  goal: "JIRA 동기화 후 표시됩니다",
};

export function resolveSprintName(sprintId: string): string {
  if (sprintId === JIRA_BACKLOG_SPRINT_ID) return "백로그";
  return getActiveJiraSprints().find((s) => s.id === sprintId)?.name ?? sprintId;
}

export function blockersFromJiraTasks(tasks: JiraTask[] = getActiveJiraTasks()): Blocker[] {
  return tasks
    .filter((t) => t.status === "BLOCKED")
    .map((t) => ({
      id: t.id,
      description: t.summary,
      severity: "high" as const,
      reportedBy: t.assignee,
      reportedAt: t.updatedAt,
      status: "open" as const,
      relatedTask: t.key,
    }));
}

export function sprintRollupFromJira(sprints: Sprint[] = getActiveJiraSprints()) {
  const completedSprints = sprints.filter((s) => s.state === "closed").length;
  return { totalSprints: sprints.length, completedSprints };
}

const STATUS_PIE_COLORS: Record<TaskStatus, string> = {
  DONE: "#34d399",
  IN_PROGRESS: "#22d3ee",
  IN_REVIEW: "#a78bfa",
  TODO: "#475569",
  BLOCKED: "#f87171",
};

export function statusDistributionFromTasks(tasks: JiraTask[] = getActiveJiraTasks()) {
  const counts: Partial<Record<TaskStatus, number>> = {};
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return (Object.keys(STATUS_CONFIG) as TaskStatus[])
    .map((status) => ({
      name: STATUS_CONFIG[status].label,
      value: counts[status] ?? 0,
      fill: STATUS_PIE_COLORS[status],
    }))
    .filter((row) => row.value > 0);
}

export function memberVelocityFromTasks(
  tasks: JiraTask[] = getActiveJiraTasks(),
  members: TeamMember[] = getMembersForAnalytics()
) {
  return members.map((m) => {
    const memberTasks = tasks.filter((t) => t.assignee.id === m.id);
    return {
      name: m.name,
      completed: memberTasks.filter((t) => t.status === "DONE").reduce((s, t) => s + t.storyPoints, 0),
      inProgress: memberTasks
        .filter((t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW")
        .reduce((s, t) => s + t.storyPoints, 0),
      todo: memberTasks
        .filter((t) => t.status === "TODO" || t.status === "BLOCKED")
        .reduce((s, t) => s + t.storyPoints, 0),
    };
  }).filter((row) => row.completed + row.inProgress + row.todo > 0);
}

/** 팀원별 전체 태스크 대비 완료(DONE) 건수 */
export function memberTaskCompletionCounts(
  tasks: JiraTask[],
  memberId: string
): { total: number; done: number; pct: number } {
  const memberTasks = tasks.filter((t) => t.assignee.id === memberId);
  const done = memberTasks.filter((t) => t.status === "DONE").length;
  const total = memberTasks.length;
  return {
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/** JIRA 일별 이력 없음 — 잔여 SP 스냅샷 1점만 표시 */
export function burndownFromTasks(tasks: JiraTask[] = getActiveJiraTasks()) {
  const remaining = tasks
    .filter((t) => t.status !== "DONE")
    .reduce((s, t) => s + t.storyPoints, 0);
  const total = tasks.reduce((s, t) => s + t.storyPoints, 0);
  if (total === 0) return [];
  return [
    { day: "현재", remaining, ideal: remaining },
  ];
}

export function burndownSummaryFromTasks(tasks: JiraTask[] = getActiveJiraTasks()) {
  const total = tasks.reduce((s, t) => s + t.storyPoints, 0);
  const done = tasks.filter((t) => t.status === "DONE").reduce((s, t) => s + t.storyPoints, 0);
  const remaining = tasks
    .filter((t) => t.status !== "DONE")
    .reduce((s, t) => s + t.storyPoints, 0);
  return { remaining, done, total };
}
