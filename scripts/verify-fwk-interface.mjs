/**
 * FWK 인터페이스 3-way 검증: Supabase ↔ 앱 로직 ↔ JIRA REST
 * node scripts/verify-fwk-interface.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvLocal,
  mergeProcessEnv,
  createJiraHttpClient,
  isPlaceholderJiraBase,
} from "./jira-test-lib.mjs";
import { createSupabaseTestClient } from "./supabase-test-client.mjs";
import {
  JIRA_KIM_BOARD_KEYS,
  KIM_MEMBER_ID,
  KIM_MEMBER_NAME,
  dbRowToJiraTask,
  parseFwkTestKeys,
} from "../tests/fixtures/fwk-kim-golden.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = mergeProcessEnv(loadEnvLocal(root));
const fwkKeys = parseFwkTestKeys(env.JIRA_TEST_FWK_KEYS);

let failed = 0;
let skipped = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
}
function fail(msg) {
  failed++;
  console.error(`❌ ${msg}`);
}
function skip(msg) {
  skipped++;
  console.warn(`⏭️  ${msg}`);
}
function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

console.log("\n=== FWK 인터페이스 3-way 검증 ===\n");
console.log(`골든 키: ${fwkKeys.join(", ")}\n`);

/** @type {Map<string, { source: string; status: string; assignee: string; summary: string }>} */
const matrix = new Map();

function setMatrix(key, source, row) {
  const prev = matrix.get(key) ?? {};
  matrix.set(key, { ...prev, [source]: row });
}

// ── Phase A: Supabase ──
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
let dbKimActive = [];

if (!url || !anonKey) {
  skip("Phase A Supabase: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 없음");
} else {
  console.log("── Phase A: Supabase jira_tasks ──\n");
  const supabase = createSupabaseTestClient(url, anonKey, env);
  const { data: tasks, error } = await supabase
    .from("jira_tasks")
    .select(
      "id, issue_key, sprint_id, summary, status, priority, assignee_id, assignee_name, assignee_role, assignee_color, story_points, updated_at, labels, due_date, created_at, resolved_at, issue_type, parent_issue_key, parent_id, is_subtask, jira_status_name"
    )
    .order("issue_key");

  if (error) {
    fail(`Supabase 조회 실패: ${error.message}`);
  } else {
    const kimAll = (tasks ?? []).filter(
      (t) => t.assignee_id === KIM_MEMBER_ID || String(t.assignee_name).trim() === KIM_MEMBER_NAME
    );
    dbKimActive = kimAll.filter((t) => t.status !== "DONE");
    const dbKeys = new Set(dbKimActive.map((t) => t.issue_key));
    const missing = fwkKeys.filter((k) => !dbKeys.has(k));
    const extraFwk = [...dbKeys].filter(
      (k) => k.startsWith("FWK-") && !fwkKeys.includes(k)
    );

    pass(`김희찬 active work: ${dbKimActive.length}건`);
    for (const t of dbKimActive) {
      const canSelect = t.status !== "TODO" ? "선택가능" : "표시만";
      console.log(
        `    ${t.issue_key} ${t.status} [${canSelect}] — ${(t.summary ?? "").slice(0, 40)}`
      );
      setMatrix(t.issue_key, "db", {
        status: t.status,
        assignee: `${t.assignee_id}/${t.assignee_name}`,
        summary: (t.summary ?? "").slice(0, 30),
      });
    }

    if (missing.length) fail(`DB 누락 키: ${missing.join(", ")}`);
    else pass("골든 FWK 키 모두 DB에 존재");
    if (extraFwk.length) warn(`DB 추가 FWK-*: ${extraFwk.join(", ")}`);

    const stale = dbKimActive.filter((t) => {
      if (!t.updated_at) return false;
      const age = Date.now() - new Date(t.updated_at).getTime();
      return age > 24 * 60 * 60 * 1000;
    });
    if (stale.length) {
      warn(
        `Phase C: ${stale.length}건 updated_at 24h+ 경과 → npm run sync:jira:all 권장 (${stale.map((t) => t.issue_key).join(", ")})`
      );
    }

    try {
      const { getMemberActiveAssignedTasks } = await import("../src/lib/scrum-backlog.ts");
      const { setJiraDataCache, clearJiraDataCache } = await import(
        "../src/lib/jira-data-registry.ts"
      );
      const mapped = (tasks ?? []).map(dbRowToJiraTask);
      setJiraDataCache(mapped, []);
      const appFlat = getMemberActiveAssignedTasks(KIM_MEMBER_ID);
      const appKeys = appFlat.map((t) => t.key).sort();
      const dbActiveKeys = dbKimActive.map((t) => t.issue_key).sort();
      if (JSON.stringify(appKeys) === JSON.stringify(dbActiveKeys)) {
        pass(`앱 로직 키 집합 = DB active work (${appKeys.join(", ") || "(없음)"})`);
      } else {
        fail(`앱 로직 키 ≠ DB: app=[${appKeys}] db=[${dbActiveKeys}]`);
      }
      for (const t of appFlat) {
        setMatrix(t.key, "app", {
          status: t.status,
          assignee: t.assignee.name,
          summary: (t.summary ?? "").slice(0, 30),
        });
      }
      clearJiraDataCache();
    } catch (e) {
      fail(`앱 로직 재계산 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ── Phase B: JIRA REST ──
const client = createJiraHttpClient(env);
if (!client || isPlaceholderJiraBase(client.base)) {
  skip("Phase B JIRA REST: 자격 없음 또는 placeholder URL");
} else {
  console.log("\n── Phase B: JIRA REST ──\n");
  const pk = (client.projectKey || "FWK").trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(pk)) {
    fail(`유효하지 않은 project key: ${pk}`);
  } else {
    const keysClause = fwkKeys.map((k) => `"${k}"`).join(", ");
    const jql = `project = ${pk} AND key in (${keysClause}) ORDER BY key`;
    try {
      const r = await client.request("POST", "/rest/api/3/search/jql", {
        jql,
        maxResults: 10,
        fields: ["summary", "status", "assignee"],
      });
      if (r.status !== 200) {
        fail(`JQL HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 300)}`);
      } else {
        const issues = r.json?.issues ?? [];
        pass(`JQL ${issues.length}건: ${jql}`);
        const jiraKeys = new Set();
        for (const issue of issues) {
          const key = issue.key;
          jiraKeys.add(key);
          const statusName = issue.fields?.status?.name ?? "?";
          const assignee = issue.fields?.assignee?.displayName ?? "(없음)";
          console.log(`    ${key} [${statusName}] ${assignee} — ${(issue.fields?.summary ?? "").slice(0, 40)}`);
          setMatrix(key, "jira", {
            status: statusName,
            assignee,
            summary: (issue.fields?.summary ?? "").slice(0, 30),
          });
        }
        const missingJira = fwkKeys.filter((k) => !jiraKeys.has(k));
        if (missingJira.length) fail(`JIRA 누락 키: ${missingJira.join(", ")}`);
        else pass("골든 FWK 키 모두 JIRA에서 조회됨");
      }
    } catch (e) {
      fail(`JIRA 요청 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ── 3-way diff table ──
if (matrix.size > 0) {
  console.log("\n── 3-way 요약 (키별) ──\n");
  console.log(
    "키".padEnd(12) +
      "DB status".padEnd(14) +
      "App status".padEnd(14) +
      "JIRA status".padEnd(16) +
      "비고"
  );
  for (const key of fwkKeys) {
    const m = matrix.get(key) ?? {};
    const db = m.db?.status ?? "—";
    const app = m.app?.status ?? "—";
    const jira = m.jira?.status ?? "—";
    const note =
      db !== "—" && app !== "—" && db !== app
        ? "DB≠App"
        : db === "—"
          ? "DB없음"
          : jira === "—"
            ? "JIRA skip"
            : "OK";
    console.log(
      key.padEnd(12) +
        String(db).padEnd(14) +
        String(app).padEnd(14) +
        String(jira).padEnd(16) +
        note
    );
  }
}

console.log(`\n결과: failed=${failed} skipped=${skipped}\n`);
if (failed > 0) process.exit(1);
process.exit(0);
