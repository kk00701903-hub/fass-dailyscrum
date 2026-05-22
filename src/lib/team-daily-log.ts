import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { resolveSprintName } from "@/lib/jira-live-data";
import { extractSprintCodeTag } from "@/lib/jira-sprint-sort";
import type { DailyReportRow } from "@/lib/daily-reports-repository";
import { getStoredScrumEntries } from "@/lib/scrum-storage";
import type { JiraTask, ScrumEntry, TeamMember } from "@/lib/index";

export type TeamDailyReportRow = {
  id: string;
  member_id: string;
  member: TeamMember;
  tasks: string | null;
  yesterday_achievement: string | null;
  today_plan: string | null;
  bottleneck: string | null;
  hasReport: boolean;
};

function entryKey(e: Pick<ScrumEntry, "date" | "memberId" | "sprintId">): string {
  return `${e.date}::${e.memberId}::${e.sprintId}`;
}

/** DB + localStorage scrum_entries (동일 키는 로컬·최근 저장 우선) */
export function mergeScrumEntriesForDate(
  reportDate: string,
  dbEntries: ScrumEntry[]
): ScrumEntry[] {
  const map = new Map<string, ScrumEntry>();
  for (const e of dbEntries.filter((x) => x.date === reportDate)) {
    map.set(entryKey(e), e);
  }
  for (const e of getStoredScrumEntries().filter((x) => x.date === reportDate)) {
    map.set(entryKey(e), e);
  }
  return [...map.values()];
}

function memberEntries(entries: ScrumEntry[], memberId: string): ScrumEntry[] {
  return entries.filter((e) => e.memberId === memberId);
}

function pickPrimaryScrumEntry(entries: ScrumEntry[]): ScrumEntry | null {
  if (entries.length === 0) return null;
  const score = (e: ScrumEntry) =>
    (e.selectedTasks.length > 0 ? 8 : 0) +
    (e.today.trim() ? 4 : 0) +
    (e.yesterday.trim() ? 2 : 0) +
    (e.blockers.trim() && e.blockers !== "없음" ? 1 : 0);
  return [...entries].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function mergeSelectedTaskKeys(entries: ScrumEntry[]): string[] {
  const keys = new Set<string>();
  for (const e of entries) {
    for (const k of e.selectedTasks) {
      if (k.trim()) keys.add(k.trim());
    }
  }
  return [...keys];
}

function sprintCodeForTask(task: JiraTask): string | null {
  if (!task.sprintId?.trim()) return null;
  const tag = extractSprintCodeTag(resolveSprintName(task.sprintId));
  return tag && tag !== "—" ? tag : null;
}

/** 선택 타스크 — 스프린트 코드([S01]) + 요약만 표시 */
function formatSelectedTasks(keys: string[], jiraTasks: JiraTask[]): string | null {
  if (keys.length === 0) return null;
  const lines = keys.map((key) => {
    const task = jiraTasks.find((t) => t.key === key);
    if (!task) return key;
    const code = sprintCodeForTask(task);
    return code ? `${code} ${task.summary}` : `${task.key} ${task.summary}`;
  });
  return lines.join("\n");
}

function hasMeaningfulText(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  return v.length > 0 && v !== "—";
}

function hasScrumDayContent(entries: ScrumEntry[]): boolean {
  return entries.some(
    (e) =>
      e.selectedTasks.length > 0 ||
      hasMeaningfulText(e.yesterday) ||
      hasMeaningfulText(e.today) ||
      (hasMeaningfulText(e.blockers) &&
        e.blockers.trim() !== "없음" &&
        e.blockers.trim() !== "병목없음")
  );
}

export function buildTeamDailyLogRows(
  reportDate: string,
  reports: DailyReportRow[],
  scrumEntries: ScrumEntry[],
  memberFilter: string,
  allMembersKey = "all",
  members: TeamMember[]
): TeamDailyReportRow[] {
  const mergedEntries = mergeScrumEntriesForDate(reportDate, scrumEntries);
  const jiraTasks = getActiveJiraTasks();

  const pool =
    memberFilter === allMembersKey
      ? members
      : members.filter((m) => m.id === memberFilter);

  return pool.map((member) => {
    const report = reports.find((r) => r.member_id === member.id) ?? null;
    const entries = memberEntries(mergedEntries, member.id);
    const primaryEntry = pickPrimaryScrumEntry(entries);
    const taskKeys = mergeSelectedTaskKeys(entries);

    const tasks = formatSelectedTasks(taskKeys, jiraTasks);

    const yesterdayFromScrum = primaryEntry?.yesterday.trim() || null;
    const todayFromScrum = primaryEntry?.today.trim() || null;
    const blockersFromScrum =
      primaryEntry?.blockers.trim() &&
      primaryEntry.blockers.trim() !== "없음" &&
      primaryEntry.blockers.trim() !== "병목없음"
        ? primaryEntry.blockers.trim()
        : null;

    const yesterday_achievement = report?.yesterday_achievement?.trim()
      ? report.yesterday_achievement
      : yesterdayFromScrum;
    const today_plan = report?.today_plan?.trim() ? report.today_plan : todayFromScrum;
    const bottleneck = report?.bottleneck?.trim() ? report.bottleneck : blockersFromScrum;

    const hasReport =
      Boolean(report) ||
      hasScrumDayContent(entries) ||
      tasks != null;

    return {
      id: report?.id ?? `${reportDate}-${member.id}`,
      member_id: member.id,
      member,
      tasks,
      yesterday_achievement: yesterday_achievement ?? null,
      today_plan: today_plan ?? null,
      bottleneck: bottleneck ?? null,
      hasReport,
    };
  });
}

/** 긴 텍스트 컬럼 정렬: 미입력(null)을 항상 아래로 */
export function sortNullableText(a: string | null, b: string | null): number {
  const av = a?.trim() ?? "";
  const bv = b?.trim() ?? "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv, "ko");
}
