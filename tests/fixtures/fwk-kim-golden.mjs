/**
 * 웹프레임워크 TF 보드 — 김희찬(찬) JIRA 캡처 기준 골든 FWK 이슈
 */

export const KIM_MEMBER_ID = "kim";
export const KIM_MEMBER_NAME = "김희찬";

/** JIRA 백로그 필터 기준 담당 이슈 키 (스프린트 S23·S12 등) */
export const JIRA_KIM_BOARD_KEYS = ["FWK-215", "FWK-220", "FWK-221", "FWK-112", "FWK-227"];

/** @type {readonly { key: string; summary: string; jiraColumn: string; status: string; selectable: boolean }[]} */
export const JIRA_BOARD_KIM_HEECHAN = [
  {
    key: "FWK-215",
    summary: "[사전검토] 로컬 에이전트 프로그램 스터디 / Tool 비교검증",
    jiraColumn: "진행 중",
    status: "IN_PROGRESS",
    selectable: true,
  },
  {
    key: "FWK-220",
    summary: "[개발] 로컬 에이전트 프로그램 개발",
    jiraColumn: "해야 할 일",
    status: "TODO",
    selectable: false,
  },
  {
    key: "FWK-221",
    summary: "[후속] 설치형 프로그램 자동 배포 설계 및 설치",
    jiraColumn: "해야 할 일",
    status: "TODO",
    selectable: false,
  },
  {
    key: "FWK-112",
    summary: "카카오 알림톡 공통 모듈 및 발송 이력 기준 구현",
    jiraColumn: "해야 할 일",
    status: "TODO",
    selectable: false,
  },
  {
    key: "FWK-227",
    summary: "CMS 가상계좌 입금실적 연동 구현",
    jiraColumn: "해야 할 일",
    status: "TODO",
    selectable: false,
  },
];

export const GOLDEN_SPRINT = {
  id: "web-framework-tf-sprint",
  name: "웹프레임워크 TF",
  state: "active",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  goal: "",
};

/** 앱 JiraTask[] (캐시·오프라인 테스트용) */
export function buildKimGoldenTasks() {
  return JIRA_BOARD_KIM_HEECHAN.map((row, i) => ({
    id: `fwk-${row.key}`,
    key: row.key,
    summary: row.summary,
    status: row.status,
    sprintId: row.key.startsWith("FWK-11") || row.key === "FWK-227" ? "jira-sprint-s12" : "jira-sprint-s23",
    assignee: { id: KIM_MEMBER_ID, name: KIM_MEMBER_NAME },
    storyPoints: 0,
    priority: "MEDIUM",
    labels: row.key.startsWith("FWK-21") ? ["REPORT TOOL 도입"] : ["웹프레임워크 아키텍처"],
    updatedAt: "2026-05-21T00:00:00.000Z",
  }));
}

/** Supabase jira_tasks 행 → JiraTask (jira-repository rowToTask와 동일 필드) */
export function dbRowToJiraTask(row) {
  const name = String(row.assignee_name ?? "").trim();
  return {
    id: row.id,
    key: row.issue_key,
    summary: row.summary ?? "",
    status: row.status,
    priority: row.priority ?? "MEDIUM",
    assignee: {
      id: row.assignee_id,
      name: name || "?",
      avatar: (name[0] ?? "?").toUpperCase(),
      role: row.assignee_role ?? "—",
      color: row.assignee_color ?? "#64748b",
    },
    storyPoints: Number(row.story_points) || 0,
    updatedAt: row.updated_at ?? "",
    labels: row.labels ?? [],
    sprintId: row.sprint_id,
    dueDate: row.due_date ?? null,
    createdAt: row.created_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    issueType: row.issue_type ?? "",
    parentIssueKey: row.parent_issue_key ?? null,
    parentId: row.parent_id ?? null,
    isSubtask: Boolean(row.is_subtask),
    jiraStatusName: row.jira_status_name ?? "",
  };
}

export function parseFwkTestKeys(envValue) {
  const raw = (envValue ?? "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);
  }
  return [...JIRA_KIM_BOARD_KEYS];
}
