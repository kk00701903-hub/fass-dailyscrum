/** KST 기준 매일 09:00 이후 1회 스케줄 동기화 판별 (브라우저가 켜져 있을 때만 동작). */

export const JIRA_SYNC_TIMEZONE = "Asia/Seoul";
export const JIRA_SYNC_SCHEDULE_HOUR = 9;
export const JIRA_SYNC_SCHEDULE_MINUTE = 0;

const STORAGE_KEY = "jira-sync-scheduled-day-kst";

export function getSeoulCalendarDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JIRA_SYNC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isPastScheduledTime(
  date: Date,
  hour: number = JIRA_SYNC_SCHEDULE_HOUR,
  minute: number = JIRA_SYNC_SCHEDULE_MINUTE
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JIRA_SYNC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  if (h > hour) return true;
  if (h < hour) return false;
  return m >= minute;
}

export function getLastScheduledRunDayKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLastScheduledRunDayKey(dayKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, dayKey);
  } catch {
    /* ignore quota / private mode */
  }
}

export function formatSeoulDateTime(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: JIRA_SYNC_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts));
}
