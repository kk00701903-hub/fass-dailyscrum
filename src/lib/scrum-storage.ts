import type { JiraTask, ScrumEntry } from "@/lib/index";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { upsertDailyReport } from "@/lib/daily-reports-repository";
import { reconcileScrumEntriesWithJiraTasks } from "@/lib/scrum-jira-reconcile";
import { fetchScrumEntriesFromDb, upsertScrumEntryToDb } from "@/lib/supabase/jira-repository";
import {
  fetchMemberSprintsFromDb,
  upsertMemberSprintToDb,
} from "@/lib/supabase/member-sprints-repository";

let supabaseScrumCache: ScrumEntry[] | null = null;
let memberSprintsDbCache: Record<string, string[]> | null = null;

const ENTRIES_KEY = "scrum-daily-entries";
const REGISTERED_SPRINTS_KEY = "scrum-member-registered-sprints";

/** 데일리 스크럼 저장·로컬 동기화 시 발행 — 스크럼 일지 등에서 구독 */
export const SCRUM_ENTRIES_CHANGED_EVENT = "scrum-entries-changed";

let scrumEntriesRevision = 0;

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

/** 담당자별 등록 스프린트 — Supabase → 메모리·localStorage */
export async function hydrateMemberSprintsFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    memberSprintsDbCache = null;
    return;
  }
  try {
    const rows = await fetchMemberSprintsFromDb();
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const list = map[row.memberId] ?? [];
      if (!list.includes(row.sprintId)) list.push(row.sprintId);
      map[row.memberId] = list;
    }
    memberSprintsDbCache = map;

    const local = readRegisteredMap();
    for (const [memberId, ids] of Object.entries(map)) {
      local[memberId] = [...new Set([...(local[memberId] ?? []), ...ids])];
    }
    writeJson(REGISTERED_SPRINTS_KEY, local);
    notifyDataChanged();
  } catch {
    memberSprintsDbCache = null;
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

/**
 * JIRA 동기화 직후 — 저장된 FWK 키를 최신 issue_key 목록에 맞춤 (로컬 + Supabase 캐시).
 */
export async function reconcileScrumHistoryWithJiraTasks(
  tasks: JiraTask[],
  keyMigrations: Map<string, string> = new Map()
): Promise<number> {
  const stored = getStoredScrumEntries();
  const { entries: reconciledStored, changed: storedChanged } =
    await reconcileScrumEntriesWithJiraTasks(tasks, stored, keyMigrations);

  if (storedChanged > 0) {
    writeJson(ENTRIES_KEY, reconciledStored);
  }

  let dbChanged = 0;
  if (supabaseScrumCache) {
    const reconciled = await reconcileScrumEntriesWithJiraTasks(
      tasks,
      supabaseScrumCache,
      keyMigrations
    );
    supabaseScrumCache = reconciled.entries;
    dbChanged = reconciled.changed;
  }

  if (storedChanged > 0 || dbChanged > 0) notifyDataChanged();
  return storedChanged + dbChanged;
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
  const fromDb = memberSprintsDbCache?.[memberId];
  if (fromDb && fromDb.length > 0) return fromDb;
  return readRegisteredMap()[memberId] ?? [];
}

export function getScrumEntriesRevision(): number {
  return scrumEntriesRevision;
}

export function subscribeScrumEntries(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener(SCRUM_ENTRIES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SCRUM_ENTRIES_CHANGED_EVENT, handler);
}

function notifyDataChanged(): void {
  scrumEntriesRevision += 1;
  window.dispatchEvent(new Event("scrum-sprint-prefs-changed"));
  window.dispatchEvent(new Event(SCRUM_ENTRIES_CHANGED_EVENT));
}

export async function registerMemberSprint(
  memberId: string,
  sprintId: string,
  sprintName = ""
): Promise<void> {
  const map = readRegisteredMap();
  const cur = new Set(map[memberId] ?? []);
  cur.add(sprintId);
  map[memberId] = [...cur];
  writeJson(REGISTERED_SPRINTS_KEY, map);

  if (memberSprintsDbCache) {
    memberSprintsDbCache[memberId] = map[memberId]!;
  }

  if (isSupabaseConfigured()) {
    await upsertMemberSprintToDb(memberId, sprintId, sprintName);
  }

  notifyDataChanged();
}

export function unregisterMemberSprint(memberId: string, sprintId: string): void {
  const map = readRegisteredMap();
  map[memberId] = (map[memberId] ?? []).filter((id) => id !== sprintId);
  writeJson(REGISTERED_SPRINTS_KEY, map);
  notifyDataChanged();
}

/** 브라우저에 남은 스크럼 테스트·캐시 데이터 제거 (DB 삭제 후 새로고침 전에 호출) */
export function clearLocalScrumCaches(): void {
  try {
    localStorage.removeItem(ENTRIES_KEY);
    localStorage.removeItem(REGISTERED_SPRINTS_KEY);
  } catch {
    /* ignore */
  }
  supabaseScrumCache = null;
  memberSprintsDbCache = null;
  notifyDataChanged();
}
