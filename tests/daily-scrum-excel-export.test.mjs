import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyScrumExcelHtml,
  dailyScrumExcelFilename,
} from "../src/lib/daily-scrum-excel-export.ts";

const member = {
  id: "kim",
  name: "김철수",
  avatar: "김",
  color: "#2563eb",
};

test("buildDailyScrumExcelHtml: renders Korean headers and row values", () => {
  const html = buildDailyScrumExcelHtml({
    date: "2026-05-26",
    title: "팀 전체 일지",
    rows: [
      {
        id: "1",
        member_id: "kim",
        member,
        tasks: "FWK-1 작업",
        yesterday_achievement: "전일 <성과>",
        today_plan: "오늘 계획\n두 번째 줄",
        bottleneck: null,
        hasReport: true,
      },
    ],
  });

  assert.match(html, /데일리|팀 전체 일지/);
  assert.match(html, /담당자/);
  assert.match(html, /전일 성과/);
  assert.match(html, /전일 &lt;성과&gt;/);
  assert.match(html, /오늘 계획<br \/>두 번째 줄/);
  assert.match(html, /미입력/);
});

test("dailyScrumExcelFilename: removes invalid filename characters", () => {
  assert.equal(
    dailyScrumExcelFilename("2026-05-26", '팀/전체:"일지"'),
    "데일리_스크럼_일지_2026-05-26_팀_전체__일지_.xls"
  );
});
