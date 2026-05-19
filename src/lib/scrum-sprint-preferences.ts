import { getActiveJiraSprints, getActiveJiraTasks } from "@/lib/jira-data-registry";
import { getMemberRegisteredSprintIds } from "@/lib/scrum-storage";

const SPRINT_STATE_ORDER: Record<string, number> = { active: 0, future: 1, closed: 2 };

export const SCRUM_SPRINT_PREFS_EVENT = "scrum-sprint-prefs-changed";

const TEAM_ACTIVE_KEY = "scrum-team-active-sprint-id";
const MEMBER_FOCUS_KEY = "scrum-member-sprint-focus";

function defaultActiveSprintId(): string {
  const sprints = getActiveJiraSprints();
  return sprints.find((s) => s.state === "active")?.id ?? sprints[0]?.id ?? "";
}

function sprintExists(sprintId: string): boolean {
  return getActiveJiraSprints().some((s) => s.id === sprintId);
}

/** 대시보드·기본값 등에 쓰는 팀 단위 “현재 진행 스프린트” */
export function getTeamActiveSprintId(): string {
  try {
    const v = localStorage.getItem(TEAM_ACTIVE_KEY)?.trim();
    if (v && sprintExists(v)) return v;
  } catch {
    /* ignore */
  }
  return defaultActiveSprintId();
}

export function setTeamActiveSprintId(sprintId: string): void {
  try {
    localStorage.setItem(TEAM_ACTIVE_KEY, sprintId);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SCRUM_SPRINT_PREFS_EVENT));
}

function readMemberFocusMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MEMBER_FOCUS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMemberFocusMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(MEMBER_FOCUS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SCRUM_SPRINT_PREFS_EVENT));
}

/** 담당자가 스크럼 작성 시 기준으로 삼는 스프린트 (멤버별 저장 > 배정 스프린트 순 > 팀 기본) */
export function getMemberSprintFocus(memberId: string): string {
  const map = readMemberFocusMap();
  if (map[memberId] && sprintExists(map[memberId]!)) return map[memberId]!;

  const sprintIds = collectMemberSprintIds(memberId);
  const ordered = getActiveJiraSprints()
    .filter((s) => sprintIds.has(s.id))
    .sort((a, b) => (SPRINT_STATE_ORDER[a.state] ?? 9) - (SPRINT_STATE_ORDER[b.state] ?? 9));
  if (ordered.length > 0) return ordered[0]!.id;

  return getTeamActiveSprintId();
}

export function setMemberSprintFocus(memberId: string, sprintId: string): void {
  const map = readMemberFocusMap();
  map[memberId] = sprintId;
  writeMemberFocusMap(map);
}

function collectMemberSprintIds(memberId: string): Set<string> {
  const ids = new Set(getMemberRegisteredSprintIds(memberId));
  for (const t of getActiveJiraTasks()) {
    if (t.assignee.id === memberId) ids.add(t.sprintId);
  }
  return ids;
}

/** 등록 스프린트 + 배정 백로그가 있는 스프린트 (진행 중 우선) */
export function getSprintsForMember(memberId: string) {
  const ids = collectMemberSprintIds(memberId);
  return getActiveJiraSprints()
    .filter((s) => ids.has(s.id))
    .sort((a, b) => (SPRINT_STATE_ORDER[a.state] ?? 9) - (SPRINT_STATE_ORDER[b.state] ?? 9));
}

/** 스프린트 등록용: 아직 등록되지 않은 스프린트 */
export function getSprintsAvailableToRegister(memberId: string) {
  const registered = new Set(getMemberRegisteredSprintIds(memberId));
  return getActiveJiraSprints().filter((s) => !registered.has(s.id));
}

/** 진행 중 스프린트만 (팀 기본 저장용 필터) */
export function getInProgressSprints() {
  return getActiveJiraSprints().filter((s) => s.state === "active");
}
