/**
 * JIRA Agile API → Supabase `jira_sprints` 전체 교체 동기화
 * (upsert만 하면 스프린트명 변경 시 구 이름 행이 DB에 남음 → 매 회 전체 삭제 후 재삽입)
 *
 * GitHub Actions · 로컬 CLI (Node, Vite/브라우저 의존성 없음)
 */
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./loadEnvLocal.js";

export interface JiraSprintUpsertRow {
  sprint_name: string;
  status: string;
  remaining_days: number;
}

interface JiraSprintApiValue {
  id: number;
  name: string;
  state: string;
  endDate?: string;
}

function env(key: string, fallbacks: string[] = []): string {
  const keys = [key, ...fallbacks];
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

function statusLabel(state: string): string {
  if (state === "active") return "진행 중";
  if (state === "closed") return "종료";
  if (state === "future") return "예정";
  return state;
}

function remainingDays(endDate?: string): number {
  if (!endDate) return 0;
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
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

function mapSprintRow(sp: JiraSprintApiValue): JiraSprintUpsertRow {
  return {
    sprint_name: sp.name,
    status: statusLabel(sp.state),
    remaining_days: remainingDays(sp.endDate),
  };
}

/** JIRA REST에서 보드 스프린트 전체 조회 (페이지네이션) */
export async function fetchSprintsFromJiraApi(options: {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  boardId: string;
  tlsInsecure?: boolean;
}): Promise<JiraSprintUpsertRow[]> {
  const base = options.jiraBaseUrl.replace(/\/+$/, "");
  const boardId = options.boardId.trim();
  if (!/^\d+$/.test(boardId)) {
    throw new Error("JIRA_BOARD_ID must be a numeric board id");
  }

  const auth = Buffer.from(`${options.jiraEmail}:${options.jiraApiToken}`, "utf8").toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "X-Atlassian-Token": "no-check",
  };
  const tls = Boolean(options.tlsInsecure);
  const maxResults = 50;
  const all: JiraSprintApiValue[] = [];
  let startAt = 0;

  for (;;) {
    const path = `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&startAt=${startAt}&maxResults=${maxResults}`;
    const url = `${base}${path}`;
    const page = await httpsGetJson<{
      values?: JiraSprintApiValue[];
      isLast?: boolean;
    }>(url, headers, tls);

    const values = page.values ?? [];
    all.push(...values);
    if (page.isLast === true || values.length < maxResults) break;
    startAt += maxResults;
    if (startAt > 500) break;
  }

  const byName = new Map<string, JiraSprintUpsertRow>();
  for (const sp of all) {
    if (!sp.name?.trim()) continue;
    byName.set(sp.name, mapSprintRow(sp));
  }
  return [...byName.values()].sort((a, b) => a.sprint_name.localeCompare(b.sprint_name, "ko"));
}

/** 기존 jira_sprints(sprint_name 있는 행) 전부 삭제 */
export async function clearJiraSprintsInSupabase(options: {
  supabaseUrl: string;
  supabaseKey: string;
}): Promise<void> {
  const supabase = createClient(options.supabaseUrl, options.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
  if (error) throw new Error(`Supabase clear failed: ${error.message}`);
}

/** Supabase jira_sprints 전체 교체 (삭제 → 삽입) */
export async function replaceJiraSprintsInSupabase(
  rows: JiraSprintUpsertRow[],
  options: { supabaseUrl: string; supabaseKey: string }
): Promise<number> {
  const supabase = createClient(options.supabaseUrl, options.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  const { error: deleteError } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
  if (deleteError) throw new Error(`Supabase clear failed: ${deleteError.message}`);

  if (rows.length === 0) {
    console.log("[syncJira] No sprints from JIRA — table cleared.");
    return 0;
  }

  const payload = rows.map((r) => ({
    sprint_name: r.sprint_name,
    status: r.status,
    remaining_days: r.remaining_days,
    updated_at: now,
  }));

  const { error: insertError } = await supabase.from("jira_sprints").insert(payload);
  if (insertError) throw new Error(`Supabase insert failed: ${insertError.message}`);

  return rows.length;
}

/** @deprecated replaceJiraSprintsInSupabase 사용 */
export async function upsertJiraSprintsToSupabase(
  rows: JiraSprintUpsertRow[],
  options: { supabaseUrl: string; supabaseKey: string }
): Promise<number> {
  return replaceJiraSprintsInSupabase(rows, options);
}

/** 환경 변수 로드 후 동기화 1회 실행 */
export async function runJiraSprintSync(): Promise<{ count: number }> {
  const supabaseUrl = env("SUPABASE_URL", ["VITE_SUPABASE_URL"]);
  const supabaseKey =
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    env("SUPABASE_ANON_KEY", ["VITE_SUPABASE_ANON_KEY"]);
  const jiraBase = env("JIRA_BASE_URL", ["VITE_JIRA_BASE_URL"]);
  const jiraEmail = env("JIRA_EMAIL", ["VITE_JIRA_EMAIL"]);
  const jiraToken = env("JIRA_API_TOKEN", ["VITE_JIRA_API_TOKEN"]);
  const boardId = env("JIRA_BOARD_ID", ["VITE_JIRA_BOARD_ID"]);
  const tlsInsecure = process.env.JIRA_TEST_TLS_INSECURE === "1";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)");
  if (!jiraBase) missing.push("JIRA_BASE_URL");
  if (!jiraEmail) missing.push("JIRA_EMAIL");
  if (!jiraToken) missing.push("JIRA_API_TOKEN");
  if (!boardId) missing.push("JIRA_BOARD_ID");
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  if (tlsInsecure) {
    console.warn("[syncJira] JIRA_TEST_TLS_INSECURE=1 — TLS certificate verification disabled.");
  }

  console.log(`[syncJira] Fetching all sprints from board ${boardId} (full list) …`);
  const rows = await fetchSprintsFromJiraApi({
    jiraBaseUrl: jiraBase,
    jiraEmail,
    jiraApiToken: jiraToken,
    boardId,
    tlsInsecure,
  });

  console.log(`[syncJira] Replacing jira_sprints (${rows.length} row(s), clear + insert) …`);
  const count = await replaceJiraSprintsInSupabase(rows, { supabaseUrl, supabaseKey });

  console.log(`[syncJira] Done. ${count} sprint(s) synced at ${new Date().toISOString()}`);
  return { count };
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("syncJira.ts") || process.argv[1].endsWith("syncJira.js"));

if (isMain) {
  loadEnvLocal();
  runJiraSprintSync()
    .then(({ count }) => {
      process.exitCode = count >= 0 ? 0 : 1;
    })
    .catch((err) => {
      console.error("[syncJira] Failed:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
