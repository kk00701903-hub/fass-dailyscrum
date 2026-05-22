import { loadEnvLocal, mergeProcessEnv, createJiraHttpClient } from "./jira-test-lib.mjs";

const env = mergeProcessEnv(loadEnvLocal(process.cwd()));
const email = (env.VITE_JIRA_EMAIL || "").trim();
const token = (env.VITE_JIRA_API_TOKEN || "").trim();

console.log("VITE_JIRA_EMAIL set:", Boolean(email));
console.log("VITE_JIRA_EMAIL length:", email.length);
console.log("VITE_JIRA_API_TOKEN set:", Boolean(token));
console.log("VITE_JIRA_API_TOKEN length:", token.length);
console.log("token looks like Atlassian PAT:", /^ATATT/i.test(token));
console.log("token has CR/LF:", /[\r\n]/.test(token));
console.log("JIRA_API_TOKEN (no VITE_) set:", Boolean((process.env.JIRA_API_TOKEN || "").trim()));

const client = createJiraHttpClient(env);
if (!client) {
  console.log("createJiraHttpClient: missing base/email/token");
  process.exit(1);
}

const me = await client.request("GET", "/rest/api/3/myself");
console.log("GET /rest/api/3/myself:", me.status, me.ok ? "OK" : "FAIL");
if (!me.ok) {
  const msg =
    (Array.isArray(me.json?.errorMessages) && me.json.errorMessages.join(" · ")) ||
    me.json?.message ||
    me.text?.slice(0, 120);
  console.log("message:", msg);
  process.exit(1);
}
console.log("displayName:", me.json?.displayName ?? "(none)");
