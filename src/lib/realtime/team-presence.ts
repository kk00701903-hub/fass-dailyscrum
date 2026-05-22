/** Supabase Realtime Presence 채널 (DB 마이그레이션 불필요 — 프로젝트 Realtime 활성화만 필요) */
export const TEAM_PRESENCE_CHANNEL = "online-users";

export interface TeamPresencePayload {
  user_id: string;
  login_id: string;
  member_id: string;
  display_name: string;
  name: string;
  avatar: string;
  online_at: string;
}

export function parseOnlineMemberIds(
  state: Record<string, TeamPresencePayload[]>
): Set<string> {
  const ids = new Set<string>();
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p?.member_id) ids.add(p.member_id);
    }
  }
  return ids;
}

export function parseOnlineUsers(
  state: Record<string, TeamPresencePayload[]>
): TeamPresencePayload[] {
  const byMember = new Map<string, TeamPresencePayload>();
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p?.member_id && !byMember.has(p.member_id)) {
        byMember.set(p.member_id, p);
      }
    }
  }
  return [...byMember.values()];
}
