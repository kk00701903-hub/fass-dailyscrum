/**
 * Supabase DB 레이어 통합 테스트 (Node 내장 `node:test`).
 *
 * `.env.local` 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 있어야 실행됩니다.
 * 자격증명이 없으면 모든 테스트가 자동으로 skip 됩니다.
 *
 * 실행: npm run test:supabase:integration
 *
 * Write 테스트는 date="9999-12-31", member_id="test-integration" 을 사용하며
 * after() 훅에서 삭제(cleanup) 합니다.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../scripts/jira-test-lib.mjs";

// ── 환경 설정 ─────────────────────────────────────────────────────────────────

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fileEnv = loadEnvLocal(root);

const supabaseUrl = (
  fileEnv.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).trim();

const supabaseKey = (
  fileEnv.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

// JIRA 테스트와 동일한 env var — 사내 SSL 복호화 프록시 우회 (fetch 기반 Supabase SDK용)
const tlsInsecure =
  (fileEnv.JIRA_TEST_TLS_INSECURE || process.env.JIRA_TEST_TLS_INSECURE || "") === "1";
if (tlsInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const skipLive = !supabaseUrl || !supabaseKey;

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
const db = skipLive ? null : createClient(supabaseUrl, supabaseKey);

// ── 테스트 전용 상수 ──────────────────────────────────────────────────────────

const TEST_DATE = "9999-12-31";
const TEST_MEMBER = "test-integration";
const TEST_SPRINT = "test-sprint-integration";

// ── cleanup ───────────────────────────────────────────────────────────────────

after(async () => {
  if (!db) return;
  // PGRST205 (테이블 미존재) 는 무시
  await db.from("scrum_task_logs").delete().eq("member_id", TEST_MEMBER).eq("entry_date", TEST_DATE);
  await db.from("scrum_entries").delete().eq("member_id", TEST_MEMBER).eq("entry_date", TEST_DATE);
});

// ── 환경 안내 ─────────────────────────────────────────────────────────────────

describe("Supabase 환경 안내", () => {
  it("연결 설정 요약", () => {
    if (skipLive) {
      console.log(
        "[supabase-integration] skip: `.env.local` 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 설정하세요."
      );
    } else {
      const maskedKey =
        supabaseKey.length > 12
          ? `${supabaseKey.slice(0, 8)}…${supabaseKey.slice(-4)}`
          : "••••••••";
      console.log(
        `[supabase-integration] OK: url=${supabaseUrl} key=${maskedKey}`
      );
    }
  });
});

// ── Read 테스트 ───────────────────────────────────────────────────────────────

describe("Supabase read: jira_sprints", () => {
  it(
    "SELECT * — 배열 반환, 항목 있으면 id·sprint_name·status 필드 존재",
    { skip: skipLive },
    async () => {
      const { data, error } = await db
        .from("jira_sprints")
        .select("id, sprint_name, status, start_date, end_date")
        .order("updated_at", { ascending: false })
        .limit(10);

      assert.equal(error, null, `jira_sprints 조회 오류: ${error?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      console.log(`[jira_sprints] ${data.length}건 조회`);

      if (data.length > 0) {
        const row = data[0];
        assert.ok("id" in row, "id 필드 없음");
        assert.ok("sprint_name" in row, "sprint_name 필드 없음");
        assert.ok("status" in row, "status 필드 없음");
      }
    }
  );
});

describe("Supabase read: jira_tasks", () => {
  it(
    "SELECT (limit 5) — 배열 반환, 항목 있으면 issue_key·sprint_id·status 필드 존재",
    { skip: skipLive },
    async () => {
      const { data, error } = await db
        .from("jira_tasks")
        .select("id, issue_key, sprint_id, status, assignee_name")
        .order("updated_at", { ascending: false })
        .limit(5);

      assert.equal(error, null, `jira_tasks 조회 오류: ${error?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      console.log(`[jira_tasks] ${data.length}건 조회 (최대 5)`);

      if (data.length > 0) {
        const row = data[0];
        assert.ok("issue_key" in row, "issue_key 필드 없음");
        assert.ok("sprint_id" in row, "sprint_id 필드 없음");
        assert.ok("status" in row, "status 필드 없음");
      }
    }
  );
});

describe("Supabase read: scrum_entries", () => {
  it(
    "SELECT (limit 10) — 배열 반환, 항목 있으면 member_id·entry_date·selected_tasks 필드 존재",
    { skip: skipLive },
    async () => {
      const { data, error } = await db
        .from("scrum_entries")
        .select("id, entry_date, sprint_id, member_id, yesterday, today, blockers, selected_tasks")
        .order("entry_date", { ascending: false })
        .limit(10);

      assert.equal(error, null, `scrum_entries 조회 오류: ${error?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      console.log(`[scrum_entries] ${data.length}건 조회 (최대 10)`);

      if (data.length > 0) {
        const row = data[0];
        assert.ok("member_id" in row, "member_id 필드 없음");
        assert.ok("entry_date" in row, "entry_date 필드 없음");
        assert.ok("selected_tasks" in row, "selected_tasks 필드 없음");
        assert.ok(
          Array.isArray(row.selected_tasks),
          `selected_tasks 가 배열이어야 함 (실제: ${typeof row.selected_tasks})`
        );
      }
    }
  );
});

describe("Supabase read: scrum_member_sprints", () => {
  it(
    "SELECT * — 배열 반환, 항목 있으면 member_id·sprint_id 필드 존재",
    { skip: skipLive },
    async () => {
      const { data, error } = await db
        .from("scrum_member_sprints")
        .select("member_id, sprint_id, sprint_name")
        .order("created_at", { ascending: true })
        .limit(20);

      assert.equal(error, null, `scrum_member_sprints 조회 오류: ${error?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      console.log(`[scrum_member_sprints] ${data.length}건 조회`);

      if (data.length > 0) {
        const row = data[0];
        assert.ok("member_id" in row, "member_id 필드 없음");
        assert.ok("sprint_id" in row, "sprint_id 필드 없음");
      }
    }
  );
});

describe("Supabase read: team_member_display_settings", () => {
  it(
    "SELECT * — 배열 반환, 항목 있으면 member_id·show_scrum_history·show_analytics 필드 존재",
    { skip: skipLive },
    async () => {
      const { data, error } = await db
        .from("team_member_display_settings")
        .select("member_id, show_scrum_history, show_analytics")
        .order("member_id", { ascending: true });

      // PGRST205 = 테이블 미존재 (마이그레이션 미적용) — 경고 후 통과
      if (error?.code === "PGRST205") {
        console.warn("[team_member_display_settings] 테이블 미존재 (마이그레이션 필요) — 테스트 skip");
        return;
      }
      assert.equal(error, null, `team_member_display_settings 조회 오류: ${error?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      console.log(`[team_member_display_settings] ${data.length}건 조회`);

      if (data.length > 0) {
        const row = data[0];
        assert.ok("member_id" in row, "member_id 필드 없음");
        assert.ok("show_scrum_history" in row, "show_scrum_history 필드 없음");
        assert.ok("show_analytics" in row, "show_analytics 필드 없음");
      }
    }
  );
});

// ── Write + Read 라운드트립 ────────────────────────────────────────────────────

describe("Supabase write+read: scrum_entries 저장·조회 라운드트립", () => {
  it(
    "upsert → SELECT → 저장된 필드 검증",
    { skip: skipLive },
    async () => {
      // 1. upsert
      const { error: upsertErr } = await db.from("scrum_entries").upsert(
        {
          entry_date: TEST_DATE,
          sprint_id: TEST_SPRINT,
          member_id: TEST_MEMBER,
          yesterday: "[TEST-1] 통합테스트 전일 성과",
          today: "[TEST-1] 통합테스트 오늘 계획",
          blockers: "없음",
          selected_tasks: ["TEST-1"],
        },
        { onConflict: "entry_date,sprint_id,member_id" }
      );
      assert.equal(upsertErr, null, `scrum_entries upsert 오류: ${upsertErr?.message}`);

      // 2. fetch
      const { data, error: fetchErr } = await db
        .from("scrum_entries")
        .select("entry_date, sprint_id, member_id, yesterday, today, blockers, selected_tasks")
        .eq("entry_date", TEST_DATE)
        .eq("member_id", TEST_MEMBER)
        .single();

      assert.equal(fetchErr, null, `scrum_entries 조회 오류: ${fetchErr?.message}`);
      assert.ok(data, "저장된 항목을 찾을 수 없음");

      // 3. 필드 검증
      assert.equal(data.entry_date, TEST_DATE, "entry_date 불일치");
      assert.equal(data.member_id, TEST_MEMBER, "member_id 불일치");
      assert.ok(
        data.yesterday.includes("통합테스트 전일 성과"),
        `yesterday 내용 불일치: ${data.yesterday}`
      );
      assert.ok(
        data.today.includes("통합테스트 오늘 계획"),
        `today 내용 불일치: ${data.today}`
      );
      assert.deepEqual(data.selected_tasks, ["TEST-1"], "selected_tasks 불일치");
      console.log("[scrum_entries] 라운드트립 성공");
    }
  );
});

describe("Supabase write+read: scrum_task_logs 저장·조회 라운드트립", () => {
  it(
    "DELETE+INSERT → fetchScrumTaskLogs 패턴 → 이슈키·텍스트 검증",
    { skip: skipLive },
    async () => {
      // 1. 기존 rows 삭제 (batchUpsertScrumTaskLogs 동일 패턴)
      const { error: delErr } = await db
        .from("scrum_task_logs")
        .delete()
        .eq("member_id", TEST_MEMBER)
        .eq("entry_date", TEST_DATE)
        .eq("sprint_id", TEST_SPRINT);

      // PGRST205 = 테이블 미존재 (마이그레이션 미적용) — 경고 후 통과
      if (delErr?.code === "PGRST205") {
        console.warn("[scrum_task_logs] 테이블 미존재 (마이그레이션 필요) — 테스트 skip");
        return;
      }
      assert.equal(delErr, null, `scrum_task_logs DELETE 오류: ${delErr?.message}`);

      // 2. 새 rows upsert
      const { error: upsertErr } = await db.from("scrum_task_logs").upsert(
        [
          {
            entry_date: TEST_DATE,
            sprint_id: TEST_SPRINT,
            member_id: TEST_MEMBER,
            issue_key: "TEST-1",
            jira_issue_id: null,
            yesterday: "전일 통합테스트 완료",
            today: "오늘 통합테스트 계획",
            updated_at: new Date().toISOString(),
          },
          {
            entry_date: TEST_DATE,
            sprint_id: TEST_SPRINT,
            member_id: TEST_MEMBER,
            issue_key: "TEST-2",
            jira_issue_id: null,
            yesterday: "",
            today: "오늘 TEST-2 작업",
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "entry_date,sprint_id,member_id,issue_key" }
      );
      assert.equal(upsertErr, null, `scrum_task_logs upsert 오류: ${upsertErr?.message}`);

      // 3. fetch (fetchScrumTaskLogs 동일 쿼리 패턴)
      const { data, error: fetchErr } = await db
        .from("scrum_task_logs")
        .select("issue_key, jira_issue_id, yesterday, today")
        .eq("member_id", TEST_MEMBER)
        .eq("entry_date", TEST_DATE)
        .eq("sprint_id", TEST_SPRINT);

      assert.equal(fetchErr, null, `scrum_task_logs 조회 오류: ${fetchErr?.message}`);
      assert.ok(Array.isArray(data), "data 가 배열이어야 함");
      assert.equal(data.length, 2, `2건 기대, 실제 ${data.length}건`);

      // 4. 내용 검증
      const byKey = Object.fromEntries(data.map((r) => [r.issue_key, r]));
      assert.ok(byKey["TEST-1"], "TEST-1 row 없음");
      assert.equal(
        byKey["TEST-1"].yesterday,
        "전일 통합테스트 완료",
        `TEST-1 yesterday 불일치: ${byKey["TEST-1"].yesterday}`
      );
      assert.equal(
        byKey["TEST-1"].today,
        "오늘 통합테스트 계획",
        `TEST-1 today 불일치: ${byKey["TEST-1"].today}`
      );
      assert.ok(byKey["TEST-2"], "TEST-2 row 없음");
      assert.equal(byKey["TEST-2"].today, "오늘 TEST-2 작업");
      console.log("[scrum_task_logs] 라운드트립 성공 (2건)");
    }
  );
});
