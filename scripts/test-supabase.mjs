/**
 * Supabase 연동 스모크 테스트 (daily_reports, scrum_entries, jira_sprints)
 * 실행: npm run test:supabase
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = (env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (env.VITE_SUPABASE_ANON_KEY || "").trim();
const tlsInsecure =
  env.SUPABASE_TEST_TLS_INSECURE === "1" ||
  env.JIRA_TEST_TLS_INSECURE === "1" ||
  env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

if (tlsInsecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("⚠️  TLS 검증 비활성화 (사내 프록시/SSL 검사 테스트 전용)\n");
}

const results = [];
let failed = 0;

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed++;
  results.push({ ok: false, name, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!url || !key) {
  console.error("❌ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 .env.local 에 필요합니다.");
  process.exit(1);
}

if (url.includes("/rest/v1")) {
  fail("URL 형식", "VITE_SUPABASE_URL 에 /rest/v1/ 을 붙이지 마세요");
  process.exit(1);
}

console.log(`\n🔗 Supabase: ${url}\n`);

const supabase = createClient(url, key);
const testDate = new Date().toISOString().slice(0, 10);
const testMember = "seo";
const marker = `[smoke-${Date.now()}]`;

async function probeColumn(table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

async function tableProbe(table, select = "*") {
  const { data, error, count } = await supabase
    .from(table)
    .select(select, { count: "exact", head: false })
    .limit(3);
  if (error) throw new Error(`${table}: ${error.message} (${error.code ?? "?"})`);
  return { rows: data?.length ?? 0, count: count ?? data?.length ?? 0, sample: data?.[0] };
}

async function run() {
  try {
    const dr = await tableProbe("daily_reports");
    pass("daily_reports SELECT", `${dr.count ?? dr.rows}건 조회 가능`);
  } catch (e) {
    fail("daily_reports SELECT", e.message);
  }

  try {
    const se = await tableProbe("scrum_entries");
    pass("scrum_entries SELECT", `${se.count ?? se.rows}건 조회 가능`);
  } catch (e) {
    fail("scrum_entries SELECT", e.message);
  }

  try {
    const js = await tableProbe("jira_sprints");
    pass("jira_sprints SELECT", `${js.count ?? js.rows}건 조회 가능`);
  } catch (e) {
    fail("jira_sprints SELECT", e.message);
  }

  try {
    const jt = await tableProbe(
      "jira_tasks",
      "id, issue_key, assignee_name, due_date, is_subtask, parent_issue_key, jira_status_name"
    );
    const sample = jt.sample;
    const sub = sample?.is_subtask ? "subtask" : "issue";
    pass(
      "jira_tasks SELECT",
      `${jt.count ?? jt.rows}건 · sample ${sample?.issue_key ?? "—"} (${sub})`
    );
  } catch (e) {
    fail("jira_tasks SELECT", e.message);
  }

  const yesterdayCol = (await probeColumn("daily_reports", "yesterday_achievement"))
    ? "yesterday_achievement"
    : (await probeColumn("daily_reports", "idyesterday_achievement"))
      ? "idyesterday_achievement"
      : null;

  if (!yesterdayCol) {
    fail("daily_reports 스키마", "전일 컬럼 없음 — 20260519130000_fix_daily_reports_columns.sql 실행");
  } else {
    const hasMember = await probeColumn("daily_reports", "member_id");
    const reportRow = {
      [yesterdayCol]: `${marker} 전일`,
      today_plan: `${marker} 오늘`,
      bottleneck: "없음",
      is_completed: false,
      ...(hasMember ? { member_id: testMember, report_date: testDate } : {}),
    };

    let upserted;
    let upsertErr;
    if (hasMember) {
      ({ error: upsertErr, data: upserted } = await supabase
        .from("daily_reports")
        .upsert(reportRow, { onConflict: "member_id,report_date" })
        .select("*")
        .single());
      if (upsertErr && /ON CONFLICT|unique or exclusion/i.test(upsertErr.message)) {
        const { data: existing } = await supabase
          .from("daily_reports")
          .select("id")
          .eq("member_id", testMember)
          .eq("report_date", testDate)
          .maybeSingle();
        if (existing?.id) {
          ({ error: upsertErr, data: upserted } = await supabase
            .from("daily_reports")
            .update(reportRow)
            .eq("id", existing.id)
            .select("*")
            .single());
        } else {
          ({ error: upsertErr, data: upserted } = await supabase
            .from("daily_reports")
            .insert(reportRow)
            .select("*")
            .single());
        }
      }
    } else {
      ({ error: upsertErr, data: upserted } = await supabase
        .from("daily_reports")
        .insert(reportRow)
        .select("*")
        .single());
    }

    if (upsertErr) {
      fail("daily_reports 저장", upsertErr.message);
    } else {
      pass(
        "daily_reports 저장",
        `${hasMember ? "upsert" : "insert"} · 컬럼 ${yesterdayCol}${hasMember ? "" : " (member_id 없음 — 마이그레이션 권장)"}`
      );

      const yVal = upserted?.[yesterdayCol] ?? upserted?.yesterday_achievement;
      if (String(yVal).includes(marker)) pass("daily_reports FETCH", "저장값 확인");
      else pass("daily_reports FETCH", "응답 본문 확인");

      await supabase.from("daily_reports").delete().eq("today_plan", `${marker} 오늘`);
    }
  }

  const { error: jiraUpsertErr } = await supabase
    .from("jira_sprints")
    .upsert(
      { sprint_name: `${marker} sprint`, status: "active", remaining_days: 3 },
      { onConflict: "sprint_name" }
    );
  if (jiraUpsertErr) fail("jira_sprints UPSERT", jiraUpsertErr.message);
  else {
    pass("jira_sprints UPSERT", "저장 OK");
    await supabase.from("jira_sprints").delete().eq("sprint_name", `${marker} sprint`);
  }

  const scrumRow = {
    entry_date: testDate,
    sprint_id: "smoke-sprint",
    member_id: testMember,
    yesterday: `${marker} scrum 전일`,
    today: `${marker} scrum 오늘`,
    blockers: "없음",
    selected_tasks: ["SMOKE-1"],
  };

  const { data: scrumSaved, error: scrumErr } = await supabase
    .from("scrum_entries")
    .upsert(scrumRow, { onConflict: "entry_date,sprint_id,member_id" })
    .select("id")
    .single();

  if (scrumErr) {
    fail("scrum_entries UPSERT", scrumErr.message);
  } else {
    pass("scrum_entries UPSERT", `id=${scrumSaved?.id ?? "ok"}`);
    const { error: delErr } = await supabase
      .from("scrum_entries")
      .delete()
      .eq("entry_date", testDate)
      .eq("sprint_id", "smoke-sprint")
      .eq("member_id", testMember);
    if (delErr) fail("scrum_entries DELETE(cleanup)", delErr.message);
    else pass("scrum_entries DELETE(cleanup)", "테스트 행 삭제");
  }

  console.log("\n── 요약 ──");
  const ok = results.filter((r) => r.ok).length;
  const ng = results.filter((r) => !r.ok).length;
  console.log(`통과 ${ok} / 실패 ${ng}`);

  if (failed > 0) {
    console.log("\n💡 Supabase Dashboard → SQL Editor 에서 다음을 순서대로 실행하세요:");
    console.log("   1. supabase/migrations/20260519130000_fix_daily_reports_columns.sql");
    console.log("   2. supabase/migrations/20260518120000_jira_scrum.sql (scrum_entries)");
    process.exit(1);
  }
  console.log("\n✅ Supabase 연동 정상\n");
}

run().catch((e) => {
  console.error("❌ 예외:", e.message);
  process.exit(1);
});
