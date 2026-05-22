import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("FAIL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const testId = `_db_verify_${Date.now()}`;
const testPw = "x";
const testMember = "kim";

const checks = [];

async function run() {
  // 1) JIRA table (existing project sanity)
  const jira = await supabase.from("jira_sprints").select("id", { count: "exact", head: true });
  checks.push({
    name: "jira_sprints",
    ok: !jira.error,
    detail: jira.error?.message ?? `reachable (count ${jira.count ?? "?"})`,
  });

  // 2) register_app_user RPC
  const reg = await supabase.rpc("register_app_user", {
    p_login_id: testId,
    p_password: testPw,
    p_member_id: testMember,
    p_display_name: "DB Verify",
  });
  checks.push({
    name: "register_app_user",
    ok: !reg.error && reg.data?.login_id === testId.toLowerCase(),
    detail: reg.error?.message ?? JSON.stringify(reg.data),
  });

  // 3) login_app_user RPC
  const login = await supabase.rpc("login_app_user", {
    p_login_id: testId,
    p_password: testPw,
  });
  checks.push({
    name: "login_app_user",
    ok: !login.error && login.data?.member_id === testMember,
    detail: login.error?.message ?? `member_id=${login.data?.member_id}`,
  });

  // 4) duplicate id should fail
  const dup = await supabase.rpc("register_app_user", {
    p_login_id: testId,
    p_password: testPw,
    p_member_id: testMember,
    p_display_name: "",
  });
  const dupMsg = dup.error?.message ?? "";
  checks.push({
    name: "register duplicate blocked",
    ok: Boolean(dup.error) && !dupMsg.includes("fetch failed"),
    detail: dupMsg || "unexpected success",
  });

  // 5) wrong password should fail
  const bad = await supabase.rpc("login_app_user", {
    p_login_id: testId,
    p_password: "wrong-password-xyz",
  });
  const badMsg = bad.error?.message ?? "";
  checks.push({
    name: "login wrong password blocked",
    ok: Boolean(bad.error) && !badMsg.includes("fetch failed"),
    detail: badMsg || "unexpected success",
  });

  console.log("\n=== Supabase auth DB verification ===\n");
  console.log(`Project: ${url}\n`);
  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? "OK" : "FAIL";
    if (!c.ok) allOk = false;
    console.log(`[${mark}] ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }

  if (allOk) {
    console.log("All checks passed. Signup/login should work in the app.\n");
    process.exit(0);
  } else {
    console.log("Some checks failed. Review SQL migrations in Supabase.\n");
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
