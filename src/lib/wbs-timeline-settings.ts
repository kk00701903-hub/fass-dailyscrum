/**
 * JIRA WBS 타임라인 기간 설정 — localStorage 기반
 *
 * - 시작일(프로젝트 1W 기준일): WBS_PROJECT_WEEK_ORIGIN_DATE 대체
 * - 종료 연도/월:               WBS_GANTT_TIMELINE_END_YEAR/MONTH 대체
 */

const KEY_ORIGIN = "wbs_timeline_origin_date";
const KEY_END_YEAR = "wbs_timeline_end_year";
const KEY_END_MONTH = "wbs_timeline_end_month";

/** 변경 이벤트 이름 */
export const WBS_TIMELINE_SETTINGS_CHANGED = "wbs-timeline-settings-changed";

function dispatchChange() {
  window.dispatchEvent(new Event(WBS_TIMELINE_SETTINGS_CHANGED));
}

/** localStorage가 사용 가능한지 (Node.js 테스트 환경 등에서 안전하게 처리) */
function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function lsGet(key: string): string | null {
  if (!hasLocalStorage()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function lsRemove(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** yyyy-MM-dd 문자열 → Date (로컬 정오) */
function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** Date → yyyy-MM-dd */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 기본값 ────────────────────────────────────────────────────────────────────
export const WBS_DEFAULT_ORIGIN_DATE = new Date(2026, 4, 17, 12, 0, 0, 0); // 2026-05-17
export const WBS_DEFAULT_END_YEAR = 2027;
export const WBS_DEFAULT_END_MONTH = 12; // 1-indexed

// ── 읽기 ──────────────────────────────────────────────────────────────────────

export function getWbsOriginDate(): Date {
  const stored = lsGet(KEY_ORIGIN);
  if (stored) {
    const d = parseIso(stored);
    if (d) return d;
  }
  return new Date(WBS_DEFAULT_ORIGIN_DATE.getTime());
}

export function getWbsEndYear(): number {
  const v = lsGet(KEY_END_YEAR);
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) ? WBS_DEFAULT_END_YEAR : n;
}

export function getWbsEndMonth(): number {
  const v = lsGet(KEY_END_MONTH);
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) ? WBS_DEFAULT_END_MONTH : Math.max(1, Math.min(12, n));
}

// ── 쓰기 ──────────────────────────────────────────────────────────────────────

export function setWbsOriginDate(date: Date): void {
  lsSet(KEY_ORIGIN, toIsoDate(date));
  dispatchChange();
}

export function setWbsEndYear(year: number): void {
  lsSet(KEY_END_YEAR, String(year));
  dispatchChange();
}

export function setWbsEndMonth(month: number): void {
  lsSet(KEY_END_MONTH, String(Math.max(1, Math.min(12, month))));
  dispatchChange();
}

export function resetWbsTimelineSettings(): void {
  lsRemove(KEY_ORIGIN);
  lsRemove(KEY_END_YEAR);
  lsRemove(KEY_END_MONTH);
  dispatchChange();
}

/** 현재 설정 스냅샷 */
export interface WbsTimelineSettings {
  originDate: Date;
  endYear: number;
  endMonth: number;
}

export function getWbsTimelineSettings(): WbsTimelineSettings {
  return {
    originDate: getWbsOriginDate(),
    endYear: getWbsEndYear(),
    endMonth: getWbsEndMonth(),
  };
}
