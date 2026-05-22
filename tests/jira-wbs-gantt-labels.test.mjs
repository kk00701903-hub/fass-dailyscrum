/**
 * JIRA WBS Gantt 막대 라벨 — 펼침 시 우측 긴 텍스트 미표시
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapWbsRowsToGanttTasks } from "../src/lib/jira-wbs-gantt.ts";

const sprintRow = {
  id: "sprint-s14",
  kind: "sprint",
  name: "[S14] AI 연동 모듈 개발",
  assignee: "김희찬",
  fromDate: "2026-05-01",
  toDate: "2026-06-30",
  weekCount: 8,
  barStartIdx: 0,
  barSpan: 8,
  depth: 0,
  children: [],
  statusLabel: "ACTIVE",
  statusKind: "active",
};

const taskRow = {
  id: "task-fwk-67",
  kind: "task",
  name: "AI 연동 모듈 (물류·유통 AI 서비스 통신 표준화)",
  issueKey: "FWK-67",
  assignee: "김희찬",
  fromDate: "2026-05-10",
  toDate: "2026-05-24",
  weekCount: 2,
  barStartIdx: 1,
  barSpan: 2,
  depth: 1,
  children: [],
};

test("mapWbsRowsToGanttTasks: 접힌 스프린트 — [S14] 코드만", () => {
  const { tasks } = mapWbsRowsToGanttTasks([sprintRow], new Set());
  const sprint = tasks.find((t) => t.id === "sprint-s14");
  assert.equal(sprint?.name, "[S14]");
  assert.equal(sprint?.hideChildren, true);
});

test("mapWbsRowsToGanttTasks: 펼친 스프린트 — 간트 name 빈 문자열", () => {
  const expanded = new Set(["sprint-s14"]);
  const { tasks } = mapWbsRowsToGanttTasks([sprintRow, taskRow], expanded);
  const sprint = tasks.find((t) => t.id === "sprint-s14");
  const task = tasks.find((t) => t.id === "task-fwk-67");
  assert.equal(sprint?.name, "");
  assert.equal(sprint?.hideChildren, false);
  assert.equal(task?.name, "");
});

test("mapWbsRowsToGanttTasks: treeLabel은 좌측 테이블용 전체 이름 유지", () => {
  const expanded = new Set(["sprint-s14"]);
  const { metaByTaskId } = mapWbsRowsToGanttTasks([sprintRow, taskRow], expanded);
  assert.equal(metaByTaskId.get("sprint-s14")?.treeLabel, "[S14] AI 연동 모듈 개발");
});
