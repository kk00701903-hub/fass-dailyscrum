import { getActiveJiraSprints, getActiveJiraTasks } from "@/lib/jira-data-registry";
import { compareSprintNamesByNumber } from "@/lib/jira-sprint-sort";
import { getMemberActiveBacklog, taskIsAssignedToMember } from "@/lib/scrum-backlog";
import { DAILY_SCRUM_MEMBERS, type Sprint } from "@/lib/index";
import { getMemberRegisteredSprintIds } from "@/lib/scrum-storage";

const SPRINT_STATE_ORDER: Record<string, number> = { active: 0, future: 1, closed: 2 };

export const SCRUM_SPRINT_PREFS_EVENT = "scrum-sprint-prefs-changed";

const TEAM_ACTIVE_KEY = "scrum-team-active-sprint-id";
const MEMBER_FOCUS_KEY = "scrum-member-sprint-focus";
const MEMBER_SIDEBAR_ACTIVE_KEY = "scrum-member-sidebar-active-sprint-id";

function memberHasSprintActivity(memberId: string, sprintId: string): boolean {
  if (getMemberRegisteredSprintIds(memberId).includes(sprintId)) return true;
  return getActiveJiraTasks().some(
    (t) => t.sprintId === sprintId && taskIsAssignedToMember(t, memberId)
  );
}

/** JIRA active 중 데일리 스크럼 멤버가 등록·배정 이슈를 갖는 스프린트 (사이드바·팀 기본값) */
export function getTeamSidebarSprints(): Sprint[] {
  const active = getInProgressSprints();
  const memberIds = DAILY_SCRUM_MEMBERS.map((m) => m.id);
  const withTeamWork = active.filter((s) =>
    memberIds.some((mid) => memberHasSprintActivity(mid, s.id))
  );
  return sortSprintsByNumberAndState(withTeamWork);
}

/** 사이드바: 로그인 담당자 본인의 진행 중 스프린트 (등록·배정 이슈 기준) */
export function getMemberSidebarSprints(memberId: string): Sprint[] {
  if (!memberId.trim()) return [];
  const active = getInProgressSprints();
  const mine = active.filter((s) => memberHasSprintActivity(memberId, s.id));
  return sortSprintsByNumberAndState(mine);
}

function readMemberSidebarActiveMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MEMBER_SIDEBAR_ACTIVE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMemberSidebarActiveMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(MEMBER_SIDEBAR_ACTIVE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SCRUM_SPRINT_PREFS_EVENT));
}

/** 사이드바 캐러셀에서 보는 스프린트 (멤버별 저장 > 포커스 > 목록 첫 항목) */
export function getMemberSidebarActiveSprintId(memberId: string): string {
  const sidebar = getMemberSidebarSprints(memberId);
  const sidebarIds = new Set(sidebar.map((s) => s.id));
  if (sidebarIds.size === 0) return "";

  const map = readMemberSidebarActiveMap();
  const stored = map[memberId]?.trim();
  if (stored && sprintExists(stored) && sidebarIds.has(stored)) return stored;

  const focus = getMemberSprintFocus(memberId);
  if (focus && sidebarIds.has(focus)) return focus;

  return sidebar[0]!.id;
}

export function setMemberSidebarActiveSprintId(memberId: string, sprintId: string): void {
  if (!memberId.trim()) return;
  const map = readMemberSidebarActiveMap();
  map[memberId] = sprintId;
  writeMemberSidebarActiveMap(map);
}

function defaultActiveSprintId(): string {
  return getTeamSidebarSprints()[0]?.id ?? "";
}

function sprintExists(sprintId: string): boolean {
  return getActiveJiraSprints().some((s) => s.id === sprintId);
}

/** 대시보드·기본값 등에 쓰는 팀 단위 “현재 진행 스프린트” */
export function getTeamActiveSprintId(): string {
  const sidebarIds = new Set(getTeamSidebarSprints().map((s) => s.id));
  try {
    const v = localStorage.getItem(TEAM_ACTIVE_KEY)?.trim();
    if (v && sprintExists(v) && (sidebarIds.size === 0 || sidebarIds.has(v))) return v;
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

  return "";
}

export function setMemberSprintFocus(memberId: string, sprintId: string): void {
  const map = readMemberFocusMap();
  map[memberId] = sprintId;
  writeMemberFocusMap(map);
}

function collectMemberSprintIds(memberId: string): Set<string> {
  const ids = new Set(getMemberRegisteredSprintIds(memberId));
  for (const t of getActiveJiraTasks()) {
    if (taskIsAssignedToMember(t, memberId)) ids.add(t.sprintId);
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

function sortSprintsByNumberAndState(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => {
    const byNum = compareSprintNamesByNumber(a.name, b.name);
    if (byNum !== 0) return byNum;
    return (SPRINT_STATE_ORDER[a.state] ?? 9) - (SPRINT_STATE_ORDER[b.state] ?? 9);
  });
}

/** 담당자가 등록한 스프린트만 (번호순) */
export function getRegisteredSprintsForMember(memberId: string): Sprint[] {
  const registered = new Set(getMemberRegisteredSprintIds(memberId));
  return sortSprintsByNumberAndState(getActiveJiraSprints().filter((s) => registered.has(s.id)));
}

/** 데일리 스크럼 좌측 패널: 담당자가 등록한 스프린트만 */
export function getBacklogSprintsForMember(memberId: string): Sprint[] {
  return getRegisteredSprintsForMember(memberId);
}

/** 데일리 스크럼 좌측 목록: 전체 스프린트 (등록 전 첫 선택용) */
export function getDailyScrumPanelSprints(): Sprint[] {
  return sortSprintsByNumberAndState(getActiveJiraSprints());
}

/** 저장된 스프린트가 있으면 그것만, 없으면 전체 목록(첫 저장 전) */
export function getDailyScrumVisibleSprints(memberId: string): Sprint[] {
  const registered = getRegisteredSprintsForMember(memberId);
  if (registered.length > 0) return registered;
  return getDailyScrumPanelSprints();
}

export function memberHasRegisteredSprints(memberId: string): boolean {
  return getMemberRegisteredSprintIds(memberId).length > 0;
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

/** 데일리 스크럼 좌측: 담당 진행 중 이슈가 있는 스프린트만 (없으면 active 스프린트) */
export function getDailyScrumBacklogSprints(memberId: string): Sprint[] {
  const registered = getRegisteredSprintsForMember(memberId);
  const pool =
    registered.length > 0
      ? registered
      : sortSprintsByNumberAndState(getActiveJiraSprints().filter((s) => s.state === "active"));

  const withTasks = pool.filter((s) => getMemberActiveBacklog(memberId, s.id).length > 0);
  if (withTasks.length > 0) return sortSprintsByNumberAndState(withTasks);

  const activeSprints = sortSprintsByNumberAndState(
    getActiveJiraSprints().filter((s) => s.state === "active")
  );
  if (activeSprints.length > 0) return activeSprints;

  return sortSprintsByNumberAndState(getActiveJiraSprints()).slice(0, 1);
}
