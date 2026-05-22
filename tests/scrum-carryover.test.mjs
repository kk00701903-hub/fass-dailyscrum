/**
 * 과거 기록 · 이월 유틸
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  groupScrumTodayPlansByDate,
  intersectCarryoverTaskKeys,
  previousEntryTaskKeys,
} from "../src/lib/scrum-carryover.ts";

const baseEntry = {
  memberId: "kim",
  sprintId: "s1",
  yesterday: "",
  blockers: "",
  selectedTasks: [],
};

test("groupScrumTodayPlansByDate: D-7~D-1, 해당 멤버 today만", () => {
  const history = [
    { ...baseEntry, id: "1", date: "2026-05-10", today: "너무 옛날" },
    { ...baseEntry, id: "2", date: "2026-05-14", today: "D-8 제외" },
    { ...baseEntry, id: "3", date: "2026-05-15", today: "D-7 포함" },
    { ...baseEntry, id: "4", date: "2026-05-21", today: "D-1 포함" },
    { ...baseEntry, id: "5", date: "2026-05-22", today: "선택일 제외" },
    { ...baseEntry, id: "6", memberId: "other", date: "2026-05-20", today: "다른 멤버" },
    { ...baseEntry, id: "7", date: "2026-05-18", today: "" },
  ];

  const grouped = groupScrumTodayPlansByDate(history, "kim", "2026-05-22", 7);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].date, "2026-05-21");
  assert.equal(grouped[0].plans[0].today, "D-1 포함");
  assert.equal(grouped[1].date, "2026-05-15");
  assert.equal(grouped[1].plans[0].today, "D-7 포함");
});

test("intersectCarryoverTaskKeys: 현재 선택 ∩ 전일 담당 이슈만", () => {
  assert.deepEqual(
    intersectCarryoverTaskKeys(["FWK-1", "FWK-2", "FWK-3"], ["FWK-2", "FWK-4"]),
    ["FWK-2"]
  );
  assert.deepEqual(intersectCarryoverTaskKeys(["FWK-1"], []), []);
});

test("previousEntryTaskKeys: selectedTasks 없으면 레거시 본문에서 추출", () => {
  assert.deepEqual(
    previousEntryTaskKeys({
      selectedTasks: [],
      today: "[FWK-10]\n계획A\n\n[FWK-20]\n계획B",
      yesterday: "",
    }),
    ["FWK-10", "FWK-20"]
  );
  assert.deepEqual(
    previousEntryTaskKeys({
      selectedTasks: ["FWK-5"],
      today: "[FWK-99]\n무시",
      yesterday: "",
    }),
    ["FWK-5"]
  );
});
