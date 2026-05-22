import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { memberTaskCompletionCounts } from "../src/lib/jira-live-data.ts";

function task(overrides) {
  return {
    id: "t1",
    key: "FWK-1",
    sprintId: "s1",
    summary: "테스트",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    storyPoints: 3,
    updatedAt: "2026-05-21T12:00:00.000Z",
    labels: [],
    assignee: {
      id: "jira-account-xyz",
      name: "이지상",
      avatar: "이",
      role: "Frontend",
      color: "#f87171",
    },
    ...overrides,
  };
}

describe("memberTaskCompletionCounts", () => {
  it("matches assignee by display name when JIRA account id differs", () => {
    const tasks = [
      task({ status: "DONE" }),
      task({ id: "t2", key: "FWK-2", status: "IN_PROGRESS" }),
    ];
    const r = memberTaskCompletionCounts(tasks, "lee");
    assert.equal(r.total, 2);
    assert.equal(r.done, 1);
    assert.equal(r.pct, 50);
  });

  it("matches assignee by team member id", () => {
    const tasks = [
      task({
        assignee: {
          id: "kim",
          name: "김희찬",
          avatar: "김",
          role: "Backend",
          color: "#60a5fa",
        },
        status: "DONE",
      }),
    ];
    const r = memberTaskCompletionCounts(tasks, "kim");
    assert.equal(r.total, 1);
    assert.equal(r.done, 1);
    assert.equal(r.pct, 100);
  });

  it("excludes unassigned and other members", () => {
    const tasks = [
      task({ assignee: { id: "jira-unassigned", name: "—", avatar: "?", role: "—", color: "#64748b" } }),
      task({
        assignee: { id: "song", name: "송민준", avatar: "송", role: "Backend", color: "#a78bfa" },
        status: "DONE",
      }),
    ];
    const r = memberTaskCompletionCounts(tasks, "lee");
    assert.equal(r.total, 0);
    assert.equal(r.done, 0);
    assert.equal(r.pct, 0);
  });

  it("updates counts when task status changes to DONE", () => {
    const before = memberTaskCompletionCounts([task({ status: "IN_PROGRESS" })], "lee");
    const after = memberTaskCompletionCounts([task({ status: "DONE" })], "lee");
    assert.equal(before.done, 0);
    assert.equal(before.pct, 0);
    assert.equal(after.done, 1);
    assert.equal(after.pct, 100);
  });
});
