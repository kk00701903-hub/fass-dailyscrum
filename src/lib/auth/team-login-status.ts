import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { JIRA_SYNC_TIMEZONE } from "@/lib/jira-sync-schedule";
import { TEAM_MEMBERS } from "@/lib/index";

export interface TeamMemberLoginStatus {
  memberId: string;
  registered: boolean;
  loginId: string | null;
  lastLoginAt: string | null;
  registeredAt: string | null;
}

interface LoginStatusRow {
  member_id: string;
  registered: boolean;
  login_id?: string;
  last_login_at?: string | null;
  registered_at?: string | null;
}

export function formatLoginTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: JIRA_SYNC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace("T", " ");
}

export async function fetchTeamMemberLoginStatus(): Promise<TeamMemberLoginStatus[]> {
  if (!isSupabaseConfigured()) {
    return TEAM_MEMBERS.map((m) => ({
      memberId: m.id,
      registered: false,
      loginId: null,
      lastLoginAt: null,
      registeredAt: null,
    }));
  }

  const { data, error } = await getSupabase().rpc("list_team_member_login_status");
  if (error) throw new Error(error.message);

  const rows = (Array.isArray(data) ? data : []) as LoginStatusRow[];
  const byMember = new Map<string, LoginStatusRow>();
  for (const row of rows) {
    if (row.member_id) byMember.set(row.member_id, row);
  }

  return TEAM_MEMBERS.map((m) => {
    const row = byMember.get(m.id);
    if (!row?.registered) {
      return {
        memberId: m.id,
        registered: false,
        loginId: null,
        lastLoginAt: null,
        registeredAt: null,
      };
    }
    return {
      memberId: m.id,
      registered: true,
      loginId: row.login_id ?? null,
      lastLoginAt: row.last_login_at ?? null,
      registeredAt: row.registered_at ?? null,
    };
  });
}

export function loginStatusLabel(status: TeamMemberLoginStatus): string {
  if (!status.registered) return "미가입";
  if (!status.lastLoginAt) return "가입됨 · 로그인 이력 없음";
  return `로그인 ${formatLoginTimestamp(status.lastLoginAt)}`;
}
