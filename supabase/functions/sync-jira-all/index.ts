/**
 * JIRA → Supabase 전체 동기화 (스프린트 + 이슈) — npm run sync:jira:all 과 동일 스키마
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildJiraBasicAuthBase64 } from "../_shared/jira-basic-auth.ts";
import { upsertJiraTasksInDb } from "../_shared/jira-tasks-upsert.ts";

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
    issuelinks?: Array<{
      id?: string;
      type?: { name?: string; inward?: string; outward?: string };
      outwardIssue?: { key?: string };
      inwardIssue?: { key?: string };
    }>;
    [key: string]: unknown;
  };
}

type DepRelation = "depends_on" | "blocks" | "relates_to";

interface TaskLinkSeed {
  source_ref: string;
  target_ref: string;
  relation: DepRelation;
  jira_link_id: string;
  note: string;
}

interface DepUpsert {
  source_kind: "sprint";
  source_ref: string;
  target_kind: "sprint";
  target_ref: string;
  relation: DepRelation;
  source: "jira";
  jira_link_id: string;
  note: string;
}

function rollupTaskLinksToSprintDeps(
  links: TaskLinkSeed[],
  issueKeyToSprintId: Map<string, string>
): DepUpsert[] {
  const byEdge = new Map<string, DepUpsert>();
  for (const link of links) {
    const srcSprint = issueKeyToSprintId.get(link.source_ref);
    const tgtSprint = issueKeyToSprintId.get(link.target_ref);
    if (!srcSprint || !tgtSprint || srcSprint === tgtSprint) continue;
    const edgeKey = `${srcSprint}\0${tgtSprint}\0${link.relation}`;
    if (byEdge.has(edgeKey)) continue;
    byEdge.set(edgeKey, {
      source_kind: "sprint",
      source_ref: srcSprint,
      target_kind: "sprint",
      target_ref: tgtSprint,
      relation: link.relation,
      source: "jira",
      jira_link_id: `sprint:${edgeKey}`,
      note: `JIRA · 스프린트 간 (${link.source_ref} → ${link.target_ref})`,
    });
  }
  return [...byEdge.values()];
}

function readStartDate(fields: JiraIssueRaw["fields"], startField: string): string | null {
  const primary = startField.trim() || "customfield_10015";
  const v = fields[primary];
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v && typeof v === "object" && "value" in v && typeof (v as { value: string }).value === "string") {
    return (v as { value: string }).value.slice(0, 10);
  }
  return null;
}

function mapOutwardRel(typeName: string, outward: string): DepRelation {
  const n = typeName.toLowerCase();
  const o = outward.toLowerCase();
  if (n.includes("block") || o.includes("block")) return "blocks";
  if (n.includes("depend") || o.includes("depend")) return "depends_on";
  return "relates_to";
}

function mapInwardRel(typeName: string, inward: string): DepRelation {
  const n = typeName.toLowerCase();
  const i = inward.toLowerCase();
  if (n.includes("block") || i.includes("block")) return i.includes("blocked") ? "blocks" : "depends_on";
  if (n.includes("depend") || i.includes("depend")) return "depends_on";
  return "relates_to";
}

function extractTaskLinks(issueKey: string, links: JiraIssueRaw["fields"]["issuelinks"]): TaskLinkSeed[] {
  const out: TaskLinkSeed[] = [];
  for (const link of links ?? []) {
    const linkId = link.id ? String(link.id) : "";
    if (!linkId) continue;
    const typeName = link.type?.name ?? "Link";
    if (link.outwardIssue?.key) {
      out.push({
        source_ref: issueKey,
        target_ref: link.outwardIssue.key,
        relation: mapOutwardRel(typeName, link.type?.outward ?? ""),
        jira_link_id: linkId,
        note: `JIRA · ${typeName}`,
      });
    }
    if (link.inwardIssue?.key) {
      out.push({
        source_ref: link.inwardIssue.key,
        target_ref: issueKey,
        relation: mapInwardRel(typeName, link.type?.inward ?? ""),
        jira_link_id: `${linkId}-in`,
        note: `JIRA · ${typeName}`,
      });
    }
  }
  return out;
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

function mapIssue(
  issue: JiraIssueRaw,
  sprintId: string,
  storyField: string,
  startField: string,
  syncedAt: string
) {
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
    jira_issue_id: issue.id,
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
    start_date: readStartDate(issue.fields, startField),
    created_at: issue.fields?.created ?? null,
    resolved_at: issue.fields?.resolutiondate ?? null,
    issue_type: issue.fields?.issuetype?.name ?? "",
    parent_issue_key: issue.fields?.parent?.key ?? null,
    parent_jira_issue_id: issue.fields?.parent?.id ?? null,
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
  const startField = Deno.env.get("JIRA_START_DATE_FIELD")?.trim() ?? "";

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
  const auth = buildJiraBasicAuthBase64(jiraEmail, jiraToken);
  const now = new Date().toISOString();

  try {
    const sprintPages: Array<{
      id: number;
      name: string;
      state: string;
      startDate?: string;
      endDate?: string;
    }> = [];
    let startAt = 0;
    const maxResults = 50;

    for (;;) {
      const path = `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&startAt=${startAt}&maxResults=${maxResults}`;
      const page = await jiraFetch<{
        values?: Array<{ id: number; name: string; state: string; startDate?: string; endDate?: string }>;
        isLast?: boolean;
      }>(jiraBase, auth, path);
      sprintPages.push(...(page.values ?? []));
      if (page.isLast === true || (page.values?.length ?? 0) < maxResults) break;
      startAt += maxResults;
      if (startAt > 500) break;
    }

    const byName = new Map<
      string,
      {
        sprint_name: string;
        status: string;
        remaining_days: number;
        jira_sprint_id: string;
        start_date: string | null;
        end_date: string | null;
      }
    >();
    for (const sp of sprintPages) {
      if (!sp.name?.trim()) continue;
      byName.set(sp.name, {
        sprint_name: sp.name,
        status: statusLabel(sp.state),
        remaining_days: remainingDays(sp.endDate),
        jira_sprint_id: `jira-sprint-${sp.id}`,
        start_date: sp.startDate?.slice(0, 10) ?? null,
        end_date: sp.endDate?.slice(0, 10) ?? null,
      });
    }
    const sprintRows = [...byName.values()];

    const { error: delSprints } = await supabase.from("jira_sprints").delete().not("sprint_name", "is", null);
    if (delSprints) throw delSprints;

    if (sprintRows.length > 0) {
      const fullPayload = sprintRows.map((r) => ({ ...r, updated_at: now }));
      const { error: insFull } = await supabase.from("jira_sprints").insert(fullPayload);
      if (insFull) {
        const msg = insFull.message ?? "";
        if (!/end_date|start_date|jira_sprint_id|schema cache/i.test(msg)) throw insFull;
        const basicPayload = sprintRows.map((r) => ({
          sprint_name: r.sprint_name,
          status: r.status,
          remaining_days: r.remaining_days,
          updated_at: now,
        }));
        const { error: insBasic } = await supabase.from("jira_sprints").insert(basicPayload);
        if (insBasic) throw insBasic;
      }
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
      "issuelinks",
      storyField,
      startField,
    ]
      .filter(Boolean)
      .join(",");

    const taskById = new Map<string, ReturnType<typeof mapIssue>>();
    const taskLinksById = new Map<string, TaskLinkSeed>();
    const issueKeyToSprintId = new Map<string, string>();

    const ingestIssues = (issues: JiraIssueRaw[], sprintId: string) => {
      for (const issue of issues) {
        taskById.set(issue.id, mapIssue(issue, sprintId, storyField, startField, now));
        issueKeyToSprintId.set(issue.key, sprintId);
        for (const link of extractTaskLinks(issue.key, issue.fields?.issuelinks)) {
          taskLinksById.set(link.jira_link_id, link);
        }
      }
    };

    const fetchIssuePages = async (pathPrefix: string, sprintId: string) => {
      let issueStart = 0;
      for (;;) {
        const issuePath = `${pathPrefix}?startAt=${issueStart}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
        const issuePage = await jiraFetch<{ issues?: JiraIssueRaw[]; isLast?: boolean }>(
          jiraBase,
          auth,
          issuePath
        );
        ingestIssues(issuePage.issues ?? [], sprintId);
        if (issuePage.isLast === true || (issuePage.issues?.length ?? 0) < maxResults) break;
        issueStart += maxResults;
        if (issueStart > 500) break;
      }
    };

    for (const sp of toSync) {
      await fetchIssuePages(`/rest/agile/1.0/sprint/${sp.id}/issue`, `jira-sprint-${sp.id}`);
    }

    await fetchIssuePages(`/rest/agile/1.0/board/${boardId}/backlog`, "jira-backlog");

    const taskRows = [...taskById.values()];
    const linkRows = rollupTaskLinksToSprintDeps([...taskLinksById.values()], issueKeyToSprintId);

    const { upserted: tasksCount, pruned, keyMigrations } = await upsertJiraTasksInDb(
      supabase,
      taskRows,
      { logPrefix: "[sync-jira-all]" }
    );

    const { error: delLinks } = await supabase.from("jira_dependencies").delete().eq("source", "jira");
    if (delLinks && !/source|schema cache|does not exist/i.test(delLinks.message)) throw delLinks;

    if (!delLinks && linkRows.length > 0) {
      for (let i = 0; i < linkRows.length; i += 100) {
        const chunk = linkRows.slice(i, i + 100).map((r) => ({ ...r, updated_at: now }));
        const { error: insLinks } = await supabase.from("jira_dependencies").insert(chunk);
        if (insLinks) throw insLinks;
      }
    }

    const subtasks = taskRows.filter((r) => r.is_subtask).length;
    return json({
      ok: true,
      count: sprintRows.length,
      tasksCount,
      linksCount: linkRows.length,
      subtasks,
      pruned,
      keyMigrations: Object.fromEntries(keyMigrations),
      mode: "jira_issue_id_upsert",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
