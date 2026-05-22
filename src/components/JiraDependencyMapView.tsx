import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sprintExpandId } from "@/lib/jira-sprint-sort";
import {
  ArrowRight,
  ListFilter,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  buildDependencyNodeCatalog,
  deleteJiraDependency,
  DEPENDENCY_DEFAULT_SPRINT_STATUSES,
  DEPENDENCY_RELATION_LABELS,
  DEPENDENCY_RELATION_SHORT,
  DEPENDENCY_SPRINT_STATUS_OPTIONS,
  DEPENDENCY_STATUS_SECTION_LABELS,
  DEPENDENCY_STATUS_SECTION_ORDER,
  filterDependenciesBySprintRefs,
  filterSprintsForDependencyView,
  groupSprintsByStatusArea,
  insertJiraDependency,
  loadDependencyMapData,
  nodeKey,
  parseNodeKey,
  resolveNodeLabel,
  sprintNodeRef,
  sprintRefSet,
  type DependencyRelation,
  type DependencyNode,
  type DependencySprintStatusKind,
  type JiraDependencyRow,
} from "@/lib/jira-dependencies";
import { normalizeWbsSprintStatus } from "@/lib/jira-wbs";
import { subscribeJiraSprints, type JiraSprintBoardRow } from "@/lib/jira-sprints-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ui } from "@/lib/design-system";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PickRole = "source" | "target" | null;

const DEP_TEXT = "text-xs leading-snug";
const DEP_TITLE = "text-xs font-semibold text-slate-900";
const DEP_MUTED = "text-xs text-slate-500";
const DEP_LABEL = "text-xs font-medium text-slate-600";
const DEP_SELECT = "h-8 text-xs [&>span]:text-xs";
const DEP_BTN = "h-8 text-xs";

const RELATION_COLORS: Record<DependencyRelation, string> = {
  depends_on: "#0ea5e9",
  blocks: "#ef4444",
  relates_to: "#a78bfa",
};

function sprintLinkId(s: JiraSprintBoardRow): string {
  return sprintExpandId(s);
}

function DependencyEdgeSvg({
  containerRef,
  edges,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  edges: { id: string; fromKey: string; toKey: string; relation: DependencyRelation }[];
}) {
  const [paths, setPaths] = useState<{ id: string; d: string; color: string }[]>([]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || edges.length === 0) {
      setPaths([]);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const next: { id: string; d: string; color: string }[] = [];

    for (const e of edges) {
      const fromEl = root.querySelector(`[data-node-key="${CSS.escape(e.fromKey)}"]`);
      const toEl = root.querySelector(`[data-node-key="${CSS.escape(e.toKey)}"]`);
      if (!fromEl || !toEl) continue;

      const a = fromEl.getBoundingClientRect();
      const b = toEl.getBoundingClientRect();
      const x1 = a.right - rootRect.left + root.scrollLeft;
      const y1 = a.top + a.height / 2 - rootRect.top + root.scrollTop;
      const x2 = b.left - rootRect.left + root.scrollLeft;
      const y2 = b.top + b.height / 2 - rootRect.top + root.scrollTop;
      const dx = Math.max(48, (x2 - x1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      next.push({ id: e.id, d, color: RELATION_COLORS[e.relation] });
    }

    setPaths(next);
  }, [containerRef, edges]);

  if (paths.length === 0) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={2}
          strokeOpacity={0.65}
          markerEnd="url(#dep-arrow)"
        />
      ))}
      <defs>
        <marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
        </marker>
      </defs>
    </svg>
  );
}

export function JiraDependencyMapView() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<JiraSprintBoardRow[]>([]);
  const [dependencies, setDependencies] = useState<JiraDependencyRow[]>([]);
  const [pickRole, setPickRole] = useState<PickRole>("source");
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [relation, setRelation] = useState<DependencyRelation>("depends_on");
  const [note, setNote] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<DependencySprintStatusKind>>(
    () => new Set(DEPENDENCY_DEFAULT_SPRINT_STATUSES)
  );
  const mapScrollRef = useRef<HTMLDivElement>(null);

  const visibleSprints = useMemo(
    () => filterSprintsForDependencyView(sprints, selectedStatuses),
    [sprints, selectedStatuses]
  );
  const visibleRefs = useMemo(() => sprintRefSet(visibleSprints), [visibleSprints]);
  const sprintByRef = useMemo(
    () => new Map(visibleSprints.map((s) => [sprintNodeRef(s), s])),
    [visibleSprints]
  );
  const sprintsByArea = useMemo(() => groupSprintsByStatusArea(visibleSprints), [visibleSprints]);

  const nodes = useMemo(() => buildDependencyNodeCatalog(visibleSprints), [visibleSprints]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const visibleDependencies = useMemo(
    () => filterDependenciesBySprintRefs(dependencies, visibleRefs),
    [dependencies, visibleRefs]
  );

  const allStatusesSelected =
    selectedStatuses.size === DEPENDENCY_SPRINT_STATUS_OPTIONS.length;

  const toggleSprintStatus = (kind: DependencySprintStatusKind, checked: boolean) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (checked) next.add(kind);
      else if (next.size > 1) next.delete(kind);
      return next;
    });
  };

  const selectAllSprintStatuses = () => {
    setSelectedStatuses(new Set(DEPENDENCY_SPRINT_STATUS_OPTIONS.map((o) => o.kind)));
  };

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      setError("Supabase 미설정");
      return;
    }
    try {
      const data = await loadDependencyMapData();
      setSprints(data.sprints);
      setDependencies(data.dependencies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void load();
    if (!configured) return;
    return subscribeJiraSprints(() => void load());
  }, [configured, load]);

  useEffect(() => {
    const keys = new Set(nodes.map((n) => n.key));
    if (sourceKey && !keys.has(sourceKey)) setSourceKey("");
    if (targetKey && !keys.has(targetKey)) setTargetKey("");
  }, [nodes, sourceKey, targetKey]);

  const handleNodeClick = (key: string) => {
    if (pickRole === "source") setSourceKey(key);
    else if (pickRole === "target") setTargetKey(key);
  };

  const handleAdd = async () => {
    const src = parseNodeKey(sourceKey);
    const tgt = parseNodeKey(targetKey);
    if (!src || !tgt) {
      toast({ title: "선행·후행 스프린트를 선택하세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const row = await insertJiraDependency({
        sourceRef: src.ref,
        targetRef: tgt.ref,
        relation,
        note,
      });
      setDependencies((prev) => [...prev, row]);
      setNote("");
      toast({ title: "스프린트 의존성이 추가되었습니다" });
    } catch (e) {
      toast({
        title: "저장 실패",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJiraDependency(id);
      setDependencies((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "삭제되었습니다" });
    } catch (e) {
      toast({
        title: "삭제 실패",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const mapEdges = useMemo(
    () =>
      visibleDependencies.map((d) => ({
        id: d.id,
        fromKey: nodeKey("sprint", d.sourceRef),
        toKey: nodeKey("sprint", d.targetRef),
        relation: d.relation,
      })),
    [visibleDependencies]
  );

  const nodesInMap = useMemo(() => {
    const keys = new Set<string>();
    for (const e of mapEdges) {
      keys.add(e.fromKey);
      keys.add(e.toKey);
    }
    return nodes.filter((n) => keys.has(n.key));
  }, [mapEdges, nodes]);

  if (!configured) {
    return (
      <div className={cn(ui.page, "flex h-full flex-col items-center justify-center gap-3 p-8")}>
        <p className={cn(DEP_TEXT, "text-slate-600")}>Supabase 환경 변수를 설정한 뒤 이용하세요.</p>
      </div>
    );
  }

  return (
    <div className={cn(ui.page, "flex h-full min-h-0 flex-col")}>
      <header className={cn(ui.card, "mx-4 mt-4 shrink-0")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={cn(ui.iconBox, ui.iconViolet)}>
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className={ui.title}>JIRA 의존성 맵</h1>
              <p className={ui.subtitle}>
                스프린트 간 선행·차단·연관 관계만 정의합니다. JIRA 이슈 링크는 동기화 시 스프린트 단위로
                합쳐집니다.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className={cn(DEP_BTN, "gap-1.5")}>
                  <ListFilter className="h-3.5 w-3.5" />
                  스프린트 상태
                  {allStatusesSelected
                    ? " · 전체"
                    : ` · ${[...selectedStatuses]
                        .map((k) => DEPENDENCY_STATUS_SECTION_LABELS[k])
                        .join(", ")}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 rounded-xl p-2 shadow-lg">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                  <Checkbox
                    checked={allStatusesSelected}
                    onCheckedChange={() => selectAllSprintStatuses()}
                  />
                  <span className="text-xs font-medium">전체</span>
                </label>
                <div className="my-1 border-t border-border/50" />
                {DEPENDENCY_SPRINT_STATUS_OPTIONS.map(({ kind, label }) => (
                  <label
                    key={kind}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={selectedStatuses.has(kind)}
                      disabled={selectedStatuses.size === 1 && selectedStatuses.has(kind)}
                      onCheckedChange={(v) => toggleSprintStatus(kind, v === true)}
                    />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
            <Button variant="outline" className={DEP_BTN} onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              새로고침
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className={cn("mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800", DEP_TEXT)}>
          {error}
        </div>
      )}

      {loading ? (
        <div className={cn("flex flex-1 items-center justify-center gap-2 text-slate-500", DEP_TEXT)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          불러오는 중…
        </div>
      ) : (
        <div
          className={cn(
            "mx-4 mb-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:flex-row",
            DEP_TEXT
          )}
        >
          {/* ── 스프린트 영역 ── */}
          <aside
            className={cn(
              "flex w-full min-h-0 flex-col border-b border-border bg-muted/15",
              "lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r"
            )}
          >
            <div className="shrink-0 border-b border-border/80 bg-muted/30 px-3 py-2.5">
              <p className={DEP_TITLE}>스프린트</p>
              <p className={cn("mt-0.5", DEP_MUTED)}>클릭하여 선행/후행 스프린트 지정</p>
              <div className="mt-1.5 flex gap-1">
                {(["source", "target"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setPickRole(role)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                      pickRole === role
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-background text-slate-600 ring-1 ring-border hover:bg-muted/60"
                    )}
                  >
                    {role === "source" ? "선행" : "후행"}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-card p-1.5 lg:max-h-none">
              {sprints.length === 0 ? (
                <p className={cn("p-3 text-center", DEP_MUTED)}>동기화된 스프린트가 없습니다.</p>
              ) : visibleSprints.length === 0 ? (
                <p className={cn("p-3 text-center", DEP_MUTED)}>
                  선택한 상태에 해당하는 스프린트가 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {DEPENDENCY_STATUS_SECTION_ORDER.map((kind) => {
                    const areaSprints = sprintsByArea.get(kind) ?? [];
                    if (areaSprints.length === 0) return null;
                    return (
                      <div key={kind}>
                        <p className="sticky top-0 z-[1] bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {DEPENDENCY_STATUS_SECTION_LABELS[kind]}
                          <span className="ml-1 font-normal text-slate-400">({areaSprints.length})</span>
                        </p>
                        <div className="space-y-0.5">
                          {areaSprints.map((sprint) => {
                            const sprintNodeKey = nodeKey("sprint", sprintNodeRef(sprint));
                            const { label: statusLabel } = normalizeWbsSprintStatus(sprint.status);
                            return (
                              <button
                                key={sprintLinkId(sprint)}
                                type="button"
                                className={cn(
                                  "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50",
                                  sourceKey === sprintNodeKey && "bg-sky-50 ring-1 ring-sky-200",
                                  targetKey === sprintNodeKey && "bg-violet-50 ring-1 ring-violet-200"
                                )}
                                onClick={() => handleNodeClick(sprintNodeKey)}
                              >
                                <span className="font-medium text-slate-900">{sprint.sprint_name}</span>
                                <span className="text-slate-500">{statusLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* ── 의존성 추가 · 목록/맵 ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b-2 border-border bg-muted/25 px-3 py-3">
              <p className={DEP_TITLE}>의존성 추가</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <NodeSelect label="선행 스프린트" value={sourceKey} onChange={setSourceKey} nodes={nodes} />
                <div className="flex flex-col gap-1">
                  <span className={DEP_LABEL}>관계</span>
                  <Select value={relation} onValueChange={(v) => setRelation(v as DependencyRelation)}>
                    <SelectTrigger className={DEP_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {(Object.keys(DEPENDENCY_RELATION_LABELS) as DependencyRelation[]).map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {DEPENDENCY_RELATION_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NodeSelect label="후행 스프린트" value={targetKey} onChange={setTargetKey} nodes={nodes} />
                <div className="flex flex-col justify-end">
                  <Button onClick={() => void handleAdd()} disabled={saving} className={cn("w-full", DEP_BTN)}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    추가
                  </Button>
                </div>
              </div>
              <input
                type="text"
                className={cn(ui.input, "mt-1.5")}
                placeholder="메모 (선택)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <Tabs defaultValue="list" className="flex min-h-0 flex-1 flex-col bg-card">
              <TabsList className="mx-3 mt-2 h-8 w-fit border border-border/60 bg-muted/20 p-0.5 text-xs">
                <TabsTrigger value="list" className="h-7 px-2.5 text-xs">
                  목록
                </TabsTrigger>
                <TabsTrigger value="map" className="h-7 px-2.5 text-xs">
                  맵
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="min-h-0 flex-1 overflow-auto px-3 pb-3">
                {dependencies.length === 0 ? (
                  <p className={cn("py-6 text-center", DEP_MUTED)}>
                    정의된 스프린트 의존성이 없습니다.
                  </p>
                ) : visibleDependencies.length === 0 ? (
                  <p className={cn("py-6 text-center", DEP_MUTED)}>
                    선택한 스프린트 상태에 해당하는 의존성이 없습니다. 필터에서 종료·예정 등을
                    확인하세요.
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-4">
                    {DEPENDENCY_STATUS_SECTION_ORDER.map((kind) => {
                      const areaDeps = visibleDependencies.filter((d) => {
                        const src = sprintByRef.get(d.sourceRef);
                        return src && normalizeWbsSprintStatus(src.status).kind === kind;
                      });
                      if (areaDeps.length === 0) return null;
                      return (
                        <div key={kind} className="rounded-lg border border-gray-100 bg-white/80">
                          <p className="border-b border-gray-100 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            {DEPENDENCY_STATUS_SECTION_LABELS[kind]}
                            <span className="ml-1 font-normal text-slate-500">({areaDeps.length})</span>
                          </p>
                          <table className={cn("w-full", ui.dataTable)}>
                            <thead>
                              <tr className={ui.tableHead}>
                                <th className="px-2 py-1.5 text-center">선행 스프린트</th>
                                <th className="px-2 py-1.5 text-center">관계</th>
                                <th className="px-2 py-1.5 text-center">후행 스프린트</th>
                                <th className="px-2 py-1.5 text-center">출처</th>
                                <th className="w-8 px-1 py-1.5 text-center" />
                              </tr>
                            </thead>
                            <tbody>
                              {areaDeps.map((d) => (
                                <DependencyTableRow
                                  key={d.id}
                                  d={d}
                                  nodeMap={nodeMap}
                                  onDelete={handleDelete}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="map" className="relative min-h-0 flex-1 overflow-hidden px-3 pb-3">
                {mapEdges.length === 0 ? (
                  <p className={cn("py-6 text-center", DEP_MUTED)}>
                    스프린트 의존성을 추가하면 연결 맵이 표시됩니다.
                  </p>
                ) : (
                  <div
                    ref={mapScrollRef}
                    className="relative mt-1.5 max-h-[calc(100vh-22rem)] overflow-auto rounded-lg border border-gray-100 bg-slate-50/50 p-4"
                  >
                    <DependencyEdgeSvg containerRef={mapScrollRef} edges={mapEdges} />
                    <div className="relative z-10 space-y-4">
                      {DEPENDENCY_STATUS_SECTION_ORDER.map((kind) => {
                        const areaNodes = nodesInMap.filter((n) => {
                          const sprint = sprintByRef.get(n.ref);
                          return sprint && normalizeWbsSprintStatus(sprint.status).kind === kind;
                        });
                        if (areaNodes.length === 0) return null;
                        return (
                          <div
                            key={kind}
                            className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-3"
                          >
                            <p className="mb-2 text-xs font-semibold text-slate-600">
                              {DEPENDENCY_STATUS_SECTION_LABELS[kind]}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {areaNodes.map((n) => (
                                <div
                                  key={n.key}
                                  data-node-key={n.key}
                                  className="min-w-[140px] rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs shadow-xs"
                                >
                                  <p className="font-semibold leading-snug text-slate-900">{n.label}</p>
                                  {n.sublabel && (
                                    <p className="mt-0.5 text-slate-500">{n.sublabel}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="relative z-10 mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-2">
                      {(Object.keys(RELATION_COLORS) as DependencyRelation[]).map((r) => (
                        <span key={r} className={cn("flex items-center gap-1 text-slate-600", DEP_TEXT)}>
                          <span
                            className="h-0.5 w-6 rounded"
                            style={{ backgroundColor: RELATION_COLORS[r] }}
                          />
                          {DEPENDENCY_RELATION_SHORT[r]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyTableRow({
  d,
  nodeMap,
  onDelete,
}: {
  d: JiraDependencyRow;
  nodeMap: Map<string, DependencyNode>;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className={ui.tableRow}>
      <td className="max-w-[200px] truncate px-2 py-1.5 text-slate-800">
        {resolveNodeLabel(d.sourceRef, nodeMap)}
      </td>
      <td className="px-2 py-1.5">
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${RELATION_COLORS[d.relation]}22`,
            color: RELATION_COLORS[d.relation],
          }}
        >
          <ArrowRight className="h-3 w-3 shrink-0" />
          {DEPENDENCY_RELATION_SHORT[d.relation]}
        </span>
      </td>
      <td className="max-w-[200px] truncate px-2 py-1.5 text-slate-800">
        {resolveNodeLabel(d.targetRef, nodeMap)}
      </td>
      <td className="px-2 py-1.5">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-medium",
            d.source === "jira" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
          )}
        >
          {d.source === "jira" ? "JIRA" : "수동"}
        </span>
      </td>
      <td className="px-1 py-1.5">
        {d.source === "manual" ? (
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => void onDelete(d.id)}
            aria-label="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-xs text-slate-400" title="JIRA 동기화로 관리">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function NodeSelect({
  label,
  value,
  onChange,
  nodes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  nodes: DependencyNode[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={DEP_LABEL}>{label}</span>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className={DEP_SELECT}>
          <SelectValue placeholder="스프린트 선택…" />
        </SelectTrigger>
        <SelectContent className="max-h-72 text-xs">
          {nodes.map((n) => (
            <SelectItem key={n.key} value={n.key} className="text-xs">
              {n.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
