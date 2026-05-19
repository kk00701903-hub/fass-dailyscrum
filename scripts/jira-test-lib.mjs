/**
 * JIRA Cloud REST — CLI·통합테스트 공용 (Node, CORS 없음).
 * 디버그: `JIRA_TEST_DEBUG=1` (또는 .env.local)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import https from "node:https";

const ENV_KEYS = [
  "VITE_JIRA_BASE_URL",
  "VITE_JIRA_EMAIL",
  "VITE_JIRA_API_TOKEN",
  "VITE_JIRA_PROJECT_KEY",
  "VITE_JIRA_BOARD_ID",
  "JIRA_TEST_TLS_INSECURE",
  "JIRA_TEST_DEBUG",
];

export function loadEnvLocal(projectRoot) {
  const p = resolve(projectRoot, ".env.local");
  if (!existsSync(p)) return {};
  const raw = readFileSync(p, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** 셸에서 덮어쓴 값이 있으면 우선 (CI·로컬 일회 실행용). */
export function mergeProcessEnv(fileEnv) {
  const out = { ...fileEnv };
  for (const k of ENV_KEYS) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") out[k] = v;
  }
  return out;
}

export function normBase(url) {
  const u = (url || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

/** 예시·플레이스홀더 URL이면 실제 JIRA 호출 테스트를 하지 않습니다. */
export function isPlaceholderJiraBase(base) {
  if (!base) return true;
  try {
    const h = new URL(base).hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    if (h.includes("your-org") || h.includes("example.") || h.includes("placeholder")) return true;
    return false;
  } catch {
    return true;
  }
}

function isTlsInsecure(env) {
  return process.env.JIRA_TEST_TLS_INSECURE === "1" || String(env.JIRA_TEST_TLS_INSECURE || "").trim() === "1";
}

function isDebug(env) {
  return process.env.JIRA_TEST_DEBUG === "1" || String(env.JIRA_TEST_DEBUG || "").trim() === "1";
}

/**
 * @param {string} urlString
 * @param {{ method?: string; headers: Record<string, string>; body?: string }} opts
 */
function httpsRequest(urlString, opts) {
  const method = opts.method ?? "GET";
  const insecure = opts.insecure === true;
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const agent = insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        headers: opts.headers,
        agent,
      },
      (incoming) => {
        const chunks = [];
        incoming.on("data", (ch) => chunks.push(ch));
        incoming.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = incoming.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => text,
          });
        });
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * @returns {null | {
 *   base: string;
 *   email: string;
 *   tlsInsecure: boolean;
 *   debug: boolean;
 *   projectKey: string;
 *   boardId: string;
 *   request: (method: string, path: string, jsonBody?: object) => Promise<{ ok: boolean; status: number; text: string; json: unknown }>;
 * }}
 */
export function createJiraHttpClient(env) {
  const base = normBase(env.VITE_JIRA_BASE_URL || "");
  const email = (env.VITE_JIRA_EMAIL || "").trim();
  const token = (env.VITE_JIRA_API_TOKEN || "").trim();
  if (!base || !email || !token) return null;

  const auth = Buffer.from(`${email}:${token}`, "utf8").toString("base64");
  const tlsInsecure = isTlsInsecure(env);
  const debug = isDebug(env);
  const projectKey = (env.VITE_JIRA_PROJECT_KEY || "").trim();
  const boardId = (env.VITE_JIRA_BOARD_ID || "").trim();

  async function request(method, path, jsonBody) {
    const p = path.startsWith("/") ? path : `/${path}`;
    const url = `${base}${p}`;
    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
      ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    };
    const bodyStr = jsonBody != null ? JSON.stringify(jsonBody) : undefined;

    if (debug) {
      const safeUrl = url.includes("/search/jql") ? url.split("?")[0] : url;
      console.error(
        `[jira-debug] ${method} ${safeUrl} tlsInsecure=${tlsInsecure} email=${email} tokenLen=${token.length}`
      );
    }

    let res;
    if (tlsInsecure) {
      res = await httpsRequest(url, {
        method,
        headers,
        body: bodyStr,
        insecure: true,
      });
    } else {
      const r = await fetch(url, { method, headers, body: bodyStr });
      const text = await r.text();
      res = { ok: r.ok, status: r.status, text: async () => text };
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { _parseError: true, raw: text.slice(0, 400) };
    }

    if (debug) {
      const preview =
        typeof json === "object" && json !== null
          ? JSON.stringify(json).slice(0, 500)
          : String(json).slice(0, 500);
      console.error(`[jira-debug] <- HTTP ${res.status} bodyPreview=${preview}`);
    }

    return { ok: res.ok, status: res.status, text, json };
  }

  return { base, email, tlsInsecure, debug, projectKey, boardId, request };
}

export async function jiraGetMyself(client) {
  return client.request("GET", "/rest/api/3/myself");
}

export async function jiraSearchSmoke(client) {
  const pk = client.projectKey;
  if (pk && !/^[A-Za-z][A-Za-z0-9_]*$/.test(pk)) {
    throw new Error(`유효하지 않은 VITE_JIRA_PROJECT_KEY: ${pk}`);
  }
  const jql = pk ? `project = ${pk} ORDER BY updated DESC` : "updated >= -30d ORDER BY updated DESC";
  return client.request("POST", "/rest/api/3/search/jql", {
    jql,
    maxResults: 3,
    fields: ["summary", "status", "key"],
  });
}
