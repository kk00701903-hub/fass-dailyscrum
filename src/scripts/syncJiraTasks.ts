/**
 * JIRA 이슈·서브태스크 → Supabase jira_tasks (CLI)
 * npm run sync:jira:tasks
 */
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./loadEnvLocal.js";
import {
  jiraIssueFieldsQuery,
  mapIssueToDbRow,
  type JiraIssueRaw,
  type JiraTaskDbRow,
} from "../lib/jira-issue-mapper.js";

loadEnvLocal();

function env(key: string, fallbacks: string[] = []): string {
  for (const k of [key, ...fallbacks]) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

function httpsGetJson<T>(url: string, headers: Record<string, string>, tlsInsecure: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers,
        agent: tlsInsecure ? new https.Agent({ rejectUnauthorized: false }) : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown;
          try {
            body = text ? JSON.parse(text) : {};
          } catch {
            body = { raw: text.slice(0, 400) };
          }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body as T);
            return;
          }
          const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
          const msg =
            (Array.isArray(b?.errorMessages) ? (b.errorMessages as string[]).join(" · ") : null) ||
            (b?.message ? String(b.message) : null) ||
            text.slice(0, 300);
          reject(new Error(`JIRA HTTP ${res.statusCode}: ${msg}`));
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
}

export async function fetchTasksFromJiraApi(options: {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  boardId: string;
  storyField: string;
  tlsInsecure?: boolean;
}): Promise<JiraTaskDbRow[]> {
  const base = options.jiraBaseUrl.replace(/\/+$/, "");
  const auth = Buffer.from(`${options.jiraEmail}:${options.jiraApiToken}`, "utf8").toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "X-Atlassian-Token": "no-check",
  };
  const tls = Boolean(options.tlsInsecure);
  const fields = jiraIssueFieldsQuery(options.storyField);
  const syncedAt = new Date().toISOString();

  const sprintRes = await httpsGetJson<{ values?: JiraSprintApiValue[] }>(
    `${base}/rest/agile/1.0/board/${options.boardId}/sprint?state=active,closed,future&maxResults=50`,
    headers,
    tls
  );

  const sprints = sprintRes.values ?? [];
  const closed = sprints.filter((s) => s.state === "closed").slice(-3);
  const toSync = [...sprints.filter((s) => s.state === "active" || s.state === "future"), ...closed];

  const byId = new Map<string, JiraTaskDbRow>();

  for (const sp of toSync) {
    const sprintId = `jira-sprint-${sp.id}`;
    let startAt = 0;
    const maxResults = 50;

    for (;;) {
      const url = `${base}/rest/agile/1.0/sprint/${sp.id}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
      const page = await httpsGetJson<{ issues?: JiraIssueRaw[]; isLast?: boolean }>(url, headers, tls);
      const issues = page.issues ?? [];
      for (const issue of issues) {
        byId.set(issue.id, mapIssueToDbRow(issue, sprintId, options.storyField, syncedAt));
      }
      if (page.isLast === true || issues.length < maxResults) break;
      startAt += maxResults;
      if (startAt > 500) break;
    }
  }

  return [...byId.values()];
}

export async function replaceJiraTasksInSupabase(
  rows: JiraTaskDbRow[],
  options: { supabaseUrl: string; supabaseKey: string }
): Promise<number> {
  const supabase = createClient(options.supabaseUrl, options.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteError } = await supabase.from("jira_tasks").delete().not("issue_key", "is", null);
  if (deleteError) throw new Error(`Supabase clear failed: ${deleteError.message}`);

  if (rows.length === 0) return 0;

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await supabase.from("jira_tasks").insert(rows.slice(i, i + chunkSize));
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return rows.length;
}

export async function runJiraTasksSync(): Promise<{ count: number; subtasks: number }> {
  const supabaseUrl = env("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
  const supabaseKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);
  const jiraBase = env("JIRA_BASE_URL", ["VITE_JIRA_BASE_URL"]);
  const jiraEmail = env("JIRA_EMAIL", ["VITE_JIRA_EMAIL"]);
  const jiraToken = env("JIRA_API_TOKEN", ["VITE_JIRA_API_TOKEN"]);
  const boardId = env("JIRA_BOARD_ID", ["VITE_JIRA_BOARD_ID"]);
  const storyField = env("JIRA_STORY_POINTS_FIELD", ["VITE_JIRA_STORY_POINTS_FIELD"]) || "customfield_10016";
  const tlsInsecure = process.env.JIRA_TEST_TLS_INSECURE === "1";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseKey) missing.push("SUPABASE_ANON_KEY");
  if (!jiraBase) missing.push("JIRA_BASE_URL");
  if (!jiraEmail) missing.push("JIRA_EMAIL");
  if (!jiraToken) missing.push("JIRA_API_TOKEN");
  if (!boardId) missing.push("JIRA_BOARD_ID");
  if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);

  console.log(`[syncJiraTasks] Fetching issues from board ${boardId} …`);
  const rows = await fetchTasksFromJiraApi({
    jiraBaseUrl: jiraBase,
    jiraEmail,
    jiraApiToken: jiraToken,
    boardId,
    storyField,
    tlsInsecure,
  });

  const subtasks = rows.filter((r) => r.is_subtask).length;
  console.log(`[syncJiraTasks] Replacing jira_tasks (${rows.length} issues, ${subtasks} subtasks) …`);
  const count = await replaceJiraTasksInSupabase(rows, { supabaseUrl, supabaseKey });
  console.log(`[syncJiraTasks] Done. ${count} row(s).`);
  return { count, subtasks };
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("syncJiraTasks.ts") || process.argv[1].endsWith("syncJiraTasks.js"));

if (isMain) {
  runJiraTasksSync()
    .then(({ count, subtasks }) => {
      console.log(`[syncJiraTasks] Summary: ${count} total, ${subtasks} subtasks`);
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error("[syncJiraTasks] Failed:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
