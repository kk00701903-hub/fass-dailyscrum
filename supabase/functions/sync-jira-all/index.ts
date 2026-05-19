/**
 * JIRA → Supabase 전체 동기화 (스프린트 + 이슈) — npm run sync:jira:all 과 동일 스키마
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

async function jiraFetch<T>(baseUrl: string, auth: string, path: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const msg =
      (Array.isArray(b?.errorMessages) ? (b!.errorMessages as string[]).join(" · ") : null) ||
      (b?.message ? String(b.message) : null) ||
      text.slice(0, 200);
    throw new Error(`JIRA HTTP ${res.status}: ${msg}`);
  }
  return body as T;
}

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
type Priority = "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST";

interface JiraIssueRaw {
  id: string;
  key: string;
  fields: {
    summary?: string;
    updated?: string;
    created?: string;
    resolutiondate?: string;
    duedate?: string;
    labels?: string[];
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string; accountId?: string } | null;
    issuetype?: { name?: string; subtask?: boolean };
    parent?: { id?: string; key?: string };
    [key: string]: unknown;
  };
}

function mapStatus(s?: { name?: string; statusCategory?: { key?: string } }): TaskStatus {
  const cat = s?.statusCategory?.key;
  if (cat === "new") return "TODO";
  if (cat === "done") return "DONE";
  if (cat === "indeterminate") {
    const n = (s?.name ?? "").toLowerCase();
    if (n.includes("review") || n.includes("검토")) return "IN_REVIEW";
    if (n.includes("block")) return "BLOCKED";
    return "IN_PROGRESS";
  }
  return "TODO";
}

function mapPriority(name?: string): Priority {
  const n = (name ?? "").toLowerCase();
  if (n.includes("highest")) return "HIGHEST";
  if (n.includes("high")) return "HIGH";
  if (n.includes("lowest")) return "LOWEST";
  if (n.includes("low")) return "LOW";
  return "MEDIUM";
}

function mapIssue(issue: JiraIssueRaw, sprintId: string, storyField: string, syncedAt: string) {
  const a = issue.fields?.assignee;
  const name = a?.displayName || a?.emailAddress?.split("@")[0] || "미배정";
  const sp = issue.fields?.[storyField];
  let storyPoints = 0;
  if (typeof sp === "number" && Number.isFinite(sp)) storyPoints = sp;
  else if (typeof sp === "string") {
    const n = parseFloat(sp);
    if (Number.isFinite(n)) storyPoints = n;
  }

  return {
    id: issue.id,
    issue_key: issue.key,
    sprint_id: sprintId,
    summary: issue.fields?.summary ?? "—",
    status: mapStatus(issue.fields?.status),
    priority: mapPriority(issue.fields?.priority?.name),
    assignee_id: a?.accountId?.slice(0, 64) ?? "jira-unassigned",
    assignee_name: name,
    assignee_role: "JIRA",
    assignee_color: "#94a3b8",
    story_points: storyPoints,
    updated_at: issue.fields?.updated ?? syncedAt,
    labels: issue.fields?.labels ?? [],
    synced_at: syncedAt,
    assignee_account_id: a?.accountId ?? null,
    assignee_email: a?.emailAddress ?? null,
    due_date: issue.fields?.duedate?.slice(0, 10) ?? null,
    start_date: null,
    created_at: issue.fields?.created ?? null,
    resolved_at: issue.fields?.resolutiondate ?? null,
    issue_type: issue.fields?.issuetype?.name ?? "",
    parent_issue_key: issue.fields?.parent?.key ?? null,
    parent_id: null,
    is_subtask: Boolean(issue.fields?.issuetype?.subtask),
    jira_status_name: issue.fields?.status?.name ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jiraBase = Deno.env.get("JIRA_BASE_URL")?.trim();
  const jiraEmail = Deno.env.get("JIRA_EMAIL")?.trim();
  const jiraToken = Deno.env.get("JIRA_API_TOKEN")?.trim();
  const boardId = Deno.env.get("JIRA_BOARD_ID")?.trim();
  const storyField = Deno.env.get("JIRA_STORY_POINTS_FIELD")?.trim() || "customfield_10016";

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다." }, 500);
  }
  if (!jiraBase || !jiraEmail || !jiraToken) {
    return json({ error: "JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN 시크릿을 설정하세요." }, 500);
  }
  if (!boardId || !/^\d+$/.test(boardId)) {
    return json({ error: "JIRA_BOARD_ID(숫자) 시크릿을 설정하세요." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const auth = btoa(`${jiraEmail}:${jiraToken}`);
  const now = new Date().toISOString();

  try {
    const sprintPages: Array<{ id: number; name: string; state: string; endDate?: string }> = [];
    let startAt = 0;
    const maxResults = 50;

    for (;;) {
      const path = `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&startAt=${startAt}&maxResults=${maxResults}`;
      const page = await jiraFetch<{
        values?: Array<{ id: number; name: string; state: string; endDate?: string }>;
        isLast?: boolean;
      }>(jiraBase, auth, path);
      sprintPages.push(...(page.values ?? []));
      if (page.isLast === true || (page.values?.length ?? 0) < maxResults) break;
      startAt += maxResults;
      if (startAt > 500) break;
    }

    const byName = new Map<string, { sprint_name: string; status: string; remaining_days: number }>();
    for (const sp of sprintPages) {
      if (!sp.name?.trim()) continue;
      byName.set(sp.name, {
        sprint_name: sp.name,
        status: statusLabel(sp.state),
        remaining_days: remainingDays(sp.endDate),
      });
    }
    const sprintRows = [...byName.values()];

    const { error: delSprints } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
    if (delSprints) throw delSprints;

    if (sprintRows.length > 0) {
      const { error: insSprints } = await supabase
        .from("jira_sprints")
        .insert(sprintRows.map((r) => ({ ...r, updated_at: now })));
      if (insSprints) throw insSprints;
    }

    const closed = sprintPages.filter((s) => s.state === "closed").slice(-3);
    const toSync = [...sprintPages.filter((s) => s.state === "active" || s.state === "future"), ...closed];

    const fields = [
      "summary",
      "status",
      "priority",
      "assignee",
      "updated",
      "labels",
      "duedate",
      "created",
      "resolutiondate",
      "issuetype",
      "parent",
      storyField,
    ].join(",");

    const taskById = new Map<string, ReturnType<typeof mapIssue>>();

    for (const sp of toSync) {
      const sprintId = `jira-sprint-${sp.id}`;
      let issueStart = 0;
      for (;;) {
        const issuePath = `/rest/agile/1.0/sprint/${sp.id}/issue?startAt=${issueStart}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
        const issuePage = await jiraFetch<{ issues?: JiraIssueRaw[]; isLast?: boolean }>(jiraBase, auth, issuePath);
        for (const issue of issuePage.issues ?? []) {
          taskById.set(issue.id, mapIssue(issue, sprintId, storyField, now));
        }
        if (issuePage.isLast === true || (issuePage.issues?.length ?? 0) < maxResults) break;
        issueStart += maxResults;
        if (issueStart > 500) break;
      }
    }

    const taskRows = [...taskById.values()];
    const { error: delTasks } = await supabase.from("jira_tasks").delete().not("issue_key", "is", null);
    if (delTasks) throw delTasks;

    const chunkSize = 100;
    for (let i = 0; i < taskRows.length; i += chunkSize) {
      const { error: insTasks } = await supabase.from("jira_tasks").insert(taskRows.slice(i, i + chunkSize));
      if (insTasks) throw insTasks;
    }

    const subtasks = taskRows.filter((r) => r.is_subtask).length;
    return json({
      ok: true,
      count: sprintRows.length,
      tasksCount: taskRows.length,
      subtasks,
      mode: "full_replace",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
