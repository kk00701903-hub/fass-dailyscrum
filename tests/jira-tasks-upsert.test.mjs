/**
 * JIRA issue.id 기준 upsert · DELETE · issue_key 마이그레이션
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIssueKeyMigrationMap,
  prepareJiraTaskRowsForUpsert,
  sortJiraTasksParentsFirst,
  toJiraTaskDbPayload,
} from "../src/lib/jira-tasks-upsert.ts";

test("prepareJiraTaskRowsForUpsert: jira_issue_id = id, issue_key 갱신", () => {
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "10001",
      issue_key: "FWK-220",
      sprint_id: "s1",
      summary: "new title",
      status: "TODO",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김희찬",
      assignee_role: "Backend",
      assignee_color: "#60a5fa",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Task",
      parent_issue_key: null,
      parent_id: null,
      is_subtask: false,
      jira_status_name: "해야 할 일",
    },
  ]);

  assert.equal(rows[0].jira_issue_id, "10001");
  assert.equal(rows[0].id, "10001");
  assert.equal(rows[0].issue_key, "FWK-220");
});

test("prepareJiraTaskRowsForUpsert: parent_id from parent_jira_issue_id", () => {
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "p1",
      issue_key: "FWK-1",
      sprint_id: "s1",
      summary: "parent",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김",
      assignee_role: "—",
      assignee_color: "#000",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Task",
      parent_issue_key: null,
      parent_jira_issue_id: null,
      parent_id: null,
      is_subtask: false,
      jira_status_name: "진행 중",
    },
    {
      id: "c1",
      issue_key: "FWK-2",
      sprint_id: "s1",
      summary: "child",
      status: "TODO",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김",
      assignee_role: "—",
      assignee_color: "#000",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Sub-task",
      parent_issue_key: "FWK-OLD-PARENT",
      parent_jira_issue_id: "p1",
      parent_id: null,
      is_subtask: true,
      jira_status_name: "해야 할 일",
    },
  ]);

  assert.equal(rows[1].parent_id, "p1");
});

test("buildIssueKeyMigrationMap: FWK-164 → FWK-220 same jira id", () => {
  const before = new Map([["10001", "FWK-164"]]);
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "10001",
      issue_key: "FWK-220",
      sprint_id: "s1",
      summary: "x",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김",
      assignee_role: "—",
      assignee_color: "#000",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Task",
      parent_issue_key: null,
      parent_id: null,
      is_subtask: false,
      jira_status_name: "진행 중",
    },
  ]);
  const migrations = buildIssueKeyMigrationMap(before, rows);
  assert.equal(migrations.get("FWK-164"), "FWK-220");
});

test("prepareJiraTaskRowsForUpsert: 보드 밖 parent_id 는 null", () => {
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "child",
      issue_key: "FWK-C",
      sprint_id: "s1",
      summary: "sub",
      status: "TODO",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김",
      assignee_role: "—",
      assignee_color: "#000",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Sub-task",
      parent_issue_key: "FWK-OUT",
      parent_jira_issue_id: "99999",
      parent_id: "stale-old-id",
      is_subtask: true,
      jira_status_name: "",
    },
  ]);
  assert.equal(rows[0].parent_id, null);
});

test("sortJiraTasksParentsFirst: 부모가 자식보다 앞", () => {
  const mk = (id, parentId) => ({
    id,
    jira_issue_id: id,
    issue_key: id,
    sprint_id: "s1",
    summary: "x",
    status: "TODO",
    priority: "MEDIUM",
    assignee_id: "kim",
    assignee_name: "김",
    assignee_role: "—",
    assignee_color: "#000",
    story_points: 0,
    updated_at: "2026-01-01T00:00:00Z",
    labels: [],
    synced_at: "2026-05-21T00:00:00Z",
    assignee_account_id: null,
    assignee_email: null,
    due_date: null,
    start_date: null,
    created_at: null,
    resolved_at: null,
    issue_type: "Task",
    parent_issue_key: null,
    parent_id: parentId,
    is_subtask: false,
    jira_status_name: "",
  });
  const sorted = sortJiraTasksParentsFirst([
    mk("child", "parent"),
    mk("parent", null),
  ]);
  assert.equal(sorted[0].jira_issue_id, "parent");
  assert.equal(sorted[1].jira_issue_id, "child");
});

test("toJiraTaskDbPayload: parent_jira_issue_id 제거 (PGRST204 방지)", () => {
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "10001",
      issue_key: "FWK-1",
      sprint_id: "s1",
      summary: "x",
      status: "TODO",
      priority: "MEDIUM",
      assignee_id: "kim",
      assignee_name: "김",
      assignee_role: "—",
      assignee_color: "#000",
      story_points: 0,
      updated_at: "2026-01-01T00:00:00Z",
      labels: [],
      synced_at: "2026-05-21T00:00:00Z",
      assignee_account_id: null,
      assignee_email: null,
      due_date: null,
      start_date: null,
      created_at: null,
      resolved_at: null,
      issue_type: "Task",
      parent_issue_key: "FWK-P",
      parent_jira_issue_id: "p1",
      parent_id: null,
      is_subtask: false,
      jira_status_name: "해야 할 일",
    },
  ]);
  const payload = toJiraTaskDbPayload(rows[0]);
  assert.equal("parent_jira_issue_id" in payload, false);
  assert.equal(payload.jira_issue_id, "10001");
  assert.equal(payload.issue_key, "FWK-1");
});
