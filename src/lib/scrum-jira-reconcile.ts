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

/** FWK-164 → FWK-220 (동일 jira_issue_id) 스크럼 선택 키 갱신 */
export function migrateSelectedTaskKeys(
  selectedTasks: string[],
  keyMigrations: Map<string, string>
): string[] {
  if (keyMigrations.size === 0) return selectedTasks;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of selectedTasks) {
    const next = keyMigrations.get(key) ?? key;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function reconcileEntryKeys(
  entry: ScrumEntry,
  allTasks: JiraTask[],
  keyMigrations: Map<string, string>
): ScrumEntry {
  const backlog = allTasks.filter(
    (t) => taskIsAssignedToMember(t, entry.memberId) && t.status !== "DONE"
  );
  const migrated = migrateSelectedTaskKeys(entry.selectedTasks, keyMigrations);
  const next = sanitizeSelectedTaskKeys(migrated, backlog);
  if (
    next.length === entry.selectedTasks.length &&
    next.every((k, i) => k === entry.selectedTasks[i])
  ) {
    return entry;
  }
  return { ...entry, selectedTasks: next };
}

/**
 * JIRA 동기화 후 scrum_entries·로컬 캐시 정리
 * - 고스트 FWK 키 제거
 * - 동일 jira_issue_id 의 issue_key 변경 반영
 */
export async function reconcileScrumEntriesWithJiraTasks(
  allTasks: JiraTask[],
  entries: ScrumEntry[],
  keyMigrations: Map<string, string> = new Map()
): Promise<{ entries: ScrumEntry[]; changed: number }> {
  let changed = 0;
  const next = entries.map((e) => {
    const reconciled = reconcileEntryKeys(e, allTasks, keyMigrations);
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
  selectedTasks: string[],
  keyMigrations: Map<string, string> = new Map()
): string[] {
  const backlog = getMemberActiveAssignedTasks(memberId);
  const migrated = migrateSelectedTaskKeys(selectedTasks, keyMigrations);
  return sanitizeSelectedTaskKeys(migrated, backlog);
}
