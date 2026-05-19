import type { ScrumEntry } from "@/lib/index";

/** YYYY-MM-DD + n일 */
export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * 전일자 불러오기용: 직전 영업일(캘린더 전일) 또는 그 이전 가장 최근 기록.
 * 같은 멤버·스프린트 기준.
 */
export function findPreviousScrumEntry(
  history: ScrumEntry[],
  memberId: string,
  sprintId: string,
  currentDate: string
): ScrumEntry | null {
  const calendarPrev = addCalendarDays(currentDate, -1);
  const exactPrev = history.find(
    (e) => e.memberId === memberId && e.sprintId === sprintId && e.date === calendarPrev
  );
  if (exactPrev) return exactPrev;

  const prior = history
    .filter(
      (e) => e.memberId === memberId && e.sprintId === sprintId && e.date < currentDate
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return prior[0] ?? null;
}

/** 전일 「오늘 계획」→ 오늘 「오늘 계획」 (선택: 전일 성과도 전일 계획으로 채움) */
export function buildCarryoverFromPrevious(
  prev: ScrumEntry,
  options?: { fillYesterdayFromPrevPlan?: boolean }
): { yesterday: string; today: string; blockers: string } {
  const fillYesterday = options?.fillYesterdayFromPrevPlan ?? true;
  return {
    yesterday: fillYesterday ? prev.today : "",
    today: prev.today,
    blockers: prev.blockers,
  };
}
