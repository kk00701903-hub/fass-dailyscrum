import type { JiraSprintBoardRow } from "@/lib/jira-sprints-dashboard";
import type { JiraTaskRow } from "@/lib/jira-sprints-dashboard";
import { applyWbsFilters, buildWbsModel, type WbsSprintStatusKind } from "@/lib/jira-wbs";

/** useMemo 의존성 안정화 — board 객체 참조만 바뀐 경우 재계산 방지 */
export function wbsBoardRevisionKey(
  board: { sprints: JiraSprintBoardRow[]; tasksBySprintId: Record<string, JiraTaskRow[]> } | null
): string {
  if (!board) return "";
  const sprintIds = board.sprints.map((s) => s.jira_sprint_id).join(",");
  let taskCount = 0;
  for (const tasks of Object.values(board.tasksBySprintId)) {
    taskCount += tasks.length;
  }
  return `${sprintIds}|${taskCount}`;
}

export function wbsSetToStableKey(values: Iterable<string>): string {
  return [...values].sort().join(",");
}

/** 필터 적용 직후 보이는 스프린트 행 id (expand prune·동기 state 정리용) */
export function visibleWbsSprintRowIdsAfterFilters(
  board: { sprints: JiraSprintBoardRow[]; tasksBySprintId: Record<string, JiraTaskRow[]> },
  statusFilter: Set<WbsSprintStatusKind>,
  assigneeFilter: Set<string> | null
): string[] {
  const { sprints, tasksBySprintId } = applyWbsFilters(
    board.sprints,
    board.tasksBySprintId,
    statusFilter,
    assigneeFilter
  );
  return buildWbsModel(sprints, tasksBySprintId).sprintRows.map((r) => r.id);
}

/** 필터 변경과 같은 이벤트에서 expanded 정리 */
export function pruneWbsExpandedForFilters(
  expanded: Set<string>,
  board: { sprints: JiraSprintBoardRow[]; tasksBySprintId: Record<string, JiraTaskRow[]> } | null,
  statusFilter: Set<WbsSprintStatusKind>,
  assigneeFilter: Set<string> | null
): Set<string> {
  if (!board) return expanded;
  const visibleIds = visibleWbsSprintRowIdsAfterFilters(board, statusFilter, assigneeFilter);
  return pruneWbsExpandedSet(expanded, visibleIds);
}

/** 필터 변경 후 보이지 않는 스프린트 expand id 제거 */
export function pruneWbsExpandedSet(
  expanded: Set<string>,
  visibleSprintRowIds: Iterable<string>
): Set<string> {
  const visible = new Set(visibleSprintRowIds);
  const next = new Set<string>();
  for (const id of expanded) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

/** gantt-task-react TaskListTable에 넘기는 행 id 시퀀스 비교용 */
export function wbsGanttTaskIdSequence(tasks: { id: string }[]): string {
  return tasks.map((t) => t.id).join(",");
}

/**
 * 필터 변경 직후 렌더용 expand 집합 (숨겨진 스프린트 id 제외).
 * React state(expanded)는 useEffect로 정리되기 전에도 이 값으로 Gantt와 동기화한다.
 */
export function wbsExpandedForVisibleSprints(
  expanded: Set<string>,
  visibleSprintRowIds: readonly string[]
): Set<string> {
  return pruneWbsExpandedSet(expanded, visibleSprintRowIds);
}

export function wbsExpandedSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/** 진행 중 펼치기/접기 — prev expanded 기준으로 분기 (클로저 stale 방지) */
export function toggleWbsInProgressExpanded(
  expanded: Set<string>,
  inProgressSprintIds: readonly string[]
): Set<string> {
  const next = new Set(expanded);
  const allExpanded =
    inProgressSprintIds.length > 0 &&
    inProgressSprintIds.every((id) => expanded.has(id));
  if (allExpanded) {
    for (const id of inProgressSprintIds) next.delete(id);
  } else {
    for (const id of inProgressSprintIds) next.add(id);
  }
  return next;
}

/** 필터·뷰 변경 시 gantt-task-react 내부 상태 리셋용 (펼침은 제외) */
export function buildWbsGanttRemountKey(input: {
  viewMode: string;
  sprintStatuses: Set<WbsSprintStatusKind>;
  assigneeFilterActive: boolean;
  selectedAssignees: Set<string> | null;
}): string {
  const statuses = [...input.sprintStatuses].sort().join(",");
  const assignees = input.assigneeFilterActive
    ? [...(input.selectedAssignees ?? [])].sort().join(",")
    : "all";
  return `${input.viewMode}|${statuses}|${assignees}`;
}
