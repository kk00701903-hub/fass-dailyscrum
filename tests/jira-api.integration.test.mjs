/**
 * JIRA Cloud REST 통합 테스트 (Node 내장 `node:test`).
 *
 * `.env.local` 에 VITE_JIRA_BASE_URL, VITE_JIRA_EMAIL, VITE_JIRA_API_TOKEN 이 있어야 실행됩니다.
 * 사내 SSL 복호화: JIRA_TEST_TLS_INSECURE=1
 * 상세 로그: JIRA_TEST_DEBUG=1
 *
 * 실행: npm run test:jira:integration
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvLocal,
  mergeProcessEnv,
  createJiraHttpClient,
  jiraGetMyself,
  jiraSearchSmoke,
  isPlaceholderJiraBase,
} from "../scripts/jira-test-lib.mjs";
import { parseFwkTestKeys } from "./fixtures/fwk-kim-golden.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = mergeProcessEnv(loadEnvLocal(root));
const client = createJiraHttpClient(env);
const skipLive = !client || isPlaceholderJiraBase(client.base);

describe("Jira API integration", () => {
  it(
    "GET /rest/api/3/myself — 인증·TLS·사이트 URL",
    { skip: skipLive },
    async () => {
      const r = await jiraGetMyself(client);
      assert.ok(
        r.status === 200,
        `HTTP ${r.status}: ${typeof r.json === "object" ? JSON.stringify(r.json) : r.text?.slice(0, 500)}`
      );
      const me = r.json;
      assert.ok(
        me && (typeof me.accountId === "string" || typeof me.emailAddress === "string"),
        "응답에 accountId 또는 emailAddress 필요"
      );
    }
  );

  it(
    "POST /rest/api/3/search/jql — 스모크 (최대 3건)",
    { skip: skipLive },
    async () => {
      const r = await jiraSearchSmoke(client);
      assert.ok(
        r.status === 200,
        `HTTP ${r.status}: ${typeof r.json === "object" ? JSON.stringify(r.json) : r.text?.slice(0, 500)}`
      );
      const data = r.json;
      assert.ok(Array.isArray(data?.issues), "issues 배열 필요");
    }
  );

  it(
    "POST /rest/api/3/search/jql — FWK 골든 3키 (project=FWK 또는 JIRA_TEST_FWK_KEYS)",
    {
      skip:
        skipLive ||
        (!env.JIRA_TEST_FWK_KEYS?.trim() &&
          client.projectKey?.toUpperCase() !== "FWK"),
    },
    async () => {
      const fwkKeys = parseFwkTestKeys(env.JIRA_TEST_FWK_KEYS);
      const pk = (client.projectKey || "FWK").trim();
      assert.match(pk, /^[A-Za-z][A-Za-z0-9_]*$/);
      const keysClause = fwkKeys.map((k) => `"${k}"`).join(", ");
      const jql = `project = ${pk} AND key in (${keysClause}) ORDER BY key`;
      const r = await client.request("POST", "/rest/api/3/search/jql", {
        jql,
        maxResults: 10,
        fields: ["summary", "status", "key", "assignee"],
      });
      assert.equal(
        r.status,
        200,
        `HTTP ${r.status}: ${typeof r.json === "object" ? JSON.stringify(r.json).slice(0, 500) : r.text?.slice(0, 500)}`
      );
      const issues = r.json?.issues ?? [];
      assert.equal(
        issues.length,
        fwkKeys.length,
        `기대 ${fwkKeys.length}건, 실제 ${issues.length}건 · JQL: ${jql}`
      );
      const found = new Set(issues.map((i) => i.key));
      for (const key of fwkKeys) {
        assert.ok(found.has(key), `JIRA에 ${key} 없음`);
      }
    }
  );

  it(
    "GET /rest/agile/1.0/board/{id}/sprint?state=active — 보드 ID 설정 시만",
    { skip: skipLive || !client.boardId || !/^\d+$/.test(client.boardId) },
    async () => {
      const r = await client.request(
        "GET",
        `/rest/agile/1.0/board/${encodeURIComponent(client.boardId)}/sprint?state=active`
      );
      assert.ok(
        r.status === 200,
        `HTTP ${r.status}: ${typeof r.json === "object" ? JSON.stringify(r.json) : r.text?.slice(0, 500)}`
      );
      assert.ok(Array.isArray(r.json?.values), "values 배열 필요");
    }
  );
});

describe("Jira API 환경 안내", () => {
  it("요약 로그", () => {
    if (!client) {
      console.log(
        "[jira-integration] skip: `.env.local` 에 VITE_JIRA_BASE_URL, VITE_JIRA_EMAIL, VITE_JIRA_API_TOKEN 을 설정하세요."
      );
    } else if (isPlaceholderJiraBase(client.base)) {
      console.log(
        `[jira-integration] skip: VITE_JIRA_BASE_URL 이 예시 도메인입니다 (${client.base}). 실제 사이트(예: https://회사.atlassian.net)로 바꾼 뒤 다시 실행하세요.`
      );
    } else {
      console.log(
        `[jira-integration] OK: base=${client.base} tlsInsecure=${client.tlsInsecure} debug=${client.debug} projectKey=${client.projectKey || "(없음)"} boardId=${client.boardId || "(없음)"}`
      );
    }
    console.log(
      "[jira-integration] TLS 오류 시: JIRA_TEST_TLS_INSECURE=1 (이 스크립트의 요청에만 https.Agent 로 검증 생략)"
    );
    console.log("[jira-integration] 상세 로그: JIRA_TEST_DEBUG=1");
  });
});
