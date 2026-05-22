import {
  formatAssigneeLabel,
  type JiraSprintBoardRow,
  type JiraTaskRow,
} from "@/lib/jira-sprints-dashboard";
import { sortSprintsByNumber, sprintExpandId } from "@/lib/jira-sprint-sort";
import { wbsGanttTimelineEndDate } from "@/lib/wbs-project-week";

export const WBS_UNASSIGNED_LABEL = "미배정";
/** 담당자 필터: 담당자가 없는 스프린트만 보기 (Set 내부 키) */
export const WBS_UNASSIGNED_SPRINT_KEY = "__wbs_unassigned_sprint__";
export const WBS_UNASSIGNED_SPRINT_LABEL = "미할당 스프린트";

export type WbsSprintStatusKind = "active" | "closed" | "future" | "other";

export function normalizeWbsSprintStatus(status: string): { label: string; kind: WbsSprintStatusKind } {
  const s = status.trim().toLowerCase();
  if (s.includes("진행") || s === "active") return { label: "ACTIVE", kind: "active" };
  if (s.includes("종료") || s === "closed") return { label: "CLOSED", kind: "closed" };
  if (s.includes("예정") || s === "future") return { label: "FUTURE", kind: "future" };
  return { label: status.trim() || "—", kind: "other" };
}

/** 스프린트 상태가 진행 중인지 (한글·영문) */
export function isSprintInProgress(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s.includes("진행") || s === "active";
}

/** WBS 기본 상태 필터: 진행 + 예정 */
export const WBS_DEFAULT_SPRINT_STATUSES: WbsSprintStatusKind[] = ["active", "future"];

export const WBS_SPRINT_STATUS_OPTIONS: { kind: WbsSprintStatusKind; label: string }[] = [
  { kind: "active", label: "ACTIVE (진행)" },
  { kind: "future", label: "FUTURE (예정)" },
  { kind: "closed", label: "CLOSED (종료)" },
  { kind: "other", label: "기타" },
];

export function filterSprintsByWbsStatus(
  sprints: JiraSprintBoardRow[],
  selected: Set<WbsSprintStatusKind>
): JiraSprintBoardRow[] {
  if (selected.size === 0) return [];
  return sprints.filter((s) => selected.has(normalizeWbsSprintStatus(s.status).kind));
}

/** 상태 → 담당자 순서로 WBS 필터 적용 */
export function applyWbsFilters(
  sprints: JiraSprintBoardRow[],
  tasksBySprintId: Record<string, JiraTaskRow[]>,
  statusFilter: Set<WbsSprintStatusKind>,
  assigneeFilter: Set<string> | null
): { sprints: JiraSprintBoardRow[]; tasksBySprintId: Record<string, JiraTaskRow[]> } {
  const statusFiltered = filterSprintsByWbsStatus(sprints, statusFilter);
  return applyWbsAssigneeFilters(statusFiltered, tasksBySprintId, assigneeFilter);
}

/** WBS에 등장하는 담당자 목록 (미배정 포함 여부 선택) */
export function collectAssigneesFromTasks(
  tasksBySprintId: Record<string, JiraTaskRow[]>,
  includeUnassigned = true
): string[] {
  const names = new Set<string>();
  for (const tasks of Object.values(tasksBySprintId)) {
    for (const t of tasks) {
      const label = formatAssigneeLabel(t.assignee_name);
      if (label === WBS_UNASSIGNED_LABEL) {
        if (includeUnassigned) names.add(label);
      } else {
        names.add(label);
      }
    }
  }
  return [...names].sort((a, b) => {
    if (a === WBS_UNASSIGNED_LABEL) return 1;
    if (b === WBS_UNASSIGNED_LABEL) return -1;
    return a.localeCompare(b, "ko");
  });
}

function taskMatchesAssignee(t: JiraTaskRow, selected: Set<string>): boolean {
  return selected.has(formatAssigneeLabel(t.assignee_name));
}

/**
 * 담당자 멀티 필터 (null·빈 Set = 전체)
 * - 매칭 서브태스크만 있으면 부모 태스크 포함
 * - 부모만 매칭되면 매칭 서브태스크만 포함
 */
export function filterJiraTasksByAssignees(
  tasks: JiraTaskRow[],
  selected: Set<string> | null
): JiraTaskRow[] {
  if (!selected || selected.size === 0) return tasks;

  const subtasksByParent = new Map<string, JiraTaskRow[]>();
  const parents: JiraTaskRow[] = [];

  for (const t of tasks) {
    if (t.is_subtask && t.parent_issue_key) {
      const list = subtasksByParent.get(t.parent_issue_key) ?? [];
      list.push(t);
      subtasksByParent.set(t.parent_issue_key, list);
    } else if (!t.is_subtask) {
      parents.push(t);
    }
  }

  const kept: JiraTaskRow[] = [];
  for (const parent of parents) {
    const subs = subtasksByParent.get(parent.issue_key) ?? [];
    const matchingSubs = subs.filter((s) => taskMatchesAssignee(s, selected));
    const parentMatches = taskMatchesAssignee(parent, selected);

    if (!parentMatches && matchingSubs.length === 0) continue;

    kept.push(parent);
    if (parentMatches) {
      kept.push(...subs.filter((s) => taskMatchesAssignee(s, selected)));
    } else {
      kept.push(...matchingSubs);
    }
  }

  for (const t of tasks) {
    if (t.is_subtask && !t.parent_issue_key && taskMatchesAssignee(t, selected)) {
      kept.push(t);
    }
  }

  return kept;
}

export function filterTasksBySprintId(
  tasksBySprintId: Record<string, JiraTaskRow[]>,
  selected: Set<string> | null
): Record<string, JiraTaskRow[]> {
  if (!selected || selected.size === 0) return tasksBySprintId;
  const out: Record<string, JiraTaskRow[]> = {};
  for (const [sid, tasks] of Object.entries(tasksBySprintId)) {
    const filtered = filterJiraTasksByAssignees(tasks, selected);
    if (filtered.length > 0) out[sid] = filtered;
  }
  return out;
}

/** 스프린트에 실명 담당자가 배정된 태스크가 없으면 미할당 스프린트 */
export function isUnassignedSprint(sprint: JiraSprintBoardRow, tasks: JiraTaskRow[]): boolean {
  if (tasks.length === 0) return sprint.assignees.length === 0;
  return !tasks.some((t) => formatAssigneeLabel(t.assignee_name) !== WBS_UNASSIGNED_LABEL);
}

/**
 * 담당자·미할당 스프린트 멀티 필터 (null·빈 Set = 전체)
 * - 담당자만 선택: 해당 태스크가 있는 스프린트
 * - 미할당 스프린트만: 담당자 없는 스프린트(전체 태스크)
 * - 둘 다 선택: 합집합
 */
export function applyWbsAssigneeFilters(
  sprints: JiraSprintBoardRow[],
  tasksBySprintId: Record<string, JiraTaskRow[]>,
  selected: Set<string> | null
): { sprints: JiraSprintBoardRow[]; tasksBySprintId: Record<string, JiraTaskRow[]> } {
  if (!selected || selected.size === 0) {
    return { sprints, tasksBySprintId };
  }

  const wantUnassignedSprints = selected.has(WBS_UNASSIGNED_SPRINT_KEY);
  const assigneeKeys = new Set([...selected].filter((k) => k !== WBS_UNASSIGNED_SPRINT_KEY));
  const filteredByAssignee =
    assigneeKeys.size > 0 ? filterTasksBySprintId(tasksBySprintId, assigneeKeys) : {};

  const outSprints: JiraSprintBoardRow[] = [];
  const outTasks: Record<string, JiraTaskRow[]> = {};

  for (const sprint of sprints) {
    const sid = sprint.jira_sprint_id ?? "";
    if (!sid) continue;
    const allTasks = tasksBySprintId[sid] ?? [];
    const assigneeTasks = assigneeKeys.size > 0 ? (filteredByAssignee[sid] ?? []) : [];
    const showUnassigned = wantUnassignedSprints && isUnassignedSprint(sprint, allTasks);
    const showAssignee = assigneeKeys.size > 0 && assigneeTasks.length > 0;

    if (!showUnassigned && !showAssignee) continue;

    outSprints.push(sprint);
    if (showUnassigned && !showAssignee) {
      outTasks[sid] = allTasks;
    } else {
      outTasks[sid] = assigneeTasks;
    }
  }

  return { sprints: outSprints, tasksBySprintId: outTasks };
}

export const WBS_WEEK_COL_PX = 36;
export const WBS_LEFT_COLS_PX = 644;

export interface WbsWeekColumn {
  index: number;
  start: Date;
  end: Date;
  year: number;
  month: number;
  weekOfYear: number;
  label: string;
}

export interface WbsHeaderSpan {
  label: string;
  startIdx: number;
  count: number;
  /** 그룹화 키 (연-월) */
  year: number;
  month: number;
}

export interface WbsTimeline {
  weeks: WbsWeekColumn[];
  years: WbsHeaderSpan[];
  months: WbsHeaderSpan[];
}

/** 프로젝트 마일스톤 (WBS 구분선) */
export type WbsMilestoneTone = "amber" | "emerald" | "rose";

export interface WbsProjectMilestone {
  id: string;
  label: string;
  year: number;
  month: number;
  /** 해당 달력 월 기준 N주차 (1-based, 목요일 기준 월 소속과 동일) */
  weekInMonth: number;
  tone: WbsMilestoneTone;
}

export const WBS_PROJECT_MILESTONES: WbsProjectMilestone[] = [
  { id: "prototype-start", label: "프로토타입 스타트", year: 2026, month: 10, weekInMonth: 1, tone: "amber" },
  { id: "live", label: "Live", year: 2027, month: 3, weekInMonth: 1, tone: "emerald" },
  { id: "project-end", label: "종료", year: 2027, month: 6, weekInMonth: 5, tone: "rose" },
];

/** 마일스톤 표시용 주차 문구 */
export function wbsMilestoneCaption(m: WbsProjectMilestone): string {
  return `${m.year}년 ${m.month}월 ${m.weekInMonth}주차`;
}

/** 해당 월(1–31일)과 하루라도 겹치는 주의 월요일 목록 (시간순) */
function mondaysOverlappingCalendarMonth(year: number, month: number): Date[] {
  const monthStart = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 12, 0, 0, 0);
  let cursor = addDays(startOfWeekMonday(monthStart), -7);
  const mondays: Date[] = [];

  while (cursor.getTime() <= addDays(monthEnd, 7).getTime()) {
    const weekEnd = addDays(cursor, 6);
    const overlaps =
      cursor.getTime() <= monthEnd.getTime() && weekEnd.getTime() >= monthStart.getTime();
    if (overlaps) {
      mondays.push(new Date(cursor));
    }
    cursor = addDays(cursor, 7);
  }

  return mondays;
}

/** 달력 월에 겹치는 ISO 주(월요일 기준) 개수 */
export function wbsCalendarMonthWeekCount(year: number, month: number): number {
  return mondaysOverlappingCalendarMonth(year, month).length;
}

/** 해당 월 1일~말일 사이에 시작(월요일)하는 주 — 10월 1주차 = 10/5 월요일 등 */
function mondaysStartingInCalendarMonth(year: number, month: number): Date[] {
  return mondaysOverlappingCalendarMonth(year, month).filter(
    (d) => d.getFullYear() === year && d.getMonth() + 1 === month
  );
}

/** 달력 월 N주차(1-based) — 1~N주차는 그 달에 시작하는 ISO 주, 5주차 등은 겹침 주 목록 */
export function mondayOfCalendarMonthWeek(year: number, month: number, weekInMonth: number): Date {
  const overlapping = mondaysOverlappingCalendarMonth(year, month);
  const inMonth = mondaysStartingInCalendarMonth(year, month);

  if (weekInMonth >= 1 && weekInMonth <= inMonth.length) {
    return inMonth[weekInMonth - 1]!;
  }

  const idx = Math.max(0, Math.min(weekInMonth - 1, overlapping.length - 1));
  return overlapping[idx] ?? startOfWeekMonday(new Date(year, month - 1, 1, 12, 0, 0, 0));
}

export function wbsMilestoneMonday(m: WbsProjectMilestone): Date {
  return mondayOfCalendarMonthWeek(m.year, m.month, m.weekInMonth);
}

export interface WbsMilestoneMarker extends WbsProjectMilestone {
  weekIdx: number;
  weekNum: number;
  leftPx: number;
}

export function wbsMilestoneDates(): Date[] {
  return WBS_PROJECT_MILESTONES.map((m) => wbsMilestoneMonday(m));
}

/** 마일스톤 월 첫 주(월요일 기준)에 세로 구분선 위치 계산 */
export function resolveMilestoneMarkers(weeks: WbsWeekColumn[]): WbsMilestoneMarker[] {
  if (weeks.length === 0) return [];
  const rangeStart = weeks[0]!.start;

  return WBS_PROJECT_MILESTONES.map((m) => {
    const weekStart = wbsMilestoneMonday(m);
    const weekIdx = Math.max(
      0,
      Math.min(weeks.length - 1, Math.floor((weekStart.getTime() - rangeStart.getTime()) / (7 * 86_400_000)))
    );
    return { ...m, weekIdx, weekNum: weekIdx + 1, leftPx: weekIdx * WBS_WEEK_COL_PX };
  });
}

/** 타임라인 기준 1-based 주차 (Gantt 헤더용) */
export function weekNumFromIndex(weekIdx: number): number {
  return weekIdx + 1;
}

export function formatYmdDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** From ~ To 일자 구간 주수 (양 끝 포함, 7일 단위 올림) */
export function weeksBetweenDates(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil((ms + 1) / (7 * 86_400_000)));
}

export function formatDateRangeLabel(fromDate: string, toDate: string, weekCount: number): string {
  return `${fromDate} ~ ${toDate} (${weekCount}주)`;
}

export interface WbsRow {
  id: string;
  kind: "sprint" | "task" | "subtask";
  name: string;
  issueKey?: string;
  assignee: string;
  statusLabel?: string;
  statusKind?: WbsSprintStatusKind;
  fromDate: string;
  toDate: string;
  weekCount: number;
  barStartIdx: number;
  barSpan: number;
  depth: number;
  children: WbsRow[];
}

function parseYmd(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * 주(월~일)가 속한 달력 월 — 해당 주 목요일 기준 (ISO 관행, 월 경계 주 정렬)
 */
export function weekCalendarMonth(weekStartMonday: Date): { year: number; month: number } {
  const thursday = addDays(weekStartMonday, 3);
  return { year: thursday.getFullYear(), month: thursday.getMonth() + 1 };
}

function monthHeaderLabel(year: number, month: number, multiYearTimeline: boolean): string {
  return multiYearTimeline ? `${year}년 ${month}월` : `${month}월`;
}

/** 해당 주의 월요일 */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  return x;
}

function isoWeek(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

interface ResolvedRange {
  start: Date;
  end: Date;
  fromDate: string;
  toDate: string;
}

function resolveTaskRange(task: JiraTaskRow, sprint: JiraSprintBoardRow): ResolvedRange {
  const sprintStart = parseYmd(sprint.start_date);
  const sprintEnd = parseYmd(sprint.end_date);
  const startParsed =
    parseYmd(task.start_date) ?? parseYmd(task.created_at?.slice(0, 10)) ?? sprintStart;
  const endParsed =
    parseYmd(task.due_date) ?? parseYmd(task.resolved_at?.slice(0, 10)) ?? sprintEnd;

  const start = startParsed ?? sprintStart ?? new Date();
  let end = endParsed ?? sprintEnd ?? addDays(start, 6);
  if (end.getTime() < start.getTime()) end = addDays(start, 6);

  return {
    start,
    end,
    fromDate: startParsed ? formatYmdDate(startParsed) : "—",
    toDate: endParsed ? formatYmdDate(endParsed) : "—",
  };
}

function resolveSprintRange(sprint: JiraSprintBoardRow): ResolvedRange {
  const startParsed = parseYmd(sprint.start_date);
  const endParsed = parseYmd(sprint.end_date);
  const start = startParsed ?? new Date();
  let end = endParsed ?? addDays(start, 13);
  if (end.getTime() < start.getTime()) end = addDays(start, 13);

  return {
    start,
    end,
    fromDate: startParsed ? formatYmdDate(startParsed) : "—",
    toDate: endParsed ? formatYmdDate(endParsed) : "—",
  };
}

export interface BuildWbsTimelineOptions {
  /** 조회 스프린트 최소 시작일 — 있으면 해당 주 월요일부터 (기존 -7일 패딩 생략) */
  floorStart?: Date;
}

export function buildWbsTimeline(
  allStarts: Date[],
  allEnds: Date[],
  options?: BuildWbsTimelineOptions
): WbsTimeline {
  if (allStarts.length === 0 && allEnds.length === 0) {
    const today = startOfWeekMonday(new Date());
    allStarts = [today];
    allEnds = [addDays(today, 27)];
  } else if (allStarts.length === 0) {
    const today = startOfWeekMonday(new Date());
    allStarts = [today];
  } else if (allEnds.length === 0) {
    allEnds = [...allStarts];
  }

  let min = allStarts[0]!;
  let max = allEnds[0]!;
  for (let i = 1; i < allStarts.length; i++) {
    if (allStarts[i]!.getTime() < min.getTime()) min = allStarts[i]!;
  }
  for (let i = 0; i < allEnds.length; i++) {
    if (allEnds[i]!.getTime() > max.getTime()) max = allEnds[i]!;
  }

  const rangeStart =
    options?.floorStart != null
      ? startOfWeekMonday(options.floorStart)
      : addDays(startOfWeekMonday(min), -7);
  const rangeFromData = addDays(startOfWeekMonday(max), 21);
  const rangeEnd =
    rangeFromData.getTime() > wbsGanttTimelineEndDate().getTime()
      ? rangeFromData
      : wbsGanttTimelineEndDate();

  const weeks: WbsWeekColumn[] = [];
  let cursor = new Date(rangeStart);
  let index = 0;

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = addDays(weekStart, 6);
    const { year: y, month: m } = weekCalendarMonth(weekStart);
    const woy = isoWeek(weekStart);
    weeks.push({
      index,
      start: weekStart,
      end: weekEnd,
      year: y,
      month: m,
      weekOfYear: woy,
      label: `${index + 1}주`,
    });
    cursor = addDays(cursor, 7);
    index += 1;
  }

  const years: WbsHeaderSpan[] = [];
  const months: WbsHeaderSpan[] = [];
  const multiYearTimeline =
    weeks.length > 0 && weeks[0]!.year !== weeks[weeks.length - 1]!.year;

  for (const w of weeks) {
    const yLabel = String(w.year);
    const lastY = years[years.length - 1];
    if (!lastY || lastY.year !== w.year) {
      years.push({ label: yLabel, startIdx: w.index, count: 1, year: w.year, month: 0 });
    } else {
      lastY.count += 1;
    }

    const lastM = months[months.length - 1];
    if (!lastM || lastM.year !== w.year || lastM.month !== w.month) {
      months.push({
        label: monthHeaderLabel(w.year, w.month, multiYearTimeline),
        startIdx: w.index,
        count: 1,
        year: w.year,
        month: w.month,
      });
    } else {
      lastM.count += 1;
    }
  }

  return { weeks, years, months };
}

function barForRange(
  start: Date,
  end: Date,
  weeks: WbsWeekColumn[]
): { barStartIdx: number; barSpan: number } {
  if (weeks.length === 0) return { barStartIdx: 0, barSpan: 1 };

  const rangeStart = weeks[0]!.start;
  const lastWeek = weeks[weeks.length - 1]!;
  const rangeEnd = lastWeek.end;

  const s = start.getTime() < rangeStart.getTime() ? rangeStart : start;
  const e = end.getTime() > rangeEnd.getTime() ? rangeEnd : end;

  const startIdx = Math.max(
    0,
    Math.floor((startOfWeekMonday(s).getTime() - rangeStart.getTime()) / (7 * 86_400_000))
  );
  const endIdx = Math.min(
    weeks.length - 1,
    Math.floor((startOfWeekMonday(e).getTime() - rangeStart.getTime()) / (7 * 86_400_000))
  );

  return { barStartIdx: startIdx, barSpan: Math.max(1, endIdx - startIdx + 1) };
}

function taskToWbsRow(
  task: JiraTaskRow,
  sprint: JiraSprintBoardRow,
  weeks: WbsWeekColumn[],
  depth: number,
  kind: "task" | "subtask"
): WbsRow {
  const range = resolveTaskRange(task, sprint);
  const { barStartIdx, barSpan } = barForRange(range.start, range.end, weeks);
  return {
    id: task.id,
    kind,
    name: task.summary,
    issueKey: task.issue_key,
    assignee: formatAssigneeLabel(task.assignee_name),
    fromDate: range.fromDate,
    toDate: range.toDate,
    weekCount: weeksBetweenDates(range.start, range.end),
    barStartIdx,
    barSpan,
    depth,
    children: [],
  };
}

function uniqueAssigneesFromTasks(tasks: JiraTaskRow[]): string[] {
  const names = new Set<string>();
  for (const t of tasks) {
    const n = formatAssigneeLabel(t.assignee_name);
    if (n !== WBS_UNASSIGNED_LABEL) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}

function buildTaskTree(tasks: JiraTaskRow[], sprint: JiraSprintBoardRow, weeks: WbsWeekColumn[]): WbsRow[] {
  const parents = tasks.filter((t) => !t.is_subtask);
  const subtasksByParent = new Map<string, JiraTaskRow[]>();
  for (const t of tasks.filter((x) => x.is_subtask && x.parent_issue_key)) {
    const key = t.parent_issue_key!;
    const list = subtasksByParent.get(key) ?? [];
    list.push(t);
    subtasksByParent.set(key, list);
  }

  return parents.map((parent) => {
    const row = taskToWbsRow(parent, sprint, weeks, 1, "task");
    row.children = (subtasksByParent.get(parent.issue_key) ?? []).map((st) =>
      taskToWbsRow(st, sprint, weeks, 2, "subtask")
    );
    return row;
  });
}

export function buildWbsModel(
  sprints: JiraSprintBoardRow[],
  tasksBySprintId: Record<string, JiraTaskRow[]>
): { timeline: WbsTimeline; sprintRows: WbsRow[] } {
  const allStarts: Date[] = [];
  const allEnds: Date[] = [];
  const sprintStarts: Date[] = [];

  for (const md of wbsMilestoneDates()) {
    allEnds.push(md);
  }

  for (const sprint of sprints) {
    const { start, end } = resolveSprintRange(sprint);
    sprintStarts.push(start);
    allStarts.push(start);
    allEnds.push(end);
    const linkId = sprint.jira_sprint_id ?? "";
    for (const t of linkId ? (tasksBySprintId[linkId] ?? []) : []) {
      const r = resolveTaskRange(t, sprint);
      allStarts.push(r.start);
      allEnds.push(r.end);
    }
  }

  let floorStart: Date | undefined;
  if (sprintStarts.length > 0) {
    floorStart = sprintStarts[0]!;
    for (let i = 1; i < sprintStarts.length; i++) {
      if (sprintStarts[i]!.getTime() < floorStart.getTime()) floorStart = sprintStarts[i]!;
    }
  }

  const timeline = buildWbsTimeline(allStarts, allEnds, { floorStart });
  const { weeks } = timeline;

  const sorted = sortSprintsByNumber(sprints);

  const sprintRows: WbsRow[] = sorted.map((sprint) => {
    const range = resolveSprintRange(sprint);
    const { barStartIdx, barSpan } = barForRange(range.start, range.end, weeks);
    const linkId = sprint.jira_sprint_id ?? "";
    const tasks = linkId ? (tasksBySprintId[linkId] ?? []) : [];
    const taskAssignees = uniqueAssigneesFromTasks(tasks);
    const assignee =
      taskAssignees.length > 0
        ? taskAssignees.length <= 3
          ? taskAssignees.join(", ")
          : `${taskAssignees.slice(0, 2).join(", ")} 외 ${taskAssignees.length - 2}명`
        : "—";
    const { label: statusLabel, kind: statusKind } = normalizeWbsSprintStatus(sprint.status);
    return {
      id: sprintExpandId(sprint),
      kind: "sprint",
      name: sprint.sprint_name,
      assignee,
      statusLabel,
      statusKind,
      fromDate: range.fromDate,
      toDate: range.toDate,
      weekCount: weeksBetweenDates(range.start, range.end),
      barStartIdx,
      barSpan,
      depth: 0,
      children: buildTaskTree(tasks, sprint, weeks),
    };
  });

  return { timeline, sprintRows };
}

/** 펼친 스프린트 기준 플랫 행 목록 (렌더용) */
export function flattenWbsRows(sprintRows: WbsRow[], expanded: Set<string>): WbsRow[] {
  const out: WbsRow[] = [];
  for (const sprint of sprintRows) {
    out.push(sprint);
    if (!expanded.has(sprint.id)) continue;
    for (const task of sprint.children) {
      out.push(task);
      for (const sub of task.children) {
        out.push(sub);
      }
    }
  }
  return out;
}
