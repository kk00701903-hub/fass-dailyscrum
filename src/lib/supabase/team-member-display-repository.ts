import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface TeamMemberDisplayRow {
  memberId: string;
  showScrumHistory: boolean;
  showAnalytics: boolean;
}

interface DbRow {
  member_id: string;
  show_scrum_history: boolean;
  show_analytics: boolean;
}

function rowToDisplay(row: DbRow): TeamMemberDisplayRow {
  return {
    memberId: row.member_id,
    showScrumHistory: row.show_scrum_history,
    showAnalytics: row.show_analytics,
  };
}

export async function fetchTeamMemberDisplayFromDb(): Promise<TeamMemberDisplayRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase()
    .from("team_member_display_settings")
    .select("member_id, show_scrum_history, show_analytics")
    .order("member_id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbRow[] ?? []).map(rowToDisplay);
}

export async function upsertTeamMemberDisplayToDb(
  memberId: string,
  showScrumHistory: boolean,
  showAnalytics: boolean
): Promise<TeamMemberDisplayRow> {
  const { data, error } = await getSupabase()
    .from("team_member_display_settings")
    .upsert(
      {
        member_id: memberId,
        show_scrum_history: showScrumHistory,
        show_analytics: showAnalytics,
      },
      { onConflict: "member_id" }
    )
    .select("member_id, show_scrum_history, show_analytics")
    .single();

  if (error) throw new Error(error.message);
  return rowToDisplay(data as DbRow);
}
