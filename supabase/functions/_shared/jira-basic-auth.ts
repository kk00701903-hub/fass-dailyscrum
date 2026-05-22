/** JIRA Cloud Basic auth — Edge Functions 공용 */

export function normalizeJiraCredential(value: string | undefined | null): string {
  let v = (value ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function buildJiraBasicAuthBase64(email: string, apiToken: string): string {
  const e = normalizeJiraCredential(email);
  const t = normalizeJiraCredential(apiToken);
  if (!e || !t) throw new Error("JIRA email and API token required");
  const credentials = `${e}:${t}`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function buildJiraAuthorizationHeader(email: string, apiToken: string): string {
  return `Basic ${buildJiraBasicAuthBase64(email, apiToken)}`;
}
