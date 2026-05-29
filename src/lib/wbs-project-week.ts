import {
  getWbsOriginDate,
  getWbsEndYear,
  getWbsEndMonth,
  WBS_DEFAULT_ORIGIN_DATE,
} from "@/lib/wbs-timeline-settings";

/** 프로젝트 1W 기준 (설정값 또는 기본 2026-05-17) — 호출 시점에 읽음 */
export function getWbsProjectWeekOriginDate(): Date {
  return getWbsOriginDate();
}

/** @deprecated 직접 사용 대신 getWbsProjectWeekOriginDate() 사용 */
export const WBS_PROJECT_WEEK_ORIGIN_DATE = WBS_DEFAULT_ORIGIN_DATE;

/** Month 달력 최소 시작 — 설정된 시작일 기준 그 달 1일 */
export function getWbsTimelineMonthStart(): Date {
  const origin = getWbsOriginDate();
  return new Date(origin.getFullYear(), origin.getMonth(), 1, 12, 0, 0, 0);
}

/** @deprecated 직접 사용 대신 getWbsTimelineMonthStart() 사용 */
export const WBS_TIMELINE_MONTH_START = new Date(2026, 4, 1, 12, 0, 0, 0);

export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function addWeeks(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * MS_PER_WEEK);
}

function startOfUtcDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/** 해당 날짜가 속한 주의 월요일 (gantt-task-react Week 열 기준) */
export function mondayOfWeek(date: Date): Date {
  const d = startOfUtcDay(date);
  const day = d.getDay();
  const mondayDay = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), mondayDay, 12, 0, 0, 0);
}

/** 설정된 기준일 기준 해당 주 월요일 (호출 시점에 읽음) */
function getOriginMonday(): Date {
  return mondayOfWeek(getWbsProjectWeekOriginDate());
}

/** Week 달력·0W 라벨이 시작하는 월요일 (기준 주 -1주) — 호출 시점에 읽음 */
function computeWeekStartMonday(): Date {
  return addWeeks(getOriginMonday(), -1);
}

/** gantt-task-react preStepsCount 만큼 앞당긴 뒤 첫 열이 0W가 되도록 하는 앵커 월요일 */
export function wbsGanttLibraryAnchorMonday(preStepsCount: number): Date {
  return addWeeks(computeWeekStartMonday(), preStepsCount);
}

export function wbsTimelineWeekStartMonday(): Date {
  return computeWeekStartMonday();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Gantt 타임라인 스크롤 상한 기본값 */
export const WBS_GANTT_TIMELINE_END_YEAR = 2027;
export const WBS_GANTT_TIMELINE_END_MONTH = 12;
export const WBS_GANTT_TIMELINE_END_WEEK_IN_MONTH = 4;

/**
 * WBS·Gantt 달력이 최소한 스크롤되어야 하는 종료일 — 설정된 연/월의 마지막 주 일요일.
 */
export function wbsGanttTimelineEndDate(): Date {
  const year = getWbsEndYear();
  const monthIndex = getWbsEndMonth() - 1;
  const mondaysInMonth: Date[] = [];
  let cursor = mondayOfWeek(new Date(year, monthIndex, 1, 12, 0, 0, 0));
  for (let i = 0; i < 6; i++) {
    if (cursor.getMonth() === monthIndex) mondaysInMonth.push(new Date(cursor));
    cursor = addDays(cursor, 7);
  }
  const weekMonday = mondaysInMonth[WBS_GANTT_TIMELINE_END_WEEK_IN_MONTH - 1];
  if (!weekMonday) {
    return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0);
  }
  return addDays(weekMonday, 6);
}

/**
 * 타임라인 주차 열(월요일) → 프로젝트 주차 인덱스
 * - 기준일 해당 주: 1
 * - 그 이전: 0
 * - 이후: 2, 3, …
 */
export function projectWeekIndex(columnWeekMonday: Date): number {
  const colMon = mondayOfWeek(columnWeekMonday).getTime();
  const originMon = mondayOfWeek(getWbsProjectWeekOriginDate()).getTime();
  const diffWeeks = Math.floor((colMon - originMon) / MS_PER_WEEK);
  if (diffWeeks < 0) return 0;
  return diffWeeks + 1;
}

/** 하단 헤더 라벨 — 0W, 1W, 2W, … */
export function formatWbsProjectWeekLabel(columnWeekMonday: Date): string {
  return `${projectWeekIndex(columnWeekMonday)}W`;
}

/** 열 너비가 좁을 때 숫자만 표시, 툴팁에 전체 주차 라벨 */
export const WBS_WEEK_HEADER_FULL_LABEL_MIN_PX = 34;

export function formatWbsProjectWeekHeaderLabel(
  columnWeekMonday: Date,
  columnWidth: number
): { label: string; title: string } {
  const index = projectWeekIndex(columnWeekMonday);
  const full = `${index}W`;
  const title = `프로젝트 ${index}주차`;
  if (columnWidth >= WBS_WEEK_HEADER_FULL_LABEL_MIN_PX) {
    return { label: full, title };
  }
  return { label: String(index), title: `${title} (${full})` };
}

/** gantt 주차 열 목록에 대한 라벨 (timeline.dates) */
export function formatWbsProjectWeekLabels(weekColumnDates: Date[]): string[] {
  return weekColumnDates.map((d) => formatWbsProjectWeekLabel(d));
}
