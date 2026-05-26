import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWbsGanttRemountKey,
  pruneWbsExpandedSet,
  pruneWbsExpandedForFilters,
  toggleWbsInProgressExpanded,
  wbsExpandedSetsEqual,
  wbsGanttTaskIdSequence,
  wbsBoardRevisionKey,
  wbsExpandedForVisibleSprints,
  wbsSetToStableKey,
} from "../src/lib/wbs-gantt-filter-state.ts";

test("pruneWbsExpandedSet: removes ids not in visible sprint rows", () => {
  const expanded = new Set(["s1", "s2", "hidden"]);
  const pruned = pruneWbsExpandedSet(expanded, ["s1", "s2"]);
  assert.deepEqual([...pruned].sort(), ["s1", "s2"]);
});

test("toggleWbsInProgressExpanded: expand then collapse from prev state", () => {
  let expanded = new Set();
  const ids = ["a", "b"];
  expanded = toggleWbsInProgressExpanded(expanded, ids);
  assert.ok(ids.every((id) => expanded.has(id)));
  expanded = toggleWbsInProgressExpanded(expanded, ids);
  assert.equal(expanded.size, 0);
});

test("toggleWbsInProgressExpanded: partial expand adds only missing in-progress ids", () => {
  let expanded = new Set(["x"]);
  expanded = toggleWbsInProgressExpanded(expanded, ["x", "y"]);
  assert.deepEqual([...expanded].sort(), ["x", "y"]);
});

test("buildWbsGanttRemountKey: changes when status filter changes", () => {
  const base = {
    viewMode: "Week",
    assigneeFilterActive: false,
    selectedAssignees: null,
  };
  const k1 = buildWbsGanttRemountKey({
    ...base,
    sprintStatuses: new Set(["active", "future"]),
  });
  const k2 = buildWbsGanttRemountKey({
    ...base,
    sprintStatuses: new Set(["closed"]),
  });
  assert.notEqual(k1, k2);
});

test("wbsBoardRevisionKey: stable when sprint ids and task count unchanged", () => {
  const board = {
    sprints: [{ jira_sprint_id: "1" }, { jira_sprint_id: "2" }],
    tasksBySprintId: { "1": [{ issue_key: "A" }], "2": [] },
  };
  const k1 = wbsBoardRevisionKey(board);
  const k2 = wbsBoardRevisionKey({ ...board, sprints: [...board.sprints] });
  assert.equal(k1, k2);
});

test("wbsSetToStableKey: order independent", () => {
  assert.equal(wbsSetToStableKey(new Set(["b", "a"])), "a,b");
});

test("pruneWbsExpandedForFilters: drops expand ids not in filtered sprint rows", () => {
  const board = {
    sprints: [
      { sprint_name: "S1", status: "active", jira_sprint_id: "1" },
      { sprint_name: "S2", status: "closed", jira_sprint_id: "2" },
    ],
    tasksBySprintId: { "1": [], "2": [] },
  };
  const expanded = new Set(["1", "2", "stale"]);
  const pruned = pruneWbsExpandedForFilters(
    expanded,
    board,
    new Set(["active"]),
    null
  );
  assert.ok(pruned.has("1"));
  assert.equal(pruned.has("2"), false);
  assert.equal(pruned.has("stale"), false);
});

test("wbsExpandedForVisibleSprints: same render cycle as filter (no stale expand flash)", () => {
  const expanded = new Set(["s1", "s2", "gone"]);
  const forRender = wbsExpandedForVisibleSprints(expanded, ["s1", "s2"]);
  assert.deepEqual([...forRender].sort(), ["s1", "s2"]);
  assert.equal(expanded.size, 3, "raw state untouched until effect");
});

test("wbsGanttTaskIdSequence: stable id join for list sync", () => {
  assert.equal(
    wbsGanttTaskIdSequence([{ id: "a" }, { id: "b" }]),
    "a,b"
  );
});

test("wbsExpandedSetsEqual", () => {
  assert.equal(wbsExpandedSetsEqual(new Set(["a"]), new Set(["a"])), true);
  assert.equal(wbsExpandedSetsEqual(new Set(["a"]), new Set(["b"])), false);
});
