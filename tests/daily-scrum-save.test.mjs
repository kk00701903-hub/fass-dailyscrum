/**
 * Daily Scrum 저장 플로우 통합 테스트
 *
 * - saveScrumEntry: Supabase 미설정 환경에서 직렬화·pruning·반환값 검증
 * - resolveScrumFormTaskFields: 레거시 텍스트 파싱 폴백 검증
 * - sanitizeSelectedTaskKeys: 빈 백로그(JIRA 미로드) 상태 검증
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { saveScrumEntry, resolveScrumFormTaskFields } from "../src/lib/scrum-storage.ts";
import { sanitizeSelectedTaskKeys } from "../src/lib/scrum-backlog.ts";
import { serializeTaskTexts, parseLegacyTaskTexts } from "../src/lib/scrum-task-fields.ts";

describe("daily-scrum-save", () => {
  // ── saveScrumEntry ────────────────────────────────────────────────────────

  it("saveScrumEntry: yesterdayByTask / todayByTask가 selectedTasks 기준으로 직렬화됨", async () => {
    const entry = await saveScrumEntry({
      date: "2026-05-28",
      sprintId: "sprint-1",
      memberId: "kim",
      blockers: "없음",
      selectedTasks: ["FWK-215", "FWK-217"],
      yesterdayByTask: { "FWK-215": "전일 A 완료", "FWK-217": "전일 B 완료" },
      todayByTask: { "FWK-215": "오늘 A 계획", "FWK-217": "오늘 B 계획" },
    });

    // yesterday 직렬화 결과에 두 이슈 텍스트가 모두 포함되어야 함
    assert.ok(entry.yesterday.includes("전일 A 완료"), `yesterday 누락: ${entry.yesterday}`);
    assert.ok(entry.yesterday.includes("전일 B 완료"), `yesterday 누락: ${entry.yesterday}`);
    assert.ok(entry.today.includes("오늘 A 계획"), `today 누락: ${entry.today}`);
    assert.ok(entry.today.includes("오늘 B 계획"), `today 누락: ${entry.today}`);
  });

  it("saveScrumEntry: selectedTasks에 없는 키의 텍스트가 pruning됨", async () => {
    const entry = await saveScrumEntry({
      date: "2026-05-28",
      sprintId: "sprint-1",
      memberId: "kim",
      blockers: "없음",
      selectedTasks: ["FWK-215"],
      yesterdayByTask: { "FWK-215": "A 완료", "FWK-999": "삭제되어야 할 텍스트" },
      todayByTask: { "FWK-215": "A 계획", "FWK-999": "삭제되어야 할 텍스트" },
    });

    assert.ok(entry.yesterday.includes("A 완료"), `FWK-215 텍스트 누락: ${entry.yesterday}`);
    assert.equal(
      entry.yesterday.includes("삭제되어야 할 텍스트"),
      false,
      `FWK-999 텍스트가 pruning되지 않음: ${entry.yesterday}`
    );
  });

  it("saveScrumEntry: 빈 selectedTasks는 yesterday/today가 빈 문자열", async () => {
    const entry = await saveScrumEntry({
      date: "2026-05-28",
      sprintId: "sprint-1",
      memberId: "lee",
      blockers: "네트워크 문제",
      selectedTasks: [],
      yesterdayByTask: {},
      todayByTask: {},
    });

    assert.equal(entry.yesterday, "");
    assert.equal(entry.today, "");
    assert.equal(entry.blockers, "네트워크 문제");
  });

  it("saveScrumEntry: 반환 entry의 필드가 payload와 일치함", async () => {
    const payload = {
      date: "2026-05-28",
      sprintId: "sprint-42",
      memberId: "song",
      blockers: "없음",
      selectedTasks: ["FWK-66"],
      yesterdayByTask: { "FWK-66": "랭킹 화면 완료" },
      todayByTask: { "FWK-66": "랭킹 화면 QA" },
    };

    const entry = await saveScrumEntry(payload);

    assert.equal(entry.date, payload.date);
    assert.equal(entry.sprintId, payload.sprintId);
    assert.equal(entry.memberId, payload.memberId);
    assert.deepEqual(entry.selectedTasks, payload.selectedTasks);
  });

  // ── resolveScrumFormTaskFields ────────────────────────────────────────────

  it("resolveScrumFormTaskFields: localStorage·Supabase 없이 레거시 문자열 파싱 폴백", async () => {
    // Node.js 환경: localStorage 없음, Supabase 미설정 → legacy 파싱 경로 사용
    const legacyYesterday = serializeTaskTexts({ "FWK-215": "전일 완료" }, ["FWK-215"]);
    const legacyToday = serializeTaskTexts({ "FWK-215": "오늘 계획" }, ["FWK-215"]);

    const fields = await resolveScrumFormTaskFields(
      "2026-05-27",
      "kim",
      "sprint-1",
      ["FWK-215"],
      legacyYesterday,
      legacyToday
    );

    assert.equal(
      fields.yesterdayByTask["FWK-215"],
      "전일 완료",
      `yesterdayByTask 파싱 실패: ${JSON.stringify(fields.yesterdayByTask)}`
    );
    assert.equal(
      fields.todayByTask["FWK-215"],
      "오늘 계획",
      `todayByTask 파싱 실패: ${JSON.stringify(fields.todayByTask)}`
    );
  });

  // ── sanitizeSelectedTaskKeys ──────────────────────────────────────────────

  it("sanitizeSelectedTaskKeys: JIRA 미로드(빈 백로그) 상태에서 모든 키가 제거됨", () => {
    // assignedTasks가 [] 이면 byKey 맵이 비어 있어 어떤 키도 통과하지 못함
    const sanitized = sanitizeSelectedTaskKeys(["FWK-215", "FWK-217", "FWK-66"], []);
    assert.deepEqual(sanitized, [], `JIRA 미로드 시 키가 남아 있음: ${sanitized.join(", ")}`);
  });

  // ── 이슈 선택만 하고 텍스트 없는 경우 (persistTaskSelection 경로) ───────────

  it("saveScrumEntry: yesterday/today 비어 있어도 이슈 선택만으로 throw하지 않음", async () => {
    // 이슈를 클릭하여 선택만 한 경우 — persistTaskSelection이 content 없이 호출함
    // saveScrumEntry에서 validation throw 없이 정상 반환되어야 함
    const entry = await saveScrumEntry({
      date: "2026-06-01",
      sprintId: "sprint-10",
      memberId: "kim",
      blockers: "없음",
      selectedTasks: ["FWK-218"],
      yesterdayByTask: {},
      todayByTask: {},
    });
    assert.equal(entry.memberId, "kim");
    assert.deepEqual(entry.selectedTasks, ["FWK-218"]);
    // content 없으면 직렬화 결과는 빈 문자열
    assert.equal(entry.yesterday, "");
    assert.equal(entry.today, "");
  });

  it("saveScrumEntry: 이슈 선택 + 일부 텍스트만 있어도 throw하지 않음", async () => {
    // yesterday만 입력하고 today는 아직 입력 안 한 중간 상태
    const entry = await saveScrumEntry({
      date: "2026-06-01",
      sprintId: "sprint-10",
      memberId: "song",
      blockers: "없음",
      selectedTasks: ["FWK-217"],
      yesterdayByTask: { "FWK-217": "전일 작업 완료" },
      todayByTask: {},
    });
    assert.equal(entry.memberId, "song");
    assert.ok(entry.yesterday.includes("전일 작업 완료"), `yesterday 누락: ${entry.yesterday}`);
    assert.equal(entry.today, "");
  });
});
