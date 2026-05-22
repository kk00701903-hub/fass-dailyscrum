import type { DependencyRelation, TaskLinkSeed } from "@/lib/jira-dependencies";

export type { TaskLinkSeed } from "@/lib/jira-dependencies";

export interface JiraIssueLinkRaw {
  id?: string;
  type?: {
    name?: string;
    inward?: string;
    outward?: string;
  };
  outwardIssue?: { key?: string };
  inwardIssue?: { key?: string };
}

function mapOutwardRelation(typeName: string, outward: string): DependencyRelation | null {
  const n = typeName.toLowerCase();
  const o = outward.toLowerCase();
  if (n.includes("block") || o.includes("block")) return "blocks";
  if (n.includes("depend") || o.includes("depend")) return "depends_on";
  if (n.includes("clone") || n.includes("duplicate") || n.includes("relate") || o.includes("relate")) {
    return "relates_to";
  }
  return "relates_to";
}

function mapInwardRelation(typeName: string, inward: string): DependencyRelation | null {
  const n = typeName.toLowerCase();
  const i = inward.toLowerCase();
  if (n.includes("block") || i.includes("block")) {
    if (i.includes("blocked by") || i.includes("차단")) return "blocks";
    return "depends_on";
  }
  if (n.includes("depend") || i.includes("depend")) return "depends_on";
  return "relates_to";
}

/** JIRA issuelinks → 태스크 간 링크 (동기화 시 스프린트로 롤업) */
export function extractTaskLinksFromIssue(
  issueKey: string,
  links: JiraIssueLinkRaw[] | null | undefined
): TaskLinkSeed[] {
  if (!links?.length) return [];

  const out: TaskLinkSeed[] = [];

  for (const link of links) {
    const linkId = link.id ? String(link.id) : null;
    if (!linkId) continue;

    const typeName = link.type?.name ?? "Link";

    if (link.outwardIssue?.key) {
      const rel = mapOutwardRelation(typeName, link.type?.outward ?? "");
      out.push({
        source_ref: issueKey,
        target_ref: link.outwardIssue.key,
        relation: rel,
        jira_link_id: linkId,
        note: `JIRA · ${typeName}`,
      });
    }

    if (link.inwardIssue?.key) {
      const rel = mapInwardRelation(typeName, link.type?.inward ?? "");
      out.push({
        source_ref: link.inwardIssue.key,
        target_ref: issueKey,
        relation: rel,
        jira_link_id: `${linkId}-in`,
        note: `JIRA · ${typeName}`,
      });
    }
  }

  return out;
}
