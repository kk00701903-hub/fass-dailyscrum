/**
 * 데일리 스크럼 담당 이슈 상태 필터 (단일 선택, 기본: 진행 중)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  filterTasksByStatuses,
  SCRUM_TASK_STATUS_FILTER_DEFAULT,
  SCRUM_TASK_STATUS_FILTER_ORDER,
} from "../src/lib/scrum-backlog.ts";
import { setJiraDataCache, clearJiraDataCache } from "../src/lib/jira-data-registry.ts";
import { buildKimGoldenTasks } from "./fixtures/fwk-kim-golden.mjs";

test.beforeEach(() => {
  setJiraDataCache(buildKimGoldenTasks(), []);
});

test.afterEach(() => {
  clearJiraDataCache();
});

test("SCRUM_TASK_STATUS_FILTER_DEFAULT: 진행 중만", () => {
  assert.equal(SCRUM_TASK_STATUS_FILTER_DEFAULT, "IN_PROGRESS");
});

test("SCRUM_TASK_STATUS_FILTER_ORDER: UI 토글 순서", () => {
  assert.deepEqual(SCRUM_TASK_STATUS_FILTER_ORDER, [
    "IN_PROGRESS",
    "TODO",
    "IN_REVIEW",
    "BLOCKED",
    "DONE",
  ]);
});

test("filterTasksByStatuses: 기본 필터면 FWK-215만", () => {
  const tasks = buildKimGoldenTasks();
  const visible = filterTasksByStatuses(tasks, [SCRUM_TASK_STATUS_FILTER_DEFAULT]);
  assert.deepEqual(
    visible.map((t) => t.key),
    ["FWK-215"]
  );
});

test("filterTasksByStatuses: 할 일 단일 선택", () => {
  const tasks = buildKimGoldenTasks();
  const visible = filterTasksByStatuses(tasks, ["TODO"]);
  assert.equal(visible.length, 4);
  assert.ok(visible.every((t) => t.status === "TODO"));
});

test("filterTasksByStatuses: 빈 Set이면 0건", () => {
  const visible = filterTasksByStatuses(buildKimGoldenTasks(), []);
  assert.equal(visible.length, 0);
});
