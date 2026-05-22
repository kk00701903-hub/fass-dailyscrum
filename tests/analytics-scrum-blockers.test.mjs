import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyticsBlockerCounts,
  blockersFromScrumEntries,
  isMeaningfulScrumBlocker,
  mergeAnalyticsBlockers,
} from "../src/lib/analytics-blockers.ts";
import { blockersFromJiraTasksForAnalytics } from "../src/lib/analytics-blockers.ts";

const today = new Date().toISOString().slice(0, 10);

describe("isMeaningfulScrumBlocker", () => {
  it("treats 병목없음 and empty as not meaningful", () => {
    assert.equal(isMeaningfulScrumBlocker(""), false);
    assert.equal(isMeaningfulScrumBlocker("병목없음"), false);
    assert.equal(isMeaningfulScrumBlocker("없음"), false);
    assert.equal(isMeaningfulScrumBlocker("  DB 마이그레이션 대기  "), true);
  });
});

describe("blockersFromScrumEntries", () => {
  it("maps daily scrum blocker text to analytics items", () => {
    const entries = [
      {
        id: "e1",
        date: today,
        sprintId: "sprint-1",
        memberId: "lee",
        yesterday: "",
        today: "작업",
        blockers: "리뷰 대기로 배포 지연",
        selectedTasks: ["FWK-10"],
      },
      {
        id: "e2",
        date: today,
        sprintId: "sprint-1",
        memberId: "kim",
        yesterday: "",
        today: "",
        blockers: "병목없음",
        selectedTasks: [],
      },
    ];
    const items = blockersFromScrumEntries(entries, { daysBack: 7 });
    assert.equal(items.length, 1);
    assert.equal(items[0].source, "scrum");
    assert.equal(items[0].description, "리뷰 대기로 배포 지연");
    assert.equal(items[0].reportedBy.id, "lee");
    assert.equal(items[0].relatedTask, "FWK-10");
  });

  it("excludes entries older than daysBack", () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const entries = [
      {
        id: "e-old",
        date: old.toISOString().slice(0, 10),
        sprintId: "s1",
        memberId: "lee",
        yesterday: "",
        today: "",
        blockers: "옛날 병목",
        selectedTasks: [],
      },
    ];
    assert.equal(blockersFromScrumEntries(entries, { daysBack: 14 }).length, 0);
  });
});

describe("mergeAnalyticsBlockers", () => {
  it("includes both scrum and jira sources", () => {
    const scrum = blockersFromScrumEntries([
      {
        id: "e1",
        date: today,
        sprintId: "s1",
        memberId: "lee",
        yesterday: "",
        today: "",
        blockers: "스크럼 병목",
        selectedTasks: [],
      },
    ]);
    const jira = blockersFromJiraTasksForAnalytics([
      {
        id: "j1",
        key: "FWK-99",
        sprintId: "s1",
        summary: "BLOCKED task",
        status: "BLOCKED",
        priority: "HIGH",
        storyPoints: 2,
        updatedAt: today,
        labels: [],
        assignee: {
          id: "kim",
          name: "김희찬",
          avatar: "김",
          role: "Backend",
          color: "#60a5fa",
        },
      },
    ]);
    const merged = mergeAnalyticsBlockers(scrum, jira);
    assert.equal(merged.length, 2);
    assert.equal(analyticsBlockerCounts(merged).scrum, 1);
    assert.equal(analyticsBlockerCounts(merged).jira, 1);
  });
});
