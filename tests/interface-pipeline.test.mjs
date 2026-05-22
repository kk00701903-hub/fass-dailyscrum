/**
 * JIRA → DB → 앱 로직 파이프라인 오프라인 통합 테스트
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapJiraStatus } from "../src/lib/jira-issue-mapper.ts";
import { jiraTaskFromDbRow } from "../src/lib/supabase/jira-repository.ts";
import {
  sanitizeSelectedTaskKeys,
  taskIsAssignedToMember,
} from "../src/lib/scrum-backlog.ts";
import { reconcileScrumEntriesWithJiraTasks } from "../src/lib/scrum-jira-reconcile.ts";
import {
  getScrumSaveValidationMessage,
  isScrumFormSavable,
} from "../src/lib/scrum-save-validation.ts";
import {
  JIRA_BOARD_KIM_HEECHAN,
  KIM_MEMBER_ID,
  buildKimGoldenTasks,
} from "./fixtures/fwk-kim-golden.mjs";

function sampleDbRow(overrides = {}) {
  return {
    id: "uuid-fwk-215",
    issue_key: "FWK-215",
    sprint_id: "web-framework-tf-sprint",
    summary: JIRA_BOARD_KIM_HEECHAN[0].summary,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assignee_id: "kim",
    assignee_name: "김희찬",
    assignee_role: "Backend",
    assignee_color: "#60a5fa",
    story_points: 0,
    updated_at: "2026-05-21T10:00:00.000Z",
    labels: ["REPORT TOOL 도입"],
    due_date: null,
    created_at: null,
    resolved_at: null,
    issue_type: "Task",
    parent_issue_key: null,
    parent_id: null,
    is_subtask: false,
    jira_status_name: "진행 중",
    ...overrides,
  };
}

test("jiraTaskFromDbRow: issue_key가 task.key로 보존", () => {
  const task = jiraTaskFromDbRow(sampleDbRow());
  assert.equal(task.key, "FWK-215");
  assert.equal(task.id, "uuid-fwk-215");
  assert.equal(task.summary, JIRA_BOARD_KIM_HEECHAN[0].summary);
});

test("mapJiraStatus: FWK-215 진행 중 → IN_PROGRESS", () => {
  assert.equal(
    mapJiraStatus({ name: "진행 중", statusCategory: { key: "indeterminate" } }),
    "IN_PROGRESS"
  );
});

test("mapJiraStatus: FWK-220/221 해야 할 일 → TODO", () => {
  assert.equal(
    mapJiraStatus({ name: "해야 할 일", statusCategory: { key: "new" } }),
    "TODO"
  );
});

test("taskIsAssignedToMember: kim id·이름·찬 단일 글자", () => {
  const tasks = buildKimGoldenTasks();
  assert.equal(taskIsAssignedToMember(tasks[0], KIM_MEMBER_ID), true);
  tasks[0].assignee = { id: "jira-x", name: "찬" };
  assert.equal(taskIsAssignedToMember(tasks[0], KIM_MEMBER_ID), true);
  tasks[0].assignee = { id: "other", name: "다른사람" };
  assert.equal(taskIsAssignedToMember(tasks[0], KIM_MEMBER_ID), false);
});

test("sanitizeSelectedTaskKeys: TODO 제거 후 FWK-215만", () => {
  const flat = buildKimGoldenTasks();
  const out = sanitizeSelectedTaskKeys(["FWK-220", "FWK-221", "FWK-215"], flat);
  assert.deepEqual(out, ["FWK-215"]);
});

test("isScrumFormSavable: FWK-215 선택 시 저장 가능", () => {
  const form = {
    yesterday: "전일",
    today: "오늘",
    selectedTasks: ["FWK-215"],
  };
  assert.equal(isScrumFormSavable(form), true);
  assert.equal(getScrumSaveValidationMessage(form), null);
});

test("isScrumFormSavable: TODO만 선택 시 sanitize 후 저장 불가", () => {
  const sanitized = sanitizeSelectedTaskKeys(["FWK-220"], buildKimGoldenTasks());
  const form = { yesterday: "전일", today: "오늘", selectedTasks: sanitized };
  assert.deepEqual(sanitized, []);
  assert.equal(isScrumFormSavable(form), false);
  assert.match(getScrumSaveValidationMessage(form), /담당 이슈/);
});

test("isScrumFormSavable: 선택 이슈 없어도 backlog 없으면 저장 가능", () => {
  const form = { yesterday: "a", today: "b", selectedTasks: [] };
  assert.equal(isScrumFormSavable(form, { requireTaskSelection: false }), true);
});

test("reconcileScrumEntriesWithJiraTasks: 동기화 후 없는 FWK 키 제거", async () => {
  const flat = buildKimGoldenTasks();
  const entries = [
    {
      id: "e1",
      date: "2026-05-21",
      memberId: KIM_MEMBER_ID,
      sprintId: "jira-sprint-s23",
      yesterday: "",
      today: "",
      blockers: "병목없음",
      selectedTasks: ["FWK-999", "FWK-215"],
    },
  ];
  const { entries: out, changed } = await reconcileScrumEntriesWithJiraTasks(flat, entries);
  assert.equal(changed, 1);
  assert.deepEqual(out[0].selectedTasks, ["FWK-215"]);
});
