/**
 * Edge Function 호출 점검 (민감 값 출력 없음)
 * node scripts/test-edge-invoke.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 없음");
  process.exit(1);
}

if (env.JIRA_TEST_TLS_INSECURE === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const supabase = createClient(url, key);

async function invokeRaw(fn, body) {
  const endpoint = `${url}/functions/v1/${fn}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

for (const fn of ["sync-jira-all", "jira-proxy", "sync-jira-sprints"]) {
  const body =
    fn === "jira-proxy" ? { path: "/rest/api/3/myself", method: "GET" } : {};
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke(fn, { body });
  const ms = Date.now() - t0;
  const raw = await invokeRaw(fn, body);
  if (error) {
    console.log(`${fn}: SDK FAIL (${ms}ms) — ${error.message}`);
    const body = JSON.stringify(raw.json).slice(0, 400);
    console.log(`       HTTP ${raw.status} — ${body}`);
    if (/시크릿을.*설정/i.test(body)) {
      console.log(
        "       → Edge Functions → Secrets (Vault 아님). npm run secrets:push-jira"
      );
    } else if (/401|authenticated/i.test(body)) {
      console.log(
        "       → JIRA_EMAIL + JIRA_API_TOKEN 불일치·만료. Edge Secrets 갱신 (Vault 무관)."
      );
      console.log("       → npm run secrets:push-jira  또는 GitHub Actions secrets 동기화");
    } else if (/jira_issue_id.*does not exist/i.test(body)) {
      console.log("       → SQL: scripts/apply-jira-issue-id-migration.sql 실행");
    }
    continue;
  }
  const preview =
    typeof data === "object" && data !== null
      ? JSON.stringify(data).slice(0, 180)
      : String(data ?? "").slice(0, 180);
  console.log(`${fn}: OK (${ms}ms) — ${preview}`);
}
