import { ViewMode, type Task } from "gantt-task-react";
import {
  WBS_PROJECT_MILESTONES,
  weekCalendarMonth,
  wbsMilestoneMonday,
  type WbsProjectMilestone,
} from "@/lib/jira-wbs";
import {
  getWbsTimelineMonthStart,
  wbsGanttTimelineEndDate,
  wbsTimelineWeekStartMonday,
} from "@/lib/wbs-project-week";

export { wbsGanttTimelineEndDate };

/** gantt-task-react preStepsCount — 데이터 없을 때 Week 뷰 기본값 */
export const WBS_GANTT_PRE_STEPS = 3;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function isWbsTimelinePaddingTask(id: string): boolean {
  return id.startsWith("wbs-range-pad");
}

function wbsGanttDataTasks(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => !t.id.startsWith("milestone-") && !isWbsTimelinePaddingTask(t.id)
  );
}

/** Week/Month 뷰에서 0W(5월)·최소 월 시작에 맞춘 preStepsCount */
export function computeWbsGanttPreSteps(tasks: Task[], viewMode: ViewMode): number {
  const dataTasks = wbsGanttDataTasks(tasks);

  if (viewMode === ViewMode.Month) {
    if (dataTasks.length === 0) return 0;
    let earliest = dataTasks[0]!.start;
    for (const t of dataTasks) {
      if (t.start < earliest) earliest = t.start;
    }
    const earliestMonth = startOfDate(earliest, "month");
    const targetMonth = startOfDate(getWbsTimelineMonthStart(), "month");
    const monthDiff =
      (earliestMonth.getFullYear() - targetMonth.getFullYear()) * 12 +
      (earliestMonth.getMonth() - targetMonth.getMonth());
    return Math.max(0, monthDiff);
  }

  if (dataTasks.length === 0) return WBS_GANTT_PRE_STEPS;
  let earliest = dataTasks[0]!.start;
  for (const t of dataTasks) {
    if (t.start < earliest) earliest = t.start;
  }
  const earliestMon = getMonday(earliest);
  const targetMon = wbsTimelineWeekStartMonday();
  const weeks = Math.round((earliestMon.getTime() - targetMon.getTime()) / MS_PER_WEEK);
  return Math.max(1, weeks);
}

export const WBS_GANTT_WEEK_COL_WIDTH = 58;
export const WBS_GANTT_MONTH_COL_WIDTH = 76;
/** 타임라인 기준 스케일(1.0 = 라이브러리 기본 열 너비) */
const WBS_GANTT_CHART_SCALE_BASE = 0.6;
/** 타임라인 박스 가로폭 추가 축소 비율 — 0.7 = 기존 대비 30% 축소 */
export const WBS_GANTT_TIMELINE_WIDTH_RATIO = 0.7;
/** columnWidth·svgWidth = 기준 열 너비 × CHART_SCALE (현재 0.42) */
export const WBS_GANTT_CHART_SCALE = WBS_GANTT_CHART_SCALE_BASE * WBS_GANTT_TIMELINE_WIDTH_RATIO;

/** 마일스톤 라벨 전용 상단 띠 (연·월 헤더와 분리) */
export const WBS_GANTT_MILESTONE_LABEL_BAND = 32;
/** gantt-task-react에 전달하는 달력 헤더 높이 (연·월 + 주 2행) */
export const WBS_GANTT_CALENDAR_HEADER_HEIGHT = 68;
/** 오버레이·레이아웃 합산 헤더 높이 */
export const WBS_GANTT_HEADER_HEIGHT =
  WBS_GANTT_MILESTONE_LABEL_BAND + WBS_GANTT_CALENDAR_HEADER_HEIGHT;
export const WBS_GANTT_ROW_HEIGHT = 48;
export const WBS_GANTT_BAR_FILL = 65;

export type WbsMilestoneGuide = WbsProjectMilestone & {
  x: number;
  toneClass: string;
  lineColor: string;
  badgeBg: string;
  badgeText: string;
};

export type TaskDateExtents = {
  minStart: Date | null;
  maxEnd: Date | null;
};

const MILESTONE_GUIDE_STYLE: Record<
  WbsProjectMilestone["tone"],
  { toneClass: string; lineColor: string; badgeBg: string; badgeText: string }
> = {
  amber: {
    toneClass: "amber",
    lineColor: "#ea580c",
    badgeBg: "#ffedd5",
    badgeText: "#c2410c",
  },
  emerald: {
    toneClass: "emerald",
    lineColor: "#059669",
    badgeBg: "#d1fae5",
    badgeText: "#047857",
  },
  rose: {
    toneClass: "slate",
    lineColor: "#64748b",
    badgeBg: "#f1f5f9",
    badgeText: "#334155",
  },
};

function addToDate(date: Date, quantity: number, scale: "day" | "month" | "year"): Date {
  const d = new Date(date);
  if (scale === "day") d.setDate(d.getDate() + quantity);
  else if (scale === "month") d.setMonth(d.getMonth() + quantity);
  else d.setFullYear(d.getFullYear() + quantity);
  return d;
}

function startOfDate(date: Date, scale: "day" | "month" | "year"): Date {
  const d = new Date(date);
  if (scale === "year") return new Date(d.getFullYear(), 0, 1);
  if (scale === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** WBS 태스크·스프린트 막대의 실제 FROM/TO 범위 */
export function computeTaskDateExtents(tasks: Task[]): TaskDateExtents {
  const dataTasks = tasks.filter(
    (t) => !t.id.startsWith("milestone-") && !isWbsTimelinePaddingTask(t.id)
  );
  if (dataTasks.length === 0) {
    return { minStart: null, maxEnd: null };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const task of dataTasks) {
    const startMs = task.start.getTime();
    const endMs = task.end.getTime();
    if (startMs < minMs) minMs = startMs;
    if (endMs > maxMs) maxMs = endMs;
  }

  return {
    minStart: new Date(minMs),
    maxEnd: new Date(maxMs),
  };
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff, 12, 0, 0, 0);
}

/** gantt-task-react 내부 ganttDateRange와 동일 — 오버레이·그리드 열 정렬 */
function clampTimelineEnd(end: Date): Date {
  const minEnd = wbsGanttTimelineEndDate();
  return end.getTime() < minEnd.getTime() ? minEnd : end;
}

function ganttLibraryDateRange(
  tasks: Task[],
  viewMode: ViewMode,
  preStepsCount: number
): [Date, Date] {
  const dataTasks = wbsGanttDataTasks(tasks);
  const minEnd = wbsGanttTimelineEndDate();

  if (dataTasks.length === 0) {
    if (viewMode === ViewMode.Month) {
      return [startOfDate(getWbsTimelineMonthStart(), "month"), minEnd];
    }
    return [wbsTimelineWeekStartMonday(), minEnd];
  }

  let newStartDate = dataTasks[0]!.start;
  let newEndDate = dataTasks[0]!.end;
  for (const task of dataTasks) {
    if (task.start < newStartDate) newStartDate = task.start;
    if (task.end > newEndDate) newEndDate = task.end;
  }

  switch (viewMode) {
    case ViewMode.Month:
      newStartDate = startOfDate(
        addToDate(startOfDate(newStartDate, "month"), -preStepsCount, "month"),
        "month"
      );
      if (newStartDate.getTime() < getWbsTimelineMonthStart().getTime()) {
        newStartDate = startOfDate(getWbsTimelineMonthStart(), "month");
      }
      newEndDate = startOfDate(addToDate(newEndDate, 1, "year"), "year");
      break;
    case ViewMode.Week:
    default:
      newStartDate = startOfDate(newStartDate, "day");
      newStartDate = addToDate(getMonday(newStartDate), -7 * preStepsCount, "day");
      newEndDate = clampTimelineEnd(addToDate(startOfDate(newEndDate, "day"), 1.5, "month"));
      return [newStartDate, newEndDate];
  }

  return [newStartDate, clampTimelineEnd(newEndDate)];
}


function seedDates(startDate: Date, endDate: Date, viewMode: ViewMode): Date[] {
  const dates: Date[] = [new Date(startDate)];
  let current = new Date(startDate);

  while (current < endDate) {
    if (viewMode === ViewMode.Month) {
      current = addToDate(current, 1, "month");
    } else {
      current = addToDate(current, 7, "day");
    }
    dates.push(new Date(current));
  }

  return dates;
}

/** gantt-task-react taskXCoordinate (Week/Month) */
export function dateToTimelineX(date: Date, dates: Date[], columnWidth: number): number {
  if (dates.length < 2) return 0;

  let index = dates.findIndex((d) => d.getTime() >= date.getTime()) - 1;
  if (index < 0) index = 0;

  const start = dates[index]!;
  const next = dates[index + 1] ?? dates[index]!;
  const remainder = date.getTime() - start.getTime();
  const span = next.getTime() - start.getTime();
  const ratio = span > 0 ? remainder / span : 0;

  return index * columnWidth + ratio * columnWidth;
}

export type WbsGanttMonthHeaderGroup = {
  year: number;
  month: number;
  weekCount: number;
};

/** Week 뷰 열 날짜를 달력 월(목요일 기준) 단위로 연속 그룹 */
export function groupWeekColumnDatesByCalendarMonth(dates: Date[]): WbsGanttMonthHeaderGroup[] {
  if (dates.length === 0) return [];

  const groups: WbsGanttMonthHeaderGroup[] = [];
  let current: WbsGanttMonthHeaderGroup | null = null;

  for (const date of dates) {
    const { year, month } = weekCalendarMonth(date);
    if (current && current.year === year && current.month === month) {
      current.weekCount += 1;
    } else {
      current = { year, month, weekCount: 1 };
      groups.push(current);
    }
  }

  return groups;
}

/** WBS 타임라인 상단 월 헤더 — `2026년 5월` */
export function formatWbsGanttMonthHeaderLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

export function columnWidthForView(viewMode: ViewMode, scale = WBS_GANTT_CHART_SCALE): number {
  const base = viewMode === ViewMode.Month ? WBS_GANTT_MONTH_COL_WIDTH : WBS_GANTT_WEEK_COL_WIDTH;
  return base * scale;
}

export function computeGanttTimeline(
  tasks: Task[],
  viewMode: ViewMode,
  preStepsCount = WBS_GANTT_PRE_STEPS
): {
  startDate: Date;
  endDate: Date;
  dates: Date[];
  columnWidth: number;
  svgWidth: number;
  extents: TaskDateExtents;
  viewDate: Date;
} {
  const extents = computeTaskDateExtents(tasks);
  const columnWidth = columnWidthForView(viewMode);
  const [startDate, endDate] = ganttLibraryDateRange(tasks, viewMode, preStepsCount);
  const dates = seedDates(startDate, endDate, viewMode);
  const svgWidth = dates.length * columnWidth;

  return { startDate, endDate, dates, columnWidth, svgWidth, extents, viewDate: startDate };
}

export function computeMilestoneGuides(
  tasks: Task[],
  viewMode: ViewMode,
  preStepsCount = WBS_GANTT_PRE_STEPS
): WbsMilestoneGuide[] {
  const { dates, columnWidth } = computeGanttTimeline(tasks, viewMode, preStepsCount);

  return WBS_PROJECT_MILESTONES.map((m) => {
    const style = MILESTONE_GUIDE_STYLE[m.tone];
    const milestoneDate = wbsMilestoneMonday(m);
    const x = dateToTimelineX(milestoneDate, dates, columnWidth);
    return {
      ...m,
      x,
      ...style,
    };
  });
}
