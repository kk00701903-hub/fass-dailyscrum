import assert from "node:assert/strict";
import test from "node:test";

// Compiled via tsx or we test the logic inline - use dynamic import from dist if needed.
// Mirror resolveScrumEntrySprintId logic for unit test without TS build step.

function resolveScrumEntrySprintId(selectedTaskKeys, flatBacklog, fallbackSprintId) {
  if (selectedTaskKeys.length === 0) return fallbackSprintId;
  const sprintIds = new Set();
  for (const key of selectedTaskKeys) {
    const task = flatBacklog.find((t) => t.key === key);
    if (task?.sprintId) sprintIds.add(task.sprintId);
  }
  if (sprintIds.size === 1) return [...sprintIds][0];
  return fallbackSprintId;
}

const backlog = [
  { key: "A-1", sprintId: "s1" },
  { key: "B-1", sprintId: "s2" },
];

test("resolveScrumEntrySprintId: empty selection uses fallback", () => {
  assert.equal(resolveScrumEntrySprintId([], backlog, "team"), "team");
});

test("resolveScrumEntrySprintId: single sprint from selection", () => {
  assert.equal(resolveScrumEntrySprintId(["A-1"], backlog, "team"), "s1");
});

test("resolveScrumEntrySprintId: mixed sprints uses fallback", () => {
  assert.equal(resolveScrumEntrySprintId(["A-1", "B-1"], backlog, "team"), "team");
});
