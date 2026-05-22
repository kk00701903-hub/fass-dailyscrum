import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface MemberSprintRow {
  memberId: string;
  sprintId: string;
  sprintName: string;
}

interface DbRow {
  member_id: string;
  sprint_id: string;
  sprint_name: string;
}

function rowToMemberSprint(row: DbRow): MemberSprintRow {
  return {
    memberId: row.member_id,
    sprintId: row.sprint_id,
    sprintName: row.sprint_name ?? "",
  };
}

export async function fetchMemberSprintsFromDb(memberId?: string): Promise<MemberSprintRow[]> {
  if (!isSupabaseConfigured()) return [];

  let query = getSupabase()
    .from("scrum_member_sprints")
    .select("member_id, sprint_id, sprint_name")
    .order("created_at", { ascending: true });

  if (memberId) {
    query = query.eq("member_id", memberId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as DbRow[] ?? []).map(rowToMemberSprint);
}

export async function upsertMemberSprintToDb(
  memberId: string,
  sprintId: string,
  sprintName: string
): Promise<MemberSprintRow> {
  const { data, error } = await getSupabase()
    .from("scrum_member_sprints")
    .upsert(
      {
        member_id: memberId,
        sprint_id: sprintId,
        sprint_name: sprintName,
      },
      { onConflict: "member_id,sprint_id" }
    )
    .select("member_id, sprint_id, sprint_name")
    .single();

  if (error) throw new Error(error.message);
  return rowToMemberSprint(data as DbRow);
}
