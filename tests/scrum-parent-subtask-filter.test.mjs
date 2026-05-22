import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { excludeParentsWithListedSubtasks } from "../src/lib/scrum-backlog.ts";

function task(overrides) {
  return {
    id: "parent-id",
    key: "FWK-215",
    summary: "Parent task",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assignee: { id: "kim", name: "김희찬", avatar: "김", role: "BE", color: "#60a5fa" },
    storyPoints: 3,
    updatedAt: "2026-05-21T00:00:00.000Z",
    labels: [],
    sprintId: "s1",
    isSubtask: false,
    parentId: null,
    parentIssueKey: null,
    ...overrides,
  };
}

describe("excludeParentsWithListedSubtasks", () => {
  it("hides parent when subtasks are in the same list", () => {
    const parent = task({ id: "215", key: "FWK-215" });
    const sub1 = task({
      id: "217",
      key: "FWK-217",
      summary: "Sub 1",
      isSubtask: true,
      parentId: "215",
      parentIssueKey: "FWK-215",
    });
    const sub2 = task({
      id: "218",
      key: "FWK-218",
      summary: "Sub 2",
      isSubtask: true,
      parentId: "215",
      parentIssueKey: "FWK-215",
    });
    const filtered = excludeParentsWithListedSubtasks([parent, sub1, sub2]);
    assert.deepEqual(
      filtered.map((t) => t.key).sort(),
      ["FWK-217", "FWK-218"]
    );
  });

  it("keeps standalone parent when no subtask is in the list", () => {
    const parent = task({ id: "215", key: "FWK-215" });
    const filtered = excludeParentsWithListedSubtasks([parent]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].key, "FWK-215");
  });

  it("resolves parent via parentIssueKey when parentId is null", () => {
    const parent = task({ id: "215", key: "FWK-215" });
    const sub = task({
      id: "217",
      key: "FWK-217",
      isSubtask: true,
      parentId: null,
      parentIssueKey: "FWK-215",
    });
    const filtered = excludeParentsWithListedSubtasks([parent, sub]);
    assert.deepEqual(filtered.map((t) => t.key), ["FWK-217"]);
  });

  it("keeps subtasks when parent is not in the list", () => {
    const sub = task({
      id: "217",
      key: "FWK-217",
      isSubtask: true,
      parentId: "215",
      parentIssueKey: "FWK-215",
    });
    const filtered = excludeParentsWithListedSubtasks([sub]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].key, "FWK-217");
  });

  it("returns empty array unchanged", () => {
    assert.deepEqual(excludeParentsWithListedSubtasks([]), []);
  });

  it("no-op when list has no subtasks", () => {
    const a = task({ id: "1", key: "FWK-1" });
    const b = task({ id: "2", key: "FWK-2" });
    const input = [a, b];
    assert.deepEqual(excludeParentsWithListedSubtasks(input), input);
  });
});
