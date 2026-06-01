/** JIRA Agile sprint id → jira_tasks.sprint_id 와 동일한 키 */
export function toJiraSprintLinkId(jiraSprintNumericId: number): string {
  return `jira-sprint-${jiraSprintNumericId}`;
}

/** 보드 백로그 이슈용 sprint_id (스프린트 미배정) */
export const JIRA_BACKLOG_SPRINT_ID = "jira-backlog";

export interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export interface JiraSprintUpsertRow {
  id: string;
  sprint_name: string;
  status: string;
  remaining_days: number;
  jira_sprint_id: string;
  start_date: string | null;
  end_date: string | null;
}

export function statusLabel(state: string): string {
  if (state === "active") return "진행 중";
  if (state === "closed") return "종료";
  if (state === "future") return "예정";
  return state;
}

export function remainingDays(endDate?: string): number {
  if (!endDate) return 0;
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

function sliceDate(iso?: string): string | null {
  if (!iso?.trim()) return null;
  return iso.slice(0, 10);
}

export function mapApiSprintToUpsertRow(sp: JiraSprintApiValue): JiraSprintUpsertRow {
  const sprintId = toJiraSprintLinkId(sp.id);
  return {
    id: sprintId,
    sprint_name: sp.name,
    status: statusLabel(sp.state),
    remaining_days: remainingDays(sp.endDate),
    jira_sprint_id: sprintId,
    start_date: sliceDate(sp.startDate),
    end_date: sliceDate(sp.endDate),
  };
}
