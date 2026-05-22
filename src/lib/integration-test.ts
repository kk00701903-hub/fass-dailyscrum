import { jiraFetch, isJiraApiReachable, isJiraLiveFetchAvailable } from "@/lib/jira-client";
import { canUseJiraEdgeProxy } from "@/lib/jira-env";
import { parseExporterCsvToJiraTasks } from "@/lib/jira-exporter-csv";
import { loadExporterSnapshot } from "@/lib/jira-exporter-storage";
import {
  getJiraBaseUrlFromEnv,
  getJiraBoardIdFromEnv,
  getJiraEmailFromEnv,
  getJiraProjectKeyFromEnv,
  hasJiraApiTokenFromEnv,
} from "@/lib/jira-env";
import { resolveGrafanaDashboardEmbedUrl } from "@/lib/grafana-embed-url";

export type IntegrationTestStatus = "pending" | "running" | "pass" | "fail" | "skip";

export type IntegrationTestId =
  | "env-config"
  | "rest-availability"
  | "rest-myself"
  | "rest-jql"
  | "rest-board"
  | "exporter-sample"
  | "exporter-snapshot"
  | "grafana-embed";

export type IntegrationTestMeta = {
  id: IntegrationTestId;
  name: string;
  description: string;
};

export type IntegrationTestResult = IntegrationTestMeta & {
  status: IntegrationTestStatus;
  message: string;
  durationMs?: number;
};

export const INTEGRATION_TEST_CATALOG: IntegrationTestMeta[] = [
  {
    id: "env-config",
    name: "환경 변수",
    description: "VITE_JIRA_BASE_URL, EMAIL, API_TOKEN 등 필수 값 확인",
  },
  {
    id: "rest-availability",
    name: "REST 프록시",
    description: "개발 서버 + Vite JIRA 프록시 사용 가능 여부",
  },
  {
    id: "rest-myself",
    name: "REST · /myself",
    description: "인증 및 JIRA Cloud 연결 (GET /rest/api/3/myself)",
  },
  {
    id: "rest-jql",
    name: "REST · JQL 검색",
    description: "이슈 검색 API (POST /rest/api/3/search/jql)",
  },
  {
    id: "rest-board",
    name: "REST · Agile 보드",
    description: "VITE_JIRA_BOARD_ID 설정 시 활성 스프린트 조회",
  },
  {
    id: "exporter-sample",
    name: "Exporter CSV 파싱",
    description: "샘플 CSV → JiraTask 변환 (Exporter for Jira 형식)",
  },
  {
    id: "exporter-snapshot",
    name: "Exporter 스냅샷",
    description: "브라우저에 저장된 마지막 CSV 가져오기 데이터",
  },
  {
    id: "grafana-embed",
    name: "Grafana 임베드 URL",
    description: "환경 변수 또는 로컬 저장 임베드 URL 형식 검증",
  },
];

const SAMPLE_EXPORTER_CSV = [
  "Issue key,Summary,Status,Priority,Assignee,Story Points,Updated,Sprint",
  "TEST-1,연동 테스트 이슈,In Progress,Medium,서선범,3,2025-05-18T10:00:00.000Z,Sprint 1",
].join("\n");

function assertSafeProjectKey(key: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`유효하지 않은 프로젝트 키: ${key}`);
  return key;
}

function pass(meta: IntegrationTestMeta, message: string, durationMs: number): IntegrationTestResult {
  return { ...meta, status: "pass", message, durationMs };
}

function fail(meta: IntegrationTestMeta, message: string, durationMs: number): IntegrationTestResult {
  return { ...meta, status: "fail", message, durationMs };
}

function skip(meta: IntegrationTestMeta, message: string): IntegrationTestResult {
  return { ...meta, status: "skip", message };
}

async function runEnvConfig(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[0]!;
  const t0 = performance.now();
  const base = getJiraBaseUrlFromEnv();
  const email = getJiraEmailFromEnv();
  const token = hasJiraApiTokenFromEnv();
  const project = getJiraProjectKeyFromEnv();
  const board = getJiraBoardIdFromEnv();
  const missing: string[] = [];
  if (!base || base.includes("your-org")) missing.push("VITE_JIRA_BASE_URL");
  if (!email || email.includes("your-org")) missing.push("VITE_JIRA_EMAIL");
  if (!token && !canUseJiraEdgeProxy()) missing.push("VITE_JIRA_API_TOKEN (또는 Supabase Edge JIRA_* 시크릿)");
  const ms = Math.round(performance.now() - t0);
  if (missing.length) {
    return fail(meta, `미설정: ${missing.join(", ")}`, ms);
  }
  const extra = [project && `project=${project}`, board && `board=${board}`].filter(Boolean).join(" · ");
  return pass(meta, `설정됨 (${base})${extra ? ` · ${extra}` : ""}`, ms);
}

async function runRestAvailability(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[1]!;
  const t0 = performance.now();
  const ms = Math.round(performance.now() - t0);
  if (canUseJiraEdgeProxy()) {
    return pass(meta, "Supabase Edge jira-proxy 경로 사용 가능", ms);
  }
  if (isJiraLiveFetchAvailable()) {
    return pass(meta, "개발 모드 — Vite JIRA 프록시 fallback 사용 가능", ms);
  }
  if (!import.meta.env.DEV) {
    return skip(meta, "프로덕션 빌드: VITE_SUPABASE_* 와 Edge jira-proxy 필요. Exporter CSV 대안.");
  }
  return fail(
    meta,
    "VITE_SUPABASE_* 또는 VITE_JIRA_BASE_URL+EMAIL+TOKEN 이 없습니다. docs/JIRA_AUTH.md 참고",
    ms
  );
}

async function runRestMyself(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[2]!;
  if (!isJiraApiReachable()) return skip(meta, "JIRA REST 비활성 — Supabase Edge 또는 로컬 VITE_JIRA_* 확인");
  const t0 = performance.now();
  try {
    const me = await jiraFetch<{ displayName?: string; emailAddress?: string; accountId?: string }>(
      "/rest/api/3/myself"
    );
    const ms = Math.round(performance.now() - t0);
    const who = me.displayName || me.emailAddress || me.accountId || "OK";
    return pass(meta, `연결 성공 · ${who}`, ms);
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    return fail(meta, e instanceof Error ? e.message : String(e), ms);
  }
}

async function runRestJql(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[3]!;
  if (!isJiraApiReachable()) return skip(meta, "JIRA REST 비활성");
  const t0 = performance.now();
  const projectKey = getJiraProjectKeyFromEnv();
  const jql = projectKey
    ? `project = ${assertSafeProjectKey(projectKey)} ORDER BY updated DESC`
    : "updated >= -7d ORDER BY updated DESC";
  try {
    const res = await jiraFetch<{ issues?: unknown[]; total?: number }>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, maxResults: 5, fields: ["summary", "status"] }),
    });
    const ms = Math.round(performance.now() - t0);
    const count = res.issues?.length ?? res.total ?? 0;
    return pass(meta, `JQL OK · ${count}건 조회 (max 5) · ${jql}`, ms);
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    return fail(meta, e instanceof Error ? e.message : String(e), ms);
  }
}

async function runRestBoard(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[4]!;
  const boardId = getJiraBoardIdFromEnv();
  if (!boardId) return skip(meta, "VITE_JIRA_BOARD_ID 미설정 — JQL 검색만 사용");
  if (!isJiraApiReachable()) return skip(meta, "JIRA REST 비활성");
  if (!/^\d+$/.test(boardId)) {
    return fail(meta, "VITE_JIRA_BOARD_ID 는 숫자여야 합니다.", 0);
  }
  const t0 = performance.now();
  try {
    const res = await jiraFetch<{ values?: Array<{ id: number; name: string; state: string }> }>(
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active`
    );
    const ms = Math.round(performance.now() - t0);
    const active = res.values?.[0];
    if (active) {
      return pass(meta, `보드 ${boardId} · 활성 스프린트: ${active.name} (#${active.id})`, ms);
    }
    return pass(meta, `보드 ${boardId} 연결 OK · 활성 스프린트 없음`, ms);
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    return fail(meta, e instanceof Error ? e.message : String(e), ms);
  }
}

async function runExporterSample(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[5]!;
  const t0 = performance.now();
  const { tasks, sprint, warnings } = parseExporterCsvToJiraTasks(SAMPLE_EXPORTER_CSV);
  const ms = Math.round(performance.now() - t0);
  if (tasks.length === 0) {
    return fail(meta, warnings[0] ?? "파싱 결과 0건", ms);
  }
  const warn = warnings.length ? ` (경고 ${warnings.length}건)` : "";
  return pass(meta, `${tasks.length}건 · 스프린트 「${sprint.name}」 · ${tasks[0]?.key}${warn}`, ms);
}

export async function runExporterFileTest(file: File): Promise<IntegrationTestResult> {
  const meta: IntegrationTestMeta = {
    id: "exporter-sample",
    name: `Exporter CSV · ${file.name}`,
    description: "업로드한 CSV 파일 파싱",
  };
  const t0 = performance.now();
  try {
    const text = await file.text();
    const { tasks, sprint, warnings } = parseExporterCsvToJiraTasks(text);
    const ms = Math.round(performance.now() - t0);
    if (tasks.length === 0) {
      return fail(meta, warnings.join(" ") || "파싱 결과 0건", ms);
    }
    return pass(
      meta,
      `${tasks.length}건 · 「${sprint.name}」${warnings.length ? ` · 경고: ${warnings.slice(0, 2).join("; ")}` : ""}`,
      ms
    );
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    return fail(meta, e instanceof Error ? e.message : String(e), ms);
  }
}

async function runExporterSnapshot(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[6]!;
  const t0 = performance.now();
  const snap = loadExporterSnapshot();
  const ms = Math.round(performance.now() - t0);
  if (!snap) {
    return skip(meta, "저장된 Exporter 스냅샷 없음 — JIRA 동기화에서 CSV 가져오기 후 다시 테스트");
  }
  return pass(
    meta,
    `${snap.fileName} · ${snap.tasks.length}건 · ${new Date(snap.importedAt).toLocaleString("ko-KR")}`,
    ms
  );
}

async function runGrafanaEmbed(): Promise<IntegrationTestResult> {
  const meta = INTEGRATION_TEST_CATALOG[7]!;
  const t0 = performance.now();
  const url = resolveGrafanaDashboardEmbedUrl();
  const ms = Math.round(performance.now() - t0);
  if (!url) {
    return skip(meta, "임베드 URL 없음 — 아래 Grafana 카드에 저장하거나 VITE_GRAFANA_DASHBOARD_EMBED_URL 설정");
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return fail(meta, `허용되지 않는 프로토콜: ${u.protocol}`, ms);
    }
    return pass(meta, `유효한 URL · ${u.hostname}${u.pathname.slice(0, 40)}…`, ms);
  } catch {
    return fail(meta, "URL 형식이 올바르지 않습니다.", ms);
  }
}

const RUNNERS: Record<IntegrationTestId, () => Promise<IntegrationTestResult>> = {
  "env-config": runEnvConfig,
  "rest-availability": runRestAvailability,
  "rest-myself": runRestMyself,
  "rest-jql": runRestJql,
  "rest-board": runRestBoard,
  "exporter-sample": runExporterSample,
  "exporter-snapshot": runExporterSnapshot,
  "grafana-embed": runGrafanaEmbed,
};

export async function runIntegrationTest(id: IntegrationTestId): Promise<IntegrationTestResult> {
  const runner = RUNNERS[id];
  const meta = INTEGRATION_TEST_CATALOG.find((t) => t.id === id);
  if (!meta || !runner) {
    return {
      id,
      name: id,
      description: "",
      status: "fail",
      message: "알 수 없는 테스트",
    };
  }
  return runner();
}

export async function runAllIntegrationTests(
  onProgress?: (result: IntegrationTestResult) => void
): Promise<IntegrationTestResult[]> {
  const results: IntegrationTestResult[] = [];
  for (const meta of INTEGRATION_TEST_CATALOG) {
    const running: IntegrationTestResult = { ...meta, status: "running", message: "실행 중…" };
    onProgress?.(running);
    const result = await runIntegrationTest(meta.id);
    results.push(result);
    onProgress?.(result);
  }
  return results;
}

export function summarizeTestResults(results: IntegrationTestResult[]): {
  pass: number;
  fail: number;
  skip: number;
  total: number;
} {
  return {
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    skip: results.filter((r) => r.status === "skip").length,
    total: results.length,
  };
}
