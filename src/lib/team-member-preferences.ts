import { TEAM_MEMBERS, type TeamMember } from "@/lib/index";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchTeamMemberDisplayFromDb,
  upsertTeamMemberDisplayToDb,
} from "@/lib/supabase/team-member-display-repository";

export const TEAM_MEMBER_PREFS_EVENT = "team-member-prefs-changed";

const STORAGE_KEY = "scrum-team-member-prefs";

export interface TeamMemberPrefs {
  scrumHistory: Record<string, boolean>;
  analytics: Record<string, boolean>;
}

/** Supabase hydrate 후 메모리 캐시 (팀 공통 설정) */
let remotePrefs: TeamMemberPrefs | null = null;

function defaultPrefs(): TeamMemberPrefs {
  const scrumHistory: Record<string, boolean> = {};
  const analytics: Record<string, boolean> = {};
  for (const m of TEAM_MEMBERS) {
    if (m.id === "seo") {
      scrumHistory[m.id] = false;
      analytics[m.id] = false;
    } else {
      scrumHistory[m.id] = true;
      analytics[m.id] = true;
    }
  }
  return { scrumHistory, analytics };
}

function mergePrefsFromRows(
  base: TeamMemberPrefs,
  rows: { memberId: string; showScrumHistory: boolean; showAnalytics: boolean }[]
): TeamMemberPrefs {
  const next = {
    scrumHistory: { ...base.scrumHistory },
    analytics: { ...base.analytics },
  };
  for (const row of rows) {
    if (!TEAM_MEMBERS.some((m) => m.id === row.memberId)) continue;
    next.scrumHistory[row.memberId] = row.showScrumHistory;
    next.analytics[row.memberId] = row.showAnalytics;
  }
  return next;
}

function readLocalPrefs(): TeamMemberPrefs {
  const base = defaultPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<TeamMemberPrefs>;
    for (const m of TEAM_MEMBERS) {
      if (typeof parsed.scrumHistory?.[m.id] === "boolean") {
        base.scrumHistory[m.id] = parsed.scrumHistory[m.id]!;
      }
      if (typeof parsed.analytics?.[m.id] === "boolean") {
        base.analytics[m.id] = parsed.analytics[m.id]!;
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

function readPrefs(): TeamMemberPrefs {
  if (remotePrefs) return remotePrefs;
  return readLocalPrefs();
}

function writeLocalPrefs(prefs: TeamMemberPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function applyPrefs(prefs: TeamMemberPrefs): void {
  remotePrefs = prefs;
  writeLocalPrefs(prefs);
  invalidateMemberListCaches();
  window.dispatchEvent(new Event(TEAM_MEMBER_PREFS_EVENT));
}

function writePrefs(prefs: TeamMemberPrefs): void {
  applyPrefs(prefs);
}

/** Supabase → 팀 공통 팀 구성 설정 (설정 화면·앱 시작 시 호출) */
export async function hydrateTeamMemberPrefsFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    remotePrefs = null;
    return;
  }
  try {
    const rows = await fetchTeamMemberDisplayFromDb();
    if (rows.length === 0) {
      remotePrefs = null;
      return;
    }
    const merged = mergePrefsFromRows(defaultPrefs(), rows);
    applyPrefs(merged);
  } catch {
    remotePrefs = null;
  }
}

async function persistMemberToSupabase(memberId: string, prefs: TeamMemberPrefs): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const scrumValue = prefs.scrumHistory[memberId];
    const analyticsValue = prefs.analytics[memberId];
    await upsertTeamMemberDisplayToDb(
      memberId,
      memberId === "seo" ? scrumValue === true : scrumValue !== false,
      memberId === "seo" ? analyticsValue === true : analyticsValue !== false
    );
  } catch {
    /* localStorage·메모리는 유지 */
  }
}

/** useSyncExternalStore: getSnapshot 은 참조가 안정적이어야 함 */
let prefsCache: TeamMemberPrefs | null = null;
let prefsCacheKey = "";
let scrumMembersCache: TeamMember[] | null = null;
let scrumMembersCacheKey = "";
let analyticsMembersCache: TeamMember[] | null = null;
let analyticsMembersCacheKey = "";

function invalidateMemberListCaches(): void {
  prefsCache = null;
  prefsCacheKey = "";
  scrumMembersCache = null;
  scrumMembersCacheKey = "";
  analyticsMembersCache = null;
  analyticsMembersCacheKey = "";
}

function memberListKey(prefs: TeamMemberPrefs, field: "scrumHistory" | "analytics"): string {
  return TEAM_MEMBERS.map((m) => {
    const value = prefs[field][m.id];
    if (m.id === "seo") return value === true ? "1" : "0";
    return value !== false ? "1" : "0";
  }).join("");
}

export function getTeamMemberPrefs(): TeamMemberPrefs {
  const next = readPrefs();
  const key = JSON.stringify(next);
  if (prefsCache && prefsCacheKey === key) return prefsCache;
  prefsCacheKey = key;
  prefsCache = next;
  return prefsCache;
}

export function isMemberInScrumHistory(memberId: string): boolean {
  const value = readPrefs().scrumHistory[memberId];
  if (memberId === "seo") return value === true;
  return value !== false;
}

export function isMemberInAnalytics(memberId: string): boolean {
  const value = readPrefs().analytics[memberId];
  if (memberId === "seo") return value === true;
  return value !== false;
}

export function setMemberScrumHistoryIncluded(memberId: string, included: boolean): void {
  const prefs = readPrefs();
  prefs.scrumHistory[memberId] = included;
  writePrefs(prefs);
  void persistMemberToSupabase(memberId, prefs);
}

export function setMemberAnalyticsIncluded(memberId: string, included: boolean): void {
  const prefs = readPrefs();
  prefs.analytics[memberId] = included;
  writePrefs(prefs);
  void persistMemberToSupabase(memberId, prefs);
}

export function getMembersForScrumHistory(): TeamMember[] {
  const prefs = getTeamMemberPrefs();
  const key = memberListKey(prefs, "scrumHistory");
  if (scrumMembersCache && scrumMembersCacheKey === key) return scrumMembersCache;
  scrumMembersCacheKey = key;
  scrumMembersCache = TEAM_MEMBERS.filter((m) => {
    const value = prefs.scrumHistory[m.id];
    if (m.id === "seo") return value === true;
    return value !== false;
  });
  return scrumMembersCache;
}

export function getMembersForAnalytics(): TeamMember[] {
  const prefs = getTeamMemberPrefs();
  const key = memberListKey(prefs, "analytics");
  if (analyticsMembersCache && analyticsMembersCacheKey === key) return analyticsMembersCache;
  analyticsMembersCacheKey = key;
  analyticsMembersCache = TEAM_MEMBERS.filter((m) => {
    const value = prefs.analytics[m.id];
    if (m.id === "seo") return value === true;
    return value !== false;
  });
  return analyticsMembersCache;
}
