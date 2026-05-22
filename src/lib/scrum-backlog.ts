import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { TEAM_MEMBERS, type JiraTask, type Sprint, type TaskStatus } from "@/lib/index";

const JIRA_UNASSIGNED_ID = "jira-unassigned";

const STATUS_ORDER: Record<TaskStatus, number> = {
  IN_PROGRESS: 0,
  IN_REVIEW: 1,
  BLOCKED: 2,
  TODO: 3,
  DONE: 4,
};

/** 데일리 스크럼 백로그: 완료(DONE) 제외 = 진행 중(active) 이슈 */
export function isActiveWorkTask(task: JiraTask): boolean {
  return task.status !== "DONE";
}

/** 담당 이슈 패널에서 선택 가능(할 일은 JIRA에서 진행 중으로 변경 후 선택) */
export function isSelectableScrumTask(task: JiraTask): boolean {
  return task.status !== "TODO";
}

/** 저장·표시용 — 할 일·백로그 밖 키 제거 */
export function sanitizeSelectedTaskKeys(keys: string[], flatBacklog: JiraTask[]): string[] {
  const byKey = new Map(flatBacklog.map((t) => [t.key, t]));
  return keys.filter((k) => {
    const task = byKey.get(k);
    return task != null && isSelectableScrumTask(task);
  });
}

/** 데일리 스크럼·백로그: JIRA 담당이 해당 팀 멤버인 이슈만 (id 일치 또는 표시명 일치) */
export function taskIsAssignedToMember(task: JiraTask, memberId: string): boolean {
  if (task.assignee.id === memberId) return true;
  if (task.assignee.id === JIRA_UNASSIGNED_ID) return false;
  const member = TEAM_MEMBERS.find((m) => m.id === memberId);
  if (!member) return false;
  const an = task.assignee.name.trim();
  const mn = member.name.trim();
  if (an === mn) return true;
  if (an.length >= 2 && mn.includes(an)) return true;
  if (an.length === 1 && mn.endsWith(an)) return true;
  return false;
}

export interface ScrumBacklogSprintGroup {
  sprintId: string;
  sprintName: string;
  state: Sprint["state"];
  tasks: JiraTask[];
}

/** 담당자·스프린트 기준 백로그(해당 멤버에게 배정된 JIRA 이슈만) */
export function getMemberBacklog(memberId: string, sprintId: string): JiraTask[] {
  return getActiveJiraTasks()
    .filter((t) => taskIsAssignedToMember(t, memberId) && t.sprintId === sprintId)
    .sort(sortByStatusAndKey);
}

/** 담당자·스프린트 — 진행 중(active) 이슈만 (DONE 제외) */
export function getMemberActiveBacklog(memberId: string, sprintId: string): JiraTask[] {
  return getMemberBacklog(memberId, sprintId).filter(isActiveWorkTask);
}

function sortByStatusAndKey(a: JiraTask, b: JiraTask): number {
  const oa = STATUS_ORDER[a.status] ?? 9;
  const ob = STATUS_ORDER[b.status] ?? 9;
  if (oa !== ob) return oa - ob;
  return a.key.localeCompare(b.key);
}

export function buildMemberBacklogGroups(
  memberId: string,
  sprints: Pick<Sprint, "id" | "name" | "state">[]
): ScrumBacklogSprintGroup[] {
  return sprints.map((s) => ({
    sprintId: s.id,
    sprintName: s.name,
    state: s.state,
    tasks: getMemberBacklog(memberId, s.id),
  }));
}

/** 데일리 스크럼용 — 스프린트별 진행 중 담당 이슈만 */
export function buildMemberActiveBacklogGroups(
  memberId: string,
  sprints: Pick<Sprint, "id" | "name" | "state">[]
): ScrumBacklogSprintGroup[] {
  return sprints
    .map((s) => ({
      sprintId: s.id,
      sprintName: s.name,
      state: s.state,
      tasks: getMemberActiveBacklog(memberId, s.id),
    }))
    .filter((g) => g.tasks.length > 0 || g.state === "active");
}

/** 담당 이슈 패널 상태 필터 순서·기본값(진행 중만) */
export const SCRUM_TASK_STATUS_FILTER_ORDER: TaskStatus[] = [
  "IN_PROGRESS",
  "TODO",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
];

/** 담당 이슈 패널 기본 상태 필터 (단일 선택) */
export const SCRUM_TASK_STATUS_FILTER_DEFAULT: TaskStatus = "IN_PROGRESS";

export function filterTasksByStatuses(tasks: JiraTask[], statuses: Iterable<TaskStatus>): JiraTask[] {
  const allowed = new Set(statuses);
  return tasks.filter((t) => allowed.has(t.status));
}

function isListedSubtask(task: JiraTask): boolean {
  if (task.isSubtask === true) return true;
  if (task.parentId?.trim()) return true;
  if (task.parentIssueKey?.trim()) return true;
  return false;
}

/** 담당 이슈 패널: 목록에 보이는 서브태스크가 있으면 해당 부모(jira_issue_id)만 제외 */
export function excludeParentsWithListedSubtasks(tasks: JiraTask[]): JiraTask[] {
  if (tasks.length === 0) return tasks;

  const keyToId = new Map(tasks.map((t) => [t.key, t.id]));
  const parentIdSet = new Set<string>();

  for (const t of tasks) {
    if (!isListedSubtask(t)) continue;
    const pid = t.parentId?.trim();
    if (pid) parentIdSet.add(pid);
    const parentKey = t.parentIssueKey?.trim();
    if (parentKey) {
      const resolved = keyToId.get(parentKey);
      if (resolved) parentIdSet.add(resolved);
    }
  }

  if (parentIdSet.size === 0) return tasks;
  return tasks.filter((task) => !parentIdSet.has(task.id));
}

/** 데일리 스크럼 담당 이슈: 스프린트 상태와 무관하게 담당 배정 전체(완료 포함) */
export function getMemberAssignedTasks(memberId: string): JiraTask[] {
  return getActiveJiraTasks()
    .filter((t) => taskIsAssignedToMember(t, memberId))
    .sort(sortByStatusAndKey);
}

/** 데일리 스크럼 담당 이슈: 스프린트 상태와 무관하게 담당·진행 중(DONE 제외) 전체 */
export function getMemberActiveAssignedTasks(memberId: string): JiraTask[] {
  return getMemberAssignedTasks(memberId).filter(isActiveWorkTask);
}

export function getActiveBacklogFlat(
  memberId: string,
  sprintIds: string[]
): JiraTask[] {
  const keys = new Set<string>();
  const out: JiraTask[] = [];
  for (const sid of sprintIds) {
    for (const t of getMemberActiveBacklog(memberId, sid)) {
      if (keys.has(t.key)) continue;
      keys.add(t.key);
      out.push(t);
    }
  }
  return out.sort(sortByStatusAndKey);
}

export function taskKeysToSummary(keys: string[], backlog: JiraTask[]): string {
  if (keys.length === 0) return "";
  const lines = keys
    .map((k) => backlog.find((t) => t.key === k))
    .filter(Boolean)
    .map((t) => `· ${t!.key} ${t!.summary}`);
  return lines.join("\n");
}

/**
 * 데일리 스크럼 UI·저장용 스프린트 ID.
 * 담당 진행 이슈가 없으면 팀 기본 스프린트로 내리지 않음 (빈 문자열).
 */
export function resolveScrumEntrySprintId(
  selectedTaskKeys: string[],
  flatBacklog: JiraTask[],
  fallbackSprintId: string
): string {
  if (selectedTaskKeys.length === 0) {
    if (flatBacklog.length === 0) return "";
    const backlogSprintIds = new Set(
      flatBacklog.map((t) => t.sprintId).filter((id): id is string => Boolean(id))
    );
    if (backlogSprintIds.size === 1) return [...backlogSprintIds][0]!;
    return fallbackSprintId;
  }

  const sprintIds = new Set<string>();
  for (const key of selectedTaskKeys) {
    const task = flatBacklog.find((t) => t.key === key);
    if (task?.sprintId) sprintIds.add(task.sprintId);
  }

  if (sprintIds.size === 1) return [...sprintIds][0]!;
  return flatBacklog.length > 0 ? fallbackSprintId : "";
}

export interface ScrumTaskPickerItem {
  task: JiraTask;
  sprintName: string;
}
