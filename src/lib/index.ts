// ─── Routes ───────────────────────────────────────────────────────────────────
export const ROUTES = {
  DASHBOARD: "/",
  JIRA_SYNC: "/jira",
  DAILY_SCRUM: "/scrum",
  SCRUM_HISTORY: "/scrum/history",
  ANALYTICS: "/analytics",
  SETTINGS: "/settings",
  UI_PREVIEW: "/ui-preview",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type Priority = "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST";

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  color: string;
}

export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  status: TaskStatus;
  priority: Priority;
  assignee: TeamMember;
  storyPoints: number;
  updatedAt: string;
  labels: string[];
  /** 스프린트 보드 기준 소속 스프린트 */
  sprintId: string;
  dueDate?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  issueType?: string;
  parentIssueKey?: string | null;
  parentId?: string | null;
  isSubtask?: boolean;
  jiraStatusName?: string;
}

export interface Sprint {
  id: string;
  name: string;
  state: "active" | "closed" | "future";
  startDate: string;
  endDate: string;
  goal: string;
}

export interface ScrumEntry {
  id: string;
  date: string;
  sprintId: string;
  memberId: string;
  yesterday: string;
  today: string;
  blockers: string;
  selectedTasks: string[];
}

export interface Blocker {
  id: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  reportedBy: TeamMember;
  reportedAt: string;
  status: "open" | "in_progress" | "resolved";
  relatedTask?: string;
}

export interface MetricCard {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "up" | "down";
  unit?: string;
  description?: string;
}

// ─── Team Members ──────────────────────────────────────────────────────────────
export const TEAM_MEMBERS: TeamMember[] = [
  { id: "seo", name: "서선범", avatar: "서", role: "TFT 팀장", color: "#f59e0b" },
  { id: "ki", name: "기충영", avatar: "기", role: "PL", color: "#22d3ee" },
  { id: "kim", name: "김희찬", avatar: "김", role: "Backend", color: "#60a5fa" },
  { id: "song", name: "송민준", avatar: "송", role: "Backend", color: "#a78bfa" },
  { id: "shim", name: "심지훈", avatar: "심", role: "Frontend", color: "#34d399" },
  { id: "oh", name: "오준열", avatar: "오", role: "Frontend", color: "#fb923c" },
  { id: "lee", name: "이지상", avatar: "이", role: "Frontend", color: "#f87171" },
];

export function getTeamMember(id: string): TeamMember {
  return TEAM_MEMBERS.find((m) => m.id === id) ?? TEAM_MEMBERS[0]!;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  TODO: { label: "할 일", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  IN_PROGRESS: { label: "진행 중", color: "#22d3ee", bg: "rgba(34,211,238,0.15)" },
  IN_REVIEW: { label: "검토 중", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  DONE: { label: "완료", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  BLOCKED: { label: "블로커", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; color: string }> = {
  HIGHEST: { label: "최긴급", icon: "↑↑", color: "#ef4444" },
  HIGH: { label: "높음", icon: "↑", color: "#f97316" },
  MEDIUM: { label: "중간", icon: "→", color: "#eab308" },
  LOW: { label: "낮음", icon: "↓", color: "#22c55e" },
  LOWEST: { label: "최저", icon: "↓↓", color: "#64748b" },
};
