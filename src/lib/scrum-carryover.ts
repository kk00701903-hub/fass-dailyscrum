import type { ScrumEntry } from "@/lib/index";

export type ScrumTodayPlanByDate = {
  date: string;
  dateLabel: string;
  plans: { id: string; sprintId: string; today: string }[];
};

/** 과거 기록 패널용 — YYYY-MM-DD → 2026. 5. 21. */
export function formatScrumEntryDateLabel(iso: string): string {
  const parts = iso.split("-").map((p) => Number(p));
  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;
  return `${y}. ${m}. ${d}.`;
}

/** 멤버별 일자 그룹 — 각 일자의 저장된 「오늘 계획」(today)만 */
export function groupScrumTodayPlansByDate(
  history: ScrumEntry[],
  memberId: string,
  maxDates = 8
): ScrumTodayPlanByDate[] {
  const byDate = new Map<string, ScrumTodayPlanByDate["plans"]>();

  for (const e of history) {
    if (e.memberId !== memberId) continue;
    const today = e.today.trim();
    if (!today) continue;
    const list = byDate.get(e.date) ?? [];
    list.push({ id: e.id, sprintId: e.sprintId, today });
    byDate.set(e.date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, maxDates)
    .map(([date, plans]) => ({
      date,
      dateLabel: formatScrumEntryDateLabel(date),
      plans,
    }));
}

/** YYYY-MM-DD + n일 */
export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** 해당 일자에 담당 이슈를 1건 이상 선택해 저장했는지 */
export function memberHasSelectedTasksOnDate(
  history: ScrumEntry[],
  memberId: string,
  date: string
): boolean {
  return history.some(
    (e) => e.memberId === memberId && e.date === date && e.selectedTasks.length > 0
  );
}

/** 해당 일자 scrum_entries 행 존재 (선택 비어 있어도 — 수동 해제·저장 후 재이월 방지) */
export function memberHasAnyScrumEntryOnDate(
  history: ScrumEntry[],
  memberId: string,
  date: string
): boolean {
  return history.some((e) => e.memberId === memberId && e.date === date);
}

/**
 * 전일(또는 그 이전) 가장 최근 저장분의 selectedTasks.
 * 스프린트 무관 — 멤버 단위 담당 이슈 체크 이월용.
 */
export function findPreviousMemberSelectedTasks(
  history: ScrumEntry[],
  memberId: string,
  currentDate: string
): string[] {
  const calendarPrev = addCalendarDays(currentDate, -1);
  const exactPrev = history.filter(
    (e) =>
      e.memberId === memberId &&
      e.date === calendarPrev &&
      e.selectedTasks.length > 0
  );
  if (exactPrev.length > 0) {
    const merged = new Set<string>();
    for (const e of exactPrev) {
      for (const k of e.selectedTasks) {
        if (k.trim()) merged.add(k.trim());
      }
    }
    return [...merged];
  }

  const prior = history
    .filter(
      (e) =>
        e.memberId === memberId && e.date < currentDate && e.selectedTasks.length > 0
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return prior ? [...prior.selectedTasks] : [];
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
