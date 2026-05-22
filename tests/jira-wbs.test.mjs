import assert from "node:assert/strict";
import test from "node:test";

function normalizeWbsSprintStatus(status) {
  const s = status.trim().toLowerCase();
  if (s.includes("진행") || s === "active") return { kind: "active" };
  if (s.includes("종료") || s === "closed") return { kind: "closed" };
  if (s.includes("예정") || s === "future") return { kind: "future" };
  return { kind: "other" };
}

function filterSprintsByWbsStatus(sprints, selected) {
  if (selected.size === 0) return [];
  return sprints.filter((s) => selected.has(normalizeWbsSprintStatus(s.status).kind));
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function buildWbsTimeline(allStarts, allEnds, options) {
  if (allStarts.length === 0 && allEnds.length === 0) {
    const today = startOfWeekMonday(new Date());
    allStarts = [today];
    allEnds = [addDays(today, 27)];
  } else if (allStarts.length === 0) {
    allStarts = [startOfWeekMonday(new Date())];
  } else if (allEnds.length === 0) {
    allEnds = [...allStarts];
  }

  let min = allStarts[0];
  let max = allEnds[0];
  for (let i = 1; i < allStarts.length; i++) {
    if (allStarts[i].getTime() < min.getTime()) min = allStarts[i];
  }
  for (let i = 0; i < allEnds.length; i++) {
    if (allEnds[i].getTime() > max.getTime()) max = allEnds[i];
  }

  const rangeStart =
    options?.floorStart != null
      ? startOfWeekMonday(options.floorStart)
      : addDays(startOfWeekMonday(min), -7);

  const weeks = [];
  let cursor = new Date(rangeStart);
  const rangeEnd = addDays(startOfWeekMonday(max), 21);
  while (cursor.getTime() <= rangeEnd.getTime()) {
    weeks.push({ start: new Date(cursor) });
    cursor = addDays(cursor, 7);
  }
  return { weeks, rangeStart };
}

const sprints = [
  { sprint_name: "S1", status: "active", jira_sprint_id: "1" },
  { sprint_name: "S2", status: "closed", jira_sprint_id: "2" },
  { sprint_name: "S3", status: "future", jira_sprint_id: "3" },
];

test("filterSprintsByWbsStatus: default active+future excludes closed", () => {
  const selected = new Set(["active", "future"]);
  const out = filterSprintsByWbsStatus(sprints, selected);
  assert.equal(out.length, 2);
  assert.ok(out.every((s) => s.status !== "closed"));
});

test("filterSprintsByWbsStatus: closed only", () => {
  const out = filterSprintsByWbsStatus(sprints, new Set(["closed"]));
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "closed");
});

/** 프로덕션과 동일: 주 목요일 기준 달력 월 */
function weekCalendarMonth(weekStartMonday) {
  const thu = addDays(weekStartMonday, 3);
  return { year: thu.getFullYear(), month: thu.getMonth() + 1 };
}

test("weekCalendarMonth: week containing Oct 1 maps to October not September", () => {
  const mon = startOfWeekMonday(new Date("2026-09-28T12:00:00"));
  const cal = weekCalendarMonth(mon);
  assert.equal(cal.month, 10);
  assert.equal(cal.year, 2026);
});

function mondaysOverlappingCalendarMonth(year, month) {
  const monthStart = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 12, 0, 0, 0);
  let cursor = addDays(startOfWeekMonday(monthStart), -7);
  const mondays = [];
  while (cursor.getTime() <= addDays(monthEnd, 7).getTime()) {
    const weekEnd = addDays(cursor, 6);
    if (cursor.getTime() <= monthEnd.getTime() && weekEnd.getTime() >= monthStart.getTime()) {
      mondays.push(new Date(cursor));
    }
    cursor = addDays(cursor, 7);
  }
  return mondays;
}

function mondayOfCalendarMonthWeek(year, month, weekInMonth) {
  const mondays = mondaysOverlappingCalendarMonth(year, month);
  const idx = Math.max(0, Math.min(weekInMonth - 1, mondays.length - 1));
  return mondays[idx] ?? startOfWeekMonday(new Date(year, month - 1, 1, 12, 0, 0, 0));
}

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("wbsGanttTimelineEndDate: 2027년 12월 4주차 일요일", async () => {
  const { wbsGanttTimelineEndDate } = await import("../src/lib/wbs-project-week.ts");
  const end = wbsGanttTimelineEndDate();
  assert.equal(end.getFullYear(), 2028);
  assert.equal(end.getMonth(), 0);
  assert.equal(end.getDate(), 2);
});

/** Week 헤더 월 그룹 — jira-wbs-gantt-timeline.ts 와 동일 */
function groupWeekColumnDatesByCalendarMonth(dates) {
  if (dates.length === 0) return [];
  const groups = [];
  let current = null;
  for (const date of dates) {
    const { year, month } = weekCalendarMonth(date);
    if (current && current.year === year && current.month === month) {
      current.weekCount += 1;
    } else {
      current = { year, month, weekCount: 1 };
      groups.push(current);
    }
  }
  return groups;
}

function formatWbsGanttMonthHeaderLabel(year, month) {
  return `${year}년 ${month}월`;
}

test("groupWeekColumnDatesByCalendarMonth: consecutive weeks same calendar month", () => {
  const dates = [
    new Date("2026-05-11T12:00:00"),
    new Date("2026-05-18T12:00:00"),
    new Date("2026-05-25T12:00:00"),
    new Date("2026-06-01T12:00:00"),
  ];
  const groups = groupWeekColumnDatesByCalendarMonth(dates);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { year: 2026, month: 5, weekCount: 3 });
  assert.deepEqual(groups[1], { year: 2026, month: 6, weekCount: 1 });
});

test("formatWbsGanttMonthHeaderLabel: year month Korean format", () => {
  assert.equal(formatWbsGanttMonthHeaderLabel(2026, 5), "2026년 5월");
  assert.equal(formatWbsGanttMonthHeaderLabel(2027, 3), "2027년 3월");
});

test("mondayOfCalendarMonthWeek: WBS project milestones", () => {
  assert.equal(formatYmd(mondayOfCalendarMonthWeek(2026, 10, 1)), "2026-09-28");
  assert.equal(formatYmd(mondayOfCalendarMonthWeek(2027, 3, 1)), "2027-03-01");
  assert.equal(formatYmd(mondayOfCalendarMonthWeek(2027, 6, 5)), "2027-06-28");
});

test("buildWbsTimeline floorStart: milestone earlier does not pull rangeStart before sprint", () => {
  const sprintStart = new Date("2026-03-10");
  const earlyMilestone = new Date("2025-01-01");
  const lateEnd = new Date("2026-06-01");

  const withFloor = buildWbsTimeline(
    [sprintStart, earlyMilestone],
    [lateEnd, earlyMilestone],
    { floorStart: sprintStart }
  );
  const withoutFloor = buildWbsTimeline([sprintStart, earlyMilestone], [lateEnd, earlyMilestone]);

  const floorMonday = startOfWeekMonday(sprintStart).getTime();
  assert.equal(withFloor.rangeStart.getTime(), floorMonday);
  assert.ok(withoutFloor.rangeStart.getTime() < floorMonday);
  assert.equal(withFloor.weeks[0].start.getTime(), floorMonday);
});
