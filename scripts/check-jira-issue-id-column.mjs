/**
 * Remote jira_tasks.jira_issue_id column check
 * node scripts/check-jira-issue-id-column.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const env = { ...process.env };
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
    env[t.slice(0, eq).trim()] = val;
  }
}

if (env.JIRA_TEST_TLS_INSECURE === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const host = new URL(url).hostname;

const { error: withCol } = await supabase
  .from("jira_tasks")
  .select("jira_issue_id, issue_key")
  .limit(1);

const { error: legacy } = await supabase
  .from("jira_tasks")
  .select("issue_key, updated_at")
  .limit(1);

const result = {
  host,
  hypothesisId: "H1",
  jira_issue_id_select: withCol?.message ?? "OK",
  legacy_select: legacy?.message ?? "OK",
  pgCode: withCol?.code ?? null,
};

console.log(JSON.stringify(result, null, 2));
process.exit(withCol ? 1 : 0);
