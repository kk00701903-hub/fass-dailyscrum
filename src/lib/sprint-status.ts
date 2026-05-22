import type { Sprint } from "@/lib/index";

/** JIRA·DB의 status/state 문자열을 Sprint.state 로 통일 (한글·영문) */
export function normalizeSprintState(raw: string | null | undefined): Sprint["state"] {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "future";
  if (s === "closed" || s.includes("종료") || s.includes("complete")) return "closed";
  if (s === "active" || s.includes("진행") || s.includes("active")) return "active";
  if (s === "future" || s.includes("예정")) return "future";
  return "future";
}

export function jiraSprintRowToSprint(row: {
  id?: string;
  jira_sprint_id?: string | null;
  sprint_name: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
}): Sprint {
  const sliceDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "—");
  return {
    id: row.jira_sprint_id ?? row.id ?? row.sprint_name,
    name: row.sprint_name,
    state: normalizeSprintState(row.status),
    startDate: sliceDate(row.start_date),
    endDate: sliceDate(row.end_date),
    goal: "",
  };
}
