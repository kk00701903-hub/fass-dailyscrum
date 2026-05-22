/**
 * ScrumTaskStatusFilter — 단일 선택 (라디오형)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SCRUM_TASK_STATUS_FILTER_DEFAULT } from "../src/lib/scrum-backlog.ts";

/** ScrumTaskStatusFilter.handleChange 와 동일 규칙 */
function applyStatusFilterChange(prev, next) {
  if (!next) return prev;
  return next;
}

test("applyStatusFilterChange: empty next keeps previous", () => {
  assert.equal(applyStatusFilterChange("IN_PROGRESS", ""), "IN_PROGRESS");
});

test("applyStatusFilterChange: switches status", () => {
  assert.equal(applyStatusFilterChange("IN_PROGRESS", "TODO"), "TODO");
});

test("applyStatusFilterChange: default is IN_PROGRESS", () => {
  assert.equal(SCRUM_TASK_STATUS_FILTER_DEFAULT, "IN_PROGRESS");
});
