/**
 * JIRA issue.id 기준 upsert 행 준비
 */
import assert from "node:assert/strict";
import test from "node:test";
import { prepareJiraTaskRowsForUpsert } from "../src/lib/jira-tasks-upsert.ts";

test("prepareJiraTaskRowsForUpsert: jira_issue_id = id, issue_key 갱신", () => {
  const rows = prepareJiraTaskRowsForUpsert([
    {
      id: "10001",
      issue_key: "FWK-200",
      sprint_id: "s1",
      summary: "old title",
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
  assert.equal(rows[0].issue_key, "FWK-200");
});

test("prepareJiraTaskRowsForUpsert: parent_id from parent_issue_key", () => {
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
      parent_issue_key: "FWK-1",
      parent_id: null,
      is_subtask: true,
      jira_status_name: "해야 할 일",
    },
  ]);

  assert.equal(rows[1].parent_id, "p1");
});
