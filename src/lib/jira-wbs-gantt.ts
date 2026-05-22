import type { Task } from "gantt-task-react";
import { wbsGanttTimelineEndDate } from "@/lib/wbs-project-week";
import { TEAM_MEMBERS } from "@/lib/index";
import { WBS_UNASSIGNED_LABEL } from "@/lib/jira-wbs";
import type { WbsRow, WbsSprintStatusKind } from "@/lib/jira-wbs";
import { extractSprintCodeTag } from "@/lib/jira-sprint-sort";

export type WbsGanttMeta = {
  kind: WbsRow["kind"];
  /** 좌측 메타 트리 컬럼용 (스프린트 전체 이름) */
  treeLabel?: string;
  statusLabel?: string;
  statusKind?: WbsSprintStatusKind;
  fromDate: string;
  toDate: string;
  weekCount: number;
  assignee: string;
  issueKey?: string;
  depth: number;
};

/** 미배정·복수 담당 스프린트 (배경 대비 가독) */
const WBS_GANTT_NEUTRAL_BAR = "#64748b";
const WBS_GANTT_SPRINT_MULTI_BAR = "#475569";

const ASSIGNEE_COLOR_BY_NAME = new Map(TEAM_MEMBERS.map((m) => [m.name, m.color]));

export type WbsGanttBarStyle = {
  backgroundColor: string;
  backgroundSelectedColor: string;
  progressColor: string;
  progressSelectedColor: string;
};

/** 평면 막대용 — 트랙(은은한 톤) + 진행(담당자 색 진하게) */
function barStylesFromBaseColor(base: string, opts?: { solid?: boolean }): WbsGanttBarStyle {
  const progress = darkenHex(base, opts?.solid ? 0.1 : 0.06);
  const track = mixHexWithWhite(base, opts?.solid ? 0.55 : 0.45);
  const trackSelected = mixHexWithWhite(base, opts?.solid ? 0.45 : 0.35);
  return {
    backgroundColor: track,
    backgroundSelectedColor: trackSelected,
    progressColor: progress,
    progressSelectedColor: darkenHex(progress, 0.04),
  };
}

function mixHexWithWhite(hex: string, whiteRatio: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * (1 - whiteRatio) + 255 * whiteRatio);
  const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const scale = Math.max(0, 1 - amount);
  const toHex = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n * scale)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(parseInt(h.slice(0, 2), 16))}${toHex(parseInt(h.slice(2, 4), 16))}${toHex(parseInt(h.slice(4, 6), 16))}`;
}

/** 담당자 표시명 → 팀 멤버 색상 (없으면 null) */
export function resolveWbsAssigneeColor(assigneeLabel: string): string | null {
  const label = assigneeLabel.trim();
  if (!label || label === "—" || label === WBS_UNASSIGNED_LABEL) return null;
  return ASSIGNEE_COLOR_BY_NAME.get(label) ?? null;
}

/** 스프린트 행: 단일 담당자면 해당 색, 복수/미배정은 중립색 */
function resolveSprintBarBaseColor(assigneeLabel: string): string {
  const label = assigneeLabel.trim();
  if (!label || label === "—") return WBS_GANTT_NEUTRAL_BAR;
  if (label.includes(",") || label.includes(" 외 ")) return WBS_GANTT_SPRINT_MULTI_BAR;
  return resolveWbsAssigneeColor(label) ?? WBS_GANTT_NEUTRAL_BAR;
}

/** gantt-task-react 막대 색 — 담당자(팀 멤버 color) 기준 */
export function wbsAssigneeBarStyles(assigneeLabel: string, kind: WbsRow["kind"]): WbsGanttBarStyle {
  if (kind === "sprint") {
    return barStylesFromBaseColor(resolveSprintBarBaseColor(assigneeLabel), { solid: true });
  }
  const base = resolveWbsAssigneeColor(assigneeLabel) ?? WBS_GANTT_NEUTRAL_BAR;
  return barStylesFromBaseColor(base);
}

function parseYmd(s: string | null | undefined): Date | null {
  if (!s?.trim() || s === "—") return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function rowDateRange(row: WbsRow): { start: Date; end: Date } {
  const start = parseYmd(row.fromDate) ?? new Date();
  let end = parseYmd(row.toDate) ?? addDays(start, 6);
  if (end.getTime() < start.getTime()) end = addDays(start, 6);
  if (end.getTime() <= start.getTime()) end = addDays(start, 1);
  return { start, end };
}

/** FROM~TO 구간 대비 오늘 위치(0~100). 미시작 0, 종료 후 100 */
function progressFromScheduleDates(row: WbsRow): number {
  const start = parseYmd(row.fromDate);
  const end = parseYmd(row.toDate);
  if (!start || !end) return 0;

  const now = Date.now();
  if (now <= start.getTime()) return 0;
  if (now >= end.getTime()) return 100;

  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start.getTime()) / span) * 100)));
}

function taskProgress(row: WbsRow): number {
  if (row.kind === "sprint") {
    switch (row.statusKind) {
      case "closed":
        return 100;
      case "active":
        return progressFromScheduleDates(row);
      case "future":
        return 0;
      default:
        return 0;
    }
  }

  if (row.statusLabel?.includes("완료") || row.statusLabel?.toLowerCase().includes("done")) {
    return 100;
  }

  return progressFromScheduleDates(row);
}

/**
 * gantt-task-react 막대·SVG 라벨
 * - 접힌 스프린트: [S08] 코드만 막대 안
 * - 펼친 스프린트·태스크: 빈 문자열 (좌측 테이블에만 표시 — 막대 밖 긴 텍스트 방지)
 */
function ganttBarLabel(row: WbsRow, expanded: Set<string>): string {
  if (row.kind === "sprint") {
    if (expanded.has(row.id)) return "";
    return extractSprintCodeTag(row.name);
  }
  return "";
}

function mapRowToTask(row: WbsRow, projectId: string | undefined, expanded: Set<string>): Task {
  const { start, end } = rowDateRange(row);
  const styles = wbsAssigneeBarStyles(row.assignee, row.kind);

  return {
    id: row.id,
    name: ganttBarLabel(row, expanded),
    type: row.kind === "sprint" ? "project" : "task",
    start,
    end,
    progress: taskProgress(row),
    project: projectId,
    hideChildren: row.kind === "sprint" ? !expanded.has(row.id) : undefined,
    styles,
  };
}

/**
 * WbsRow 트리(펼침 반영) → gantt-task-react Task[] + 좌측 그리드 메타
 */
export function mapWbsRowsToGanttTasks(
  flatRows: WbsRow[],
  expanded: Set<string>
): {
  tasks: Task[];
  metaByTaskId: Map<string, WbsGanttMeta>;
} {
  const metaByTaskId = new Map<string, WbsGanttMeta>();
  const tasks: Task[] = [];
  let currentSprintId: string | undefined;

  for (const row of flatRows) {
    if (row.kind === "sprint") currentSprintId = row.id;

    const projectId =
      row.kind === "sprint" ? undefined : row.kind === "task" ? currentSprintId : currentSprintId;

    const task = mapRowToTask(row, projectId, expanded);
    tasks.push(task);

    metaByTaskId.set(row.id, {
      kind: row.kind,
      treeLabel: row.kind === "sprint" ? row.name : undefined,
      statusLabel: row.statusLabel,
      statusKind: row.statusKind,
      fromDate: row.fromDate,
      toDate: row.toDate,
      weekCount: row.weekCount,
      assignee: row.assignee,
      issueKey: row.issueKey,
      depth: row.depth,
    });
  }

  return { tasks, metaByTaskId };
}

export function ganttTaskDisplayRows(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => !t.id.startsWith("milestone-") && !t.id.startsWith("wbs-range-pad")
  );
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * gantt-task-react 가 tasks 기준으로만 달력 범위를 잡으므로,
 * 숨김 패드로 타임라인 종료(2027년 12월 말)까지 스크롤 가능하게 함.
 */
export function appendWbsTimelineEndPad(tasks: Task[]): Task[] {
  if (tasks.some((t) => t.id === "wbs-range-pad-end")) return tasks;
  const end = wbsGanttTimelineEndDate();
  const start = new Date(end.getTime() - MS_PER_WEEK);
  return [
    ...tasks,
    {
      id: "wbs-range-pad-end",
      name: "",
      type: "task",
      start,
      end,
      progress: 0,
      isDisabled: true,
      styles: {
        backgroundColor: "transparent",
        backgroundSelectedColor: "transparent",
        progressColor: "transparent",
        progressSelectedColor: "transparent",
      },
    },
  ];
}
