import type { ScrumEntry } from "@/lib/index";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { upsertDailyReport } from "@/lib/daily-reports-repository";
import { fetchScrumEntriesFromDb, upsertScrumEntryToDb } from "@/lib/supabase/jira-repository";

let supabaseScrumCache: ScrumEntry[] | null = null;

const ENTRIES_KEY = "scrum-daily-entries";
const REGISTERED_SPRINTS_KEY = "scrum-member-registered-sprints";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getStoredScrumEntries(): ScrumEntry[] {
  return readJson<ScrumEntry[]>(ENTRIES_KEY, []);
}

export async function hydrateScrumHistoryFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    supabaseScrumCache = null;
    return;
  }
  try {
    supabaseScrumCache = await fetchScrumEntriesFromDb();
    notifyDataChanged();
  } catch {
    supabaseScrumCache = null;
  }
}

/** localStorage + Supabase (동일 키는 앞쪽 우선) */
export function getAllScrumHistory(): ScrumEntry[] {
  const stored = getStoredScrumEntries();
  const fromDb = supabaseScrumCache ?? [];
  const merged = [...stored];
  const keys = new Set(merged.map(entryKey));
  for (const e of fromDb) {
    if (!keys.has(entryKey(e))) merged.push(e);
  }
  return merged;
}

function entryKey(e: Pick<ScrumEntry, "date" | "memberId" | "sprintId">): string {
  return `${e.date}::${e.memberId}::${e.sprintId}`;
}

export function findScrumEntry(
  date: string,
  memberId: string,
  sprintId: string
): ScrumEntry | undefined {
  return getAllScrumHistory().find(
    (e) => e.date === date && e.memberId === memberId && e.sprintId === sprintId
  );
}

export async function saveScrumEntry(
  payload: Omit<ScrumEntry, "id"> & {
    id?: string;
    isCompleted?: boolean;
  }
): Promise<ScrumEntry> {
  let entry: ScrumEntry = {
    id: payload.id ?? `local-${Date.now()}`,
    date: payload.date,
    sprintId: payload.sprintId,
    memberId: payload.memberId,
    yesterday: payload.yesterday,
    today: payload.today,
    blockers: payload.blockers,
    selectedTasks: payload.selectedTasks,
  };

  if (isSupabaseConfigured()) {
    try {
      await upsertDailyReport({
        memberId: payload.memberId,
        reportDate: payload.date,
        yesterday: payload.yesterday,
        today: payload.today,
        blockers: payload.blockers,
        isCompleted: payload.isCompleted ?? false,
      });
      entry = await upsertScrumEntryToDb(entry);
      if (supabaseScrumCache) {
        const k = entryKey(entry);
        supabaseScrumCache = [...supabaseScrumCache.filter((e) => entryKey(e) !== k), entry];
      } else {
        await hydrateScrumHistoryFromSupabase();
      }
    } catch {
      /* local fallback */
    }
  }

  const list = getStoredScrumEntries().filter((e) => entryKey(e) !== entryKey(entry));
  list.push(entry);
  writeJson(ENTRIES_KEY, list);
  notifyDataChanged();
  return entry;
}

// ─── 담당자별 등록 스프린트 ───────────────────────────────────────────────────

function readRegisteredMap(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(REGISTERED_SPRINTS_KEY, {});
}

export function getMemberRegisteredSprintIds(memberId: string): string[] {
  return readRegisteredMap()[memberId] ?? [];
}

function notifyDataChanged(): void {
  window.dispatchEvent(new Event("scrum-sprint-prefs-changed"));
  window.dispatchEvent(new Event("scrum-entries-changed"));
}

export function registerMemberSprint(memberId: string, sprintId: string): void {
  const map = readRegisteredMap();
  const cur = new Set(map[memberId] ?? []);
  cur.add(sprintId);
  map[memberId] = [...cur];
  writeJson(REGISTERED_SPRINTS_KEY, map);
  notifyDataChanged();
}

export function unregisterMemberSprint(memberId: string, sprintId: string): void {
  const map = readRegisteredMap();
  map[memberId] = (map[memberId] ?? []).filter((id) => id !== sprintId);
  writeJson(REGISTERED_SPRINTS_KEY, map);
  notifyDataChanged();
}
