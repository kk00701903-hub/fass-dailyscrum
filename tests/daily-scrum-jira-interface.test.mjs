/**
 * JIRA 보드(김희찬 담당) ↔ 데일리 스크럼 담당 이슈 패널 인터페이스 검증
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getMemberActiveAssignedTasks,
  isSelectableScrumTask,
  sanitizeSelectedTaskKeys,
  taskIsAssignedToMember,
} from "../src/lib/scrum-backlog.ts";
import { setJiraDataCache, clearJiraDataCache } from "../src/lib/jira-data-registry.ts";
import {
  JIRA_BOARD_KIM_HEECHAN,
  buildKimGoldenTasks,
  GOLDEN_SPRINT,
} from "./fixtures/fwk-kim-golden.mjs";

test.beforeEach(() => {
  setJiraDataCache(buildKimGoldenTasks(), [GOLDEN_SPRINT]);
});

test.afterEach(() => {
  clearJiraDataCache();
});

test("김희찬: JIRA 보드 담당 이슈가 패널에 모두 표시됨 (DONE 제외)", () => {
  const flat = getMemberActiveAssignedTasks("kim");
  const keys = flat.map((t) => t.key);
  assert.deepEqual(
    keys.sort(),
    JIRA_BOARD_KIM_HEECHAN.map((r) => r.key).sort(),
    `패널 키: ${keys.join(", ")}`
  );
});

test("김희찬: JIRA '진행 중'만 스크럼에서 선택 가능", () => {
  const flat = getMemberActiveAssignedTasks("kim");
  const selectable = flat.filter(isSelectableScrumTask).map((t) => t.key);
  assert.deepEqual(selectable, ["FWK-215"]);
});

test("김희찬: '해야 할 일'(TODO) 선택 시 sanitize·저장에서 제거됨", () => {
  const flat = getMemberActiveAssignedTasks("kim");
  const sanitized = sanitizeSelectedTaskKeys(
    ["FWK-220", "FWK-221", "FWK-215"],
    flat
  );
  assert.deepEqual(sanitized, ["FWK-215"]);
});

test("김희찬: assignee 표시명 '찬' 단일 글자도 매칭", () => {
  const task = buildKimGoldenTasks()[0];
  task.assignee = { id: "jira-account-123", name: "찬" };
  assert.equal(taskIsAssignedToMember(task, "kim"), true);
});

test("인터페이스 매트릭스: JIRA 컬럼 ↔ 앱 상태 ↔ 선택 가능", () => {
  const flat = getMemberActiveAssignedTasks("kim");
  const byKey = Object.fromEntries(flat.map((t) => [t.key, t]));

  for (const row of JIRA_BOARD_KIM_HEECHAN) {
    const task = byKey[row.key];
    assert.ok(task, `${row.key} 누락`);
    assert.equal(task.status, row.status, `${row.key} status`);
    assert.equal(
      isSelectableScrumTask(task),
      row.selectable,
      `${row.key} selectable (${row.jiraColumn})`
    );
  }
});
