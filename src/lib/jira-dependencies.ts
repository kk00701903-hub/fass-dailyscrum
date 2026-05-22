import {
  fetchJiraSprintBoardFromDb,
  type JiraSprintBoardRow,
} from "@/lib/jira-sprints-dashboard";
import {
  filterSprintsByWbsStatus,
  normalizeWbsSprintStatus,
  WBS_DEFAULT_SPRINT_STATUSES,
  type WbsSprintStatusKind,
} from "@/lib/jira-wbs";
import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export {
  WBS_DEFAULT_SPRINT_STATUSES as DEPENDENCY_DEFAULT_SPRINT_STATUSES,
  type WbsSprintStatusKind as DependencySprintStatusKind,
};

/** 의존성 화면 상태 필터 옵션 */
export const DEPENDENCY_SPRINT_STATUS_OPTIONS: { kind: WbsSprintStatusKind; label: string }[] = [
  { kind: "active", label: "진행 중" },
  { kind: "future", label: "예정" },
  { kind: "closed", label: "종료" },
  { kind: "other", label: "기타" },
];

export const DEPENDENCY_STATUS_SECTION_ORDER: WbsSprintStatusKind[] = [
  "active",
  "future",
  "closed",
  "other",
];

export const DEPENDENCY_STATUS_SECTION_LABELS: Record<WbsSprintStatusKind, string> = {
  active: "진행 중",
  future: "예정",
  closed: "종료",
  other: "기타",
};

export function filterDependenciesBySprintRefs(
  dependencies: JiraDependencyRow[],
  visibleRefs: Set<string>
): JiraDependencyRow[] {
  return dependencies.filter((d) => visibleRefs.has(d.sourceRef) && visibleRefs.has(d.targetRef));
}

export function sprintRefSet(sprints: JiraSprintBoardRow[]): Set<string> {
  return new Set(sprints.map(sprintNodeRef));
}

export function groupSprintsByStatusArea(
  sprints: JiraSprintBoardRow[]
): Map<WbsSprintStatusKind, JiraSprintBoardRow[]> {
  const map = new Map<WbsSprintStatusKind, JiraSprintBoardRow[]>();
  for (const kind of DEPENDENCY_STATUS_SECTION_ORDER) map.set(kind, []);
  for (const s of sprints) {
    const { kind } = normalizeWbsSprintStatus(s.status);
    map.get(kind)!.push(s);
  }
  return map;
}

export function filterSprintsForDependencyView(
  sprints: JiraSprintBoardRow[],
  selected: Set<WbsSprintStatusKind>
): JiraSprintBoardRow[] {
  return filterSprintsByWbsStatus(sprints, selected);
}

export type DependencyKind = "sprint";
export type DependencyRelation = "depends_on" | "blocks" | "relates_to";

export type DependencySource = "manual" | "jira";

export interface JiraDependencyRow {
  id: string;
  sourceKind: DependencyKind;
  sourceRef: string;
  targetKind: DependencyKind;
  targetRef: string;
  relation: DependencyRelation;
  note: string;
  source: DependencySource;
  jiraLinkId: string | null;
  createdAt: string;
}

export interface DependencyNodeRef {
  kind: DependencyKind;
  ref: string;
}

export interface DependencyNode {
  key: string;
  kind: DependencyKind;
  ref: string;
  label: string;
  sublabel?: string;
  sprintId?: string;
}

export interface JiraDependencyUpsert {
  source_kind: "sprint";
  source_ref: string;
  target_kind: "sprint";
  target_ref: string;
  relation: DependencyRelation;
  source: "jira";
  jira_link_id: string;
  note: string;
}

/** JIRA issuelink에서 추출한 태스크 간 링크 (스프린트 롤업 전) */
export interface TaskLinkSeed {
  source_ref: string;
  target_ref: string;
  relation: DependencyRelation;
  jira_link_id: string;
  note: string;
}

export const DEPENDENCY_RELATION_LABELS: Record<DependencyRelation, string> = {
  depends_on: "선행 필요 (depends on)",
  blocks: "차단 (blocks)",
  relates_to: "연관 (relates to)",
};

export const DEPENDENCY_RELATION_SHORT: Record<DependencyRelation, string> = {
  depends_on: "선행 필요",
  blocks: "차단",
  relates_to: "연관",
};

export function sprintNodeRef(sprint: JiraSprintBoardRow): string {
  return sprint.jira_sprint_id ?? sprint.sprint_name;
}

export function nodeKey(kind: DependencyKind, ref: string): string {
  return `${kind}:${ref}`;
}

export function parseNodeKey(key: string): DependencyNodeRef | null {
  const i = key.indexOf(":");
  if (i <= 0) return null;
  const kind = key.slice(0, i);
  if (kind !== "sprint") return null;
  return { kind: "sprint", ref: key.slice(i + 1) };
}

function isSprintDependencyRow(raw: Record<string, unknown>): boolean {
  return raw.source_kind === "sprint" && raw.target_kind === "sprint";
}

function mapRow(raw: Record<string, unknown>): JiraDependencyRow {
  return {
    id: String(raw.id),
    sourceKind: "sprint",
    sourceRef: String(raw.source_ref),
    targetKind: "sprint",
    targetRef: String(raw.target_ref),
    relation: raw.relation as DependencyRelation,
    note: String(raw.note ?? ""),
    source: (raw.source === "jira" ? "jira" : "manual") as DependencySource,
    jiraLinkId: raw.jira_link_id ? String(raw.jira_link_id) : null,
    createdAt: String(raw.created_at),
  };
}

/** 태스크 링크를 스프린트 간 의존성으로 합침 (서로 다른 스프린트만) */
export function rollupTaskLinksToSprintDependencies(
  links: TaskLinkSeed[],
  issueKeyToSprintId: Map<string, string>
): JiraDependencyUpsert[] {
  const byEdge = new Map<string, JiraDependencyUpsert>();

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

export async function fetchJiraDependencies(): Promise<JiraDependencyRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from("jira_dependencies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    if (/jira_dependencies|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "jira_dependencies 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/20260523120000_jira_dependencies.sql 을 실행하세요."
      );
    }
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((r) => isSprintDependencyRow(r as Record<string, unknown>))
    .map((r) => mapRow(r as Record<string, unknown>));
}

export async function insertJiraDependency(input: {
  sourceRef: string;
  targetRef: string;
  relation: DependencyRelation;
  note?: string;
}): Promise<JiraDependencyRow> {
  if (input.sourceRef === input.targetRef) {
    throw new Error("동일한 스프린트끼리는 의존성을 만들 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("jira_dependencies")
    .insert({
      source_kind: "sprint",
      source_ref: input.sourceRef,
      target_kind: "sprint",
      target_ref: input.targetRef,
      relation: input.relation,
      note: input.note ?? "",
      source: "manual",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteJiraDependency(id: string): Promise<void> {
  const { error } = await supabase.from("jira_dependencies").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function buildDependencyNodeCatalog(sprints: JiraSprintBoardRow[]): DependencyNode[] {
  return sprints.map((sprint) => {
    const ref = sprintNodeRef(sprint);
    return {
      key: nodeKey("sprint", ref),
      kind: "sprint",
      ref,
      label: sprint.sprint_name,
      sublabel: sprint.status,
      sprintId: sprint.jira_sprint_id ?? undefined,
    };
  });
}

export function resolveNodeLabel(
  ref: string,
  catalog: Map<string, DependencyNode>
): string {
  const n = catalog.get(nodeKey("sprint", ref));
  return n?.label ?? `스프린트 · ${ref}`;
}

export async function loadDependencyMapData(): Promise<{
  sprints: JiraSprintBoardRow[];
  dependencies: JiraDependencyRow[];
  nodes: DependencyNode[];
  nodeMap: Map<string, DependencyNode>;
}> {
  const board = await fetchJiraSprintBoardFromDb();
  const dependencies = await fetchJiraDependencies();
  const nodes = buildDependencyNodeCatalog(board.sprints);
  const nodeMap = new Map(nodes.map((n) => [n.key, n]));
  return {
    sprints: board.sprints,
    dependencies,
    nodes,
    nodeMap,
  };
}
