import type { JiraTask, ScrumEntry } from "@/lib/index";
import {
  getMemberActiveAssignedTasks,
  sanitizeSelectedTaskKeys,
  taskIsAssignedToMember,
} from "@/lib/scrum-backlog";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { upsertScrumEntryToDb } from "@/lib/supabase/jira-repository";

function entryKey(e: Pick<ScrumEntry, "date" | "memberId" | "sprintId">): string {
  return `${e.date}::${e.memberId}::${e.sprintId}`;
}

function reconcileEntryKeys(entry: ScrumEntry, allTasks: JiraTask[]): ScrumEntry {
  const backlog = allTasks.filter(
    (t) => taskIsAssignedToMember(t, entry.memberId) && t.status !== "DONE"
  );
  const next = sanitizeSelectedTaskKeys(entry.selectedTasks, backlog);
  if (
    next.length === entry.selectedTasks.length &&
    next.every((k, i) => k === entry.selectedTasks[i])
  ) {
    return entry;
  }
  return { ...entry, selectedTasks: next };
}

/**
 * JIRA 인터페이스(동기화) 후 scrum_entries·로컬 캐시의 FWK 키를
 * 최신 jira_tasks(issue_key) 기준으로 정리합니다.
 */
export async function reconcileScrumEntriesWithJiraTasks(
  allTasks: JiraTask[],
  entries: ScrumEntry[]
): Promise<{ entries: ScrumEntry[]; changed: number }> {
  let changed = 0;
  const next = entries.map((e) => {
    const reconciled = reconcileEntryKeys(e, allTasks);
    if (reconciled !== e) changed += 1;
    return reconciled;
  });

  if (changed > 0 && isSupabaseConfigured()) {
    const touched = next.filter((e, i) => e !== entries[i]);
    await Promise.all(
      touched.map((e) =>
        upsertScrumEntryToDb({
          id: e.id,
          date: e.date,
          sprintId: e.sprintId,
          memberId: e.memberId,
          yesterday: e.yesterday,
          today: e.today,
          blockers: e.blockers,
          selectedTasks: e.selectedTasks,
        })
      )
    );
  }

  return { entries: next, changed };
}

/** 멤버 담당 패널 기준 — 현재 JIRA 캐시에 없는 FWK 키 제거 */
export function reconcileMemberSelectedTaskKeys(
  memberId: string,
  selectedTasks: string[]
): string[] {
  const backlog = getMemberActiveAssignedTasks(memberId);
  return sanitizeSelectedTaskKeys(selectedTasks, backlog);
}
