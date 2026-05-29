import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import "@/styles/gantt-wbs.css";
import { CalendarRange, ChevronsDownUp, ListFilter, Loader2, Users } from "lucide-react";
import { fetchJiraSprintBoardFromDb, subscribeJiraSprints } from "@/lib/jira-sprints-dashboard";
import { sprintExpandId } from "@/lib/jira-sprint-sort";
import {
  applyWbsFilters,
  buildWbsModel,
  collectAssigneesFromTasks,
  filterSprintsByWbsStatus,
  flattenWbsRows,
  isSprintInProgress,
  WBS_DEFAULT_SPRINT_STATUSES,
  WBS_SPRINT_STATUS_OPTIONS,
  WBS_PROJECT_MILESTONES,
  wbsMilestoneCaption,
  WBS_UNASSIGNED_LABEL,
  WBS_UNASSIGNED_SPRINT_KEY,
  WBS_UNASSIGNED_SPRINT_LABEL,
  type WbsSprintStatusKind,
} from "@/lib/jira-wbs";
import { JiraWbsGanttMilestoneOverlay } from "@/components/JiraWbsGanttMilestoneOverlay";
import { JiraWbsGanttMonthHeaderOverlay } from "@/components/JiraWbsGanttMonthHeaderOverlay";
import { JiraWbsGanttWeekHeaderOverlay } from "@/components/JiraWbsGanttWeekHeaderOverlay";
import { JiraWbsGanttProgressOverlay } from "@/components/JiraWbsGanttProgressOverlay";
import {
  appendWbsTimelineEndPad,
  ganttTaskDisplayRows,
  mapWbsRowsToGanttTasks,
  resolveWbsAssigneeColor,
  type WbsGanttMeta,
} from "@/lib/jira-wbs-gantt";
import {
  columnWidthForView,
  computeGanttTimeline,
  computeMilestoneGuides,
  computeWbsGanttPreSteps,
  WBS_GANTT_BAR_FILL,
  WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  WBS_GANTT_HEADER_HEIGHT,
  WBS_GANTT_MILESTONE_LABEL_BAND,
  WBS_GANTT_ROW_HEIGHT,
  WBS_GANTT_TIMELINE_WIDTH_RATIO,
} from "@/lib/jira-wbs-gantt-timeline";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { TEAM_MEMBERS } from "@/lib/index";
import { sprintStatusBadge, ui } from "@/lib/design-system";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWbsGanttHorizontalScroll } from "@/lib/use-wbs-gantt-horizontal-scroll";
import { useWbsGanttVerticalScroll } from "@/lib/use-wbs-gantt-vertical-scroll";
import {
  buildWbsGanttRemountKey,
  pruneWbsExpandedSet,
  toggleWbsInProgressExpanded,
  pruneWbsExpandedForFilters,
  wbsBoardRevisionKey,
  wbsExpandedSetsEqual,
  wbsSetToStableKey,
} from "@/lib/wbs-gantt-filter-state";

const LIST_COL = {
  tree: 200,
  status: 52,
  from: 80,
  to: 80,
  weeks: 44,
  assignee: 72,
} as const;
const LIST_WIDTH =
  LIST_COL.tree + LIST_COL.status + LIST_COL.from + LIST_COL.to + LIST_COL.weeks + LIST_COL.assignee;

const WBS_GANTT_MULTI_ASSIGNEE_COLOR = "#64748b";
const WBS_GANTT_UNASSIGNED_COLOR = "#94a3b8";

function wbsAssigneeDotColor(assignee?: string): string {
  if (!assignee?.trim() || assignee === "—") return WBS_GANTT_UNASSIGNED_COLOR;
  if (assignee.includes(",") || assignee.includes(" 외 ")) return WBS_GANTT_MULTI_ASSIGNEE_COLOR;
  return resolveWbsAssigneeColor(assignee) ?? WBS_GANTT_UNASSIGNED_COLOR;
}

function WbsAssigneeColorDot({ assignee, className }: { assignee?: string; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: wbsAssigneeDotColor(assignee) }}
      aria-hidden
    />
  );
}

const ROW_H = WBS_GANTT_ROW_HEIGHT;
const MILESTONE_BAND = WBS_GANTT_MILESTONE_LABEL_BAND;
const CALENDAR_HEADER_H = WBS_GANTT_CALENDAR_HEADER_HEIGHT;
const HEADER_H = WBS_GANTT_HEADER_HEIGHT;
/** gantt-task-react 하단 가로 스크롤바 영역 */
const H_SCROLLBAR_RESERVE = 16;

type GanttListProps = {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  tasks: Task[];
  metaByTaskId: Map<string, WbsGanttMeta>;
  locale: string;
  selectedTaskId: string;
  setSelectedTask: (id: string) => void;
  onExpanderClick: (task: Task) => void;
};

function WbsGanttTaskListHeader({
  fontFamily,
  fontSize,
}: {
  fontFamily: string;
  fontSize: string;
}) {
  const headerHalf = CALENDAR_HEADER_H / 2;
  const cell =
    "wbs-gantt-list-header-cell flex h-full min-h-0 shrink-0 items-center justify-center px-1 text-center text-[10px] font-semibold uppercase tracking-wide";
  return (
    <div
      className="wbs-gantt-list-header flex shrink-0 flex-col"
      style={{
        height: HEADER_H,
        minHeight: HEADER_H,
        maxHeight: HEADER_H,
        fontFamily,
        fontSize,
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div className="wbs-gantt-list-header-milestone shrink-0" aria-hidden />
      {/* 우측 년·월 행(34px)과 동일 높이 — 상단 티어 */}
      <div
        className="wbs-gantt-list-header-tier wbs-gantt-list-header-tier--month shrink-0"
        style={{ height: headerHalf, minHeight: headerHalf, maxHeight: headerHalf }}
        aria-hidden
      />
      {/* 우측 주차 행(34px)과 동일 높이 — 컬럼 라벨 */}
      <div
        className="wbs-gantt-list-header-tier wbs-gantt-list-header-tier--week flex shrink-0"
        style={{ height: headerHalf, minHeight: headerHalf, maxHeight: headerHalf }}
      >
        <div className={cn(cell, "wbs-gantt-list-col-tree")} style={{ width: LIST_COL.tree }}>
          스프린트 / 태스크
        </div>
        <div className={cell} style={{ width: LIST_COL.status }}>
          상태
        </div>
        <div className={cell} style={{ width: LIST_COL.from }}>
          From
        </div>
        <div className={cell} style={{ width: LIST_COL.to }}>
          To
        </div>
        <div className={cell} style={{ width: LIST_COL.weeks }}>
          주수
        </div>
        <div
          className={cn(cell, "wbs-gantt-list-col-assignee")}
          style={{ width: LIST_COL.assignee }}
        >
          담당자
        </div>
      </div>
    </div>
  );
}

function WbsGanttTaskListTable({
  rowHeight,
  fontFamily,
  fontSize,
  tasks,
  metaByTaskId,
  selectedTaskId,
  setSelectedTask,
  onExpanderClick,
}: GanttListProps) {
  const rows = ganttTaskDisplayRows(tasks);

  return (
    <div
      className="wbs-gantt-list-body w-full shrink-0"
      style={{ fontFamily, fontSize, width: "100%", maxWidth: "100%" }}
    >
      {rows.map((task, idx) => {
        const meta = metaByTaskId.get(task.id);
        const isSprint = meta?.kind === "sprint";
        const selected = selectedTaskId === task.id;
        const zebra = idx % 2 === 1;

        return (
          <div
            key={task.id}
            role="row"
            className={cn(
              "wbs-gantt-list-row flex shrink-0 cursor-pointer border-b border-slate-200 transition-colors dark:border-slate-700",
              selected && "bg-primary/10",
              !selected && isSprint && "bg-slate-100 dark:bg-slate-800/80",
              !selected && !isSprint && zebra && "bg-slate-50 dark:bg-slate-900/50",
              !selected && !isSprint && !zebra && "bg-white dark:bg-slate-950"
            )}
            style={{
              height: rowHeight,
              minHeight: rowHeight,
              maxHeight: rowHeight,
            }}
            onClick={() => setSelectedTask(task.id)}
          >
            <div
              className="wbs-gantt-list-body-cell wbs-gantt-list-col-tree flex min-w-0 items-center justify-start px-2 text-left"
              style={{ width: LIST_COL.tree }}
            >
              <div
                className="flex w-full min-w-0 max-w-full items-center justify-start gap-1"
                style={{ paddingLeft: (meta?.depth ?? 0) * 12 }}
              >
                {isSprint ? (
                  <button
                    type="button"
                    className="flex h-4 w-3 shrink-0 items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpanderClick(task);
                    }}
                    aria-label="펼치기/접기"
                  >
                    {task.hideChildren ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className="inline-flex h-4 w-3 shrink-0 items-center justify-center" aria-hidden />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-[11px] font-semibold",
                    isSprint
                      ? meta?.statusKind === "active"
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-slate-900 dark:text-slate-100"
                      : "text-slate-800 dark:text-slate-200"
                  )}
                  title={meta?.treeLabel ?? task.name}
                >
                  {meta?.treeLabel ?? task.name}
                </span>
              </div>
            </div>
            <div
              className="wbs-gantt-list-body-cell flex items-center justify-center px-0.5 text-[10px]"
              style={{ width: LIST_COL.status }}
            >
              {meta?.statusLabel && meta.statusKind ? (
                <span className={cn(sprintStatusBadge[meta.statusKind], "text-[9px] px-1.5 py-0")}>
                  {meta.statusLabel}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div
              className="wbs-gantt-list-body-cell flex items-center justify-center font-mono text-[10px] font-medium tabular-nums text-slate-800 dark:text-slate-200"
              style={{ width: LIST_COL.from }}
            >
              {meta?.fromDate ?? "—"}
            </div>
            <div
              className="wbs-gantt-list-body-cell flex items-center justify-center font-mono text-[10px] font-medium tabular-nums text-slate-800 dark:text-slate-200"
              style={{ width: LIST_COL.to }}
            >
              {meta?.toDate ?? "—"}
            </div>
            <div
              className="wbs-gantt-list-body-cell flex items-center justify-center text-[10px] font-medium tabular-nums text-slate-800 dark:text-slate-200"
              style={{ width: LIST_COL.weeks }}
            >
              {meta?.weekCount ?? "—"}
            </div>
            <div
              className="wbs-gantt-list-body-cell wbs-gantt-list-col-assignee flex min-w-0 items-center justify-center gap-1 px-0.5 text-center text-[10px] font-medium text-slate-700 dark:text-slate-300"
              style={{ width: LIST_COL.assignee, maxWidth: LIST_COL.assignee }}
              title={meta?.assignee}
            >
              <WbsAssigneeColorDot assignee={meta?.assignee} />
              <span className="max-w-[calc(100%-0.75rem)] truncate">{meta?.assignee ?? "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function JiraWbsGanttView() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string> | null>(null);
  const [selectedSprintStatuses, setSelectedSprintStatuses] = useState<Set<WbsSprintStatusKind>>(
    () => new Set(WBS_DEFAULT_SPRINT_STATUSES)
  );
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof fetchJiraSprintBoardFromDb>> | null>(null);
  const ganttWrapRef = useRef<HTMLDivElement>(null);
  const ganttRootRef = useRef<HTMLDivElement>(null);
  const [ganttHeight, setGanttHeight] = useState(480);

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      setBoard(null);
      setError("Supabase 미설정");
      return;
    }
    try {
      const data = await fetchJiraSprintBoardFromDb();
      setBoard(data);
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
    let debounceId: ReturnType<typeof setTimeout> | undefined;
    return subscribeJiraSprints(() => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => void load(), 400);
    });
  }, [configured, load]);

  useEffect(() => {
    const el = ganttWrapRef.current;
    if (!el) return;
    const measure = () => {
      setGanttHeight(Math.max(240, el.clientHeight - H_SCROLLBAR_RESERVE));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [loading, board]);

  const assigneeFilterActive = selectedAssignees != null && selectedAssignees.size > 0;
  const allStatusesSelected = selectedSprintStatuses.size === WBS_SPRINT_STATUS_OPTIONS.length;
  const boardRevisionKey = wbsBoardRevisionKey(board);
  const sprintStatusKey = wbsSetToStableKey(selectedSprintStatuses);
  const assigneeFilterKey = assigneeFilterActive
    ? wbsSetToStableKey(selectedAssignees!)
    : "*";

  const assigneeOptions = useMemo(() => {
    if (!board) return [];
    return collectAssigneesFromTasks(board.tasksBySprintId, true);
  }, [board]);

  const statusFilteredSprints = useMemo(() => {
    if (!board) return [];
    return filterSprintsByWbsStatus(board.sprints, selectedSprintStatuses);
  }, [board, boardRevisionKey, sprintStatusKey]);

  const statusFilterEmpty = board != null && statusFilteredSprints.length === 0;

  const inProgressSprintIds = useMemo(
    () => statusFilteredSprints.filter((s) => isSprintInProgress(s.status)).map((s) => sprintExpandId(s)),
    [statusFilteredSprints]
  );

  const { sprintRows } = useMemo(() => {
    if (!board) return { sprintRows: [] as ReturnType<typeof buildWbsModel>["sprintRows"] };
    const { sprints, tasksBySprintId } = applyWbsFilters(
      board.sprints,
      board.tasksBySprintId,
      selectedSprintStatuses,
      selectedAssignees
    );
    return buildWbsModel(sprints, tasksBySprintId);
  }, [board, boardRevisionKey, sprintStatusKey, assigneeFilterKey]);

  const visibleSprintIds = useMemo(
    () => sprintRows.map((s) => s.id),
    [sprintRows]
  );

  const visibleSprintIdKey = useMemo(
    () => visibleSprintIds.join("\u0001"),
    [visibleSprintIds]
  );

  const expandedKey = useMemo(() => wbsSetToStableKey(expanded), [expanded]);

  /** 필터와 동일 렌더 사이클에 적용 — useEffect 지연으로 인한 1프레임 불일치 방지 */
  const expandedForRender = useMemo(
    () => pruneWbsExpandedSet(expanded, visibleSprintIds),
    [expanded, expandedKey, visibleSprintIdKey, visibleSprintIds]
  );

  const allInProgressExpanded =
    inProgressSprintIds.length > 0 &&
    inProgressSprintIds.every((id) => expandedForRender.has(id));

  const commitExpandedPrune = useCallback(
    (statuses: Set<WbsSprintStatusKind>, assignees: Set<string> | null) => {
      if (!board) return;
      setExpanded((prev) => {
        const pruned = pruneWbsExpandedForFilters(prev, board, statuses, assignees);
        return wbsExpandedSetsEqual(prev, pruned) ? prev : pruned;
      });
    },
    [board]
  );

  const handleToggleSprintStatus = useCallback(
    (kind: WbsSprintStatusKind, checked: boolean) => {
      const next = new Set(selectedSprintStatuses);
      if (checked) next.add(kind);
      else if (next.size > 1) next.delete(kind);
      setSelectedSprintStatuses(next);
      commitExpandedPrune(next, selectedAssignees);
    },
    [selectedSprintStatuses, selectedAssignees, commitExpandedPrune]
  );

  const handleSelectAllSprintStatuses = useCallback(() => {
    const all = new Set(WBS_SPRINT_STATUS_OPTIONS.map((o) => o.kind));
    setSelectedSprintStatuses(all);
    commitExpandedPrune(all, selectedAssignees);
    setStatusPopoverOpen(false);
  }, [selectedAssignees, commitExpandedPrune]);

  const handleSelectAllAssignees = useCallback(() => {
    setSelectedAssignees(null);
    commitExpandedPrune(selectedSprintStatuses, null);
    setAssigneePopoverOpen(false);
  }, [selectedSprintStatuses, commitExpandedPrune]);

  const handleToggleAssignee = useCallback(
    (name: string, checked: boolean) => {
      const next = new Set(selectedAssignees ?? []);
      if (checked) next.add(name);
      else next.delete(name);
      const resolved = next.size === 0 ? null : next;
      setSelectedAssignees(resolved);
      commitExpandedPrune(selectedSprintStatuses, resolved);
    },
    [selectedAssignees, selectedSprintStatuses, commitExpandedPrune]
  );

  const ganttRemountKey = useMemo(
    () =>
      buildWbsGanttRemountKey({
        viewMode,
        sprintStatuses: selectedSprintStatuses,
        assigneeFilterActive,
        selectedAssignees,
      }),
    [viewMode, selectedSprintStatuses, assigneeFilterActive, selectedAssignees]
  );

  const flatRows = useMemo(
    () => flattenWbsRows(sprintRows, expandedForRender),
    [sprintRows, expandedForRender]
  );

  const { tasks, metaByTaskId } = useMemo(
    () => mapWbsRowsToGanttTasks(flatRows, expandedForRender),
    [flatRows, expandedForRender]
  );

  const ganttTasks = useMemo(
    () =>
      appendWbsTimelineEndPad(
        tasks.map((t) => ({
          ...t,
          isDisabled: true,
        }))
      ),
    [tasks]
  );

  const displayGanttTasks = useMemo(() => ganttTaskDisplayRows(ganttTasks), [ganttTasks]);

  const preStepsCount = useMemo(
    () => computeWbsGanttPreSteps(ganttTasks, viewMode),
    [ganttTasks, viewMode]
  );

  const columnWidth = columnWidthForView(viewMode);

  const timeline = useMemo(
    () => computeGanttTimeline(ganttTasks, viewMode, preStepsCount),
    [ganttTasks, viewMode, preStepsCount]
  );

  const milestoneGuides = useMemo(
    () => computeMilestoneGuides(ganttTasks, viewMode, preStepsCount),
    [ganttTasks, viewMode, preStepsCount]
  );

  const ganttScrollReady = !loading && !statusFilterEmpty && sprintRows.length > 0;

  useWbsGanttHorizontalScroll(ganttRootRef, ganttScrollReady, ganttRemountKey);
  useWbsGanttVerticalScroll(ganttRootRef, ganttScrollReady, ganttRemountKey);

  useEffect(() => {
    const root = ganttRootRef.current;
    if (!root) return;
    const timelineEl = root.querySelector<HTMLElement>("._CZjuD");
    const hScrollEl = root.querySelector<HTMLElement>("._2k9Ys");
    timelineEl?.scrollTo({ left: 0 });
    if (hScrollEl) hScrollEl.scrollLeft = 0;
  }, [timeline.startDate, timeline.viewDate, viewMode, ganttRemountKey, displayGanttTasks.length]);

  const listProps: GanttListProps = useMemo(
    () => ({
      rowHeight: ROW_H,
      rowWidth: `${LIST_WIDTH}px`,
      fontFamily: "var(--font-sans)",
      fontSize: "11px",
      tasks: displayGanttTasks,
      metaByTaskId,
      locale: "ko",
      selectedTaskId: "",
      setSelectedTask: () => {},
      onExpanderClick: (task: Task) => {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(task.id)) next.delete(task.id);
          else next.add(task.id);
          return next;
        });
      },
    }),
    [displayGanttTasks, metaByTaskId]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInProgressSprints = () => {
    setExpanded((prev) => {
      const pruned = pruneWbsExpandedSet(prev, visibleSprintIds);
      return toggleWbsInProgressExpanded(pruned, inProgressSprintIds);
    });
  };

  return (
    <div className={cn(ui.card, "flex h-full min-h-0 flex-col overflow-hidden")}>
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={ui.iconBox}>
              <CalendarRange className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h1 className={ui.title}>JIRA WBS · 일정</h1>
              <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-muted-foreground">
                gantt-task-react · 담당자별 막대 색상 · 월/주 뷰 · 좌측 메타 컬럼 고정
              </p>
            </div>
          </div>
          {!loading && board && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === ViewMode.Month && "bg-primary/15 text-primary"
                  )}
                  onClick={() => setViewMode(ViewMode.Month)}
                >
                  월
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === ViewMode.Week && "bg-primary/15 text-primary"
                  )}
                  onClick={() => setViewMode(ViewMode.Week)}
                >
                  주
                </button>
              </div>
              <WbsGanttToolbar
                inProgressCount={inProgressSprintIds.length}
                allInProgressExpanded={allInProgressExpanded}
                onToggleInProgress={toggleInProgressSprints}
                statusPopoverOpen={statusPopoverOpen}
                onStatusPopoverOpenChange={setStatusPopoverOpen}
                assigneePopoverOpen={assigneePopoverOpen}
                onAssigneePopoverOpenChange={setAssigneePopoverOpen}
                selectedSprintStatuses={selectedSprintStatuses}
                allStatusesSelected={allStatusesSelected}
                onToggleSprintStatus={handleToggleSprintStatus}
                onSelectAllSprintStatuses={handleSelectAllSprintStatuses}
                assigneeOptions={assigneeOptions}
                selectedAssignees={selectedAssignees}
                onSelectAllAssignees={handleSelectAllAssignees}
                onToggleAssignee={handleToggleAssignee}
                assigneeFilterActive={assigneeFilterActive}
              />
            </div>
          )}
        </div>
        {!loading && board && assigneeOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/50 pt-2">
            <span className="text-[10px] font-medium text-muted-foreground">담당자 색상</span>
            {TEAM_MEMBERS.filter((m) => assigneeOptions.includes(m.name)).map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-[10px] text-slate-700 dark:text-slate-300">
                <WbsAssigneeColorDot assignee={m.name} />
                {m.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <WbsAssigneeColorDot assignee="—" />
              미배정
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: WBS_GANTT_MULTI_ASSIGNEE_COLOR }}
                aria-hidden
              />
              복수 담당 스프린트
            </span>
          </div>
        )}
      </header>

      {error && (
        <p className="mx-6 mt-3 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-2.5 text-sm text-red-800">
          {error}
        </p>
      )}

      <div ref={ganttWrapRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-xs text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary/80" />
            WBS 데이터 불러오는 중…
          </div>
        ) : statusFilterEmpty || sprintRows.length === 0 ? (
          <div className="px-6 py-24 text-center text-xs text-muted-foreground">
            {assigneeFilterActive
              ? "선택한 조건에 해당하는 스프린트·태스크가 없습니다."
              : statusFilterEmpty
                ? "선택한 상태에 해당하는 스프린트가 없습니다."
                : "스프린트 데이터가 없습니다. JIRA 동기화를 실행하세요."}
          </div>
        ) : (
          <div
            ref={ganttRootRef}
            className={cn(
              "wbs-gantt-root relative min-h-0 flex-1",
              viewMode === ViewMode.Week ? "wbs-gantt-root--week" : "wbs-gantt-root--month"
            )}
            style={
              {
                "--wbs-week-col": `${columnWidthForView(ViewMode.Week)}px`,
                "--wbs-month-col": `${columnWidthForView(ViewMode.Month)}px`,
                "--wbs-milestone-label-band": `${MILESTONE_BAND}px`,
                "--wbs-gantt-calendar-header-height": `${CALENDAR_HEADER_H}px`,
                "--wbs-gantt-header-height": `${HEADER_H}px`,
                "--wbs-gantt-header-half": `${CALENDAR_HEADER_H / 2}px`,
                "--wbs-gantt-row-height": `${ROW_H}px`,
                "--wbs-list-min-width": `${LIST_WIDTH}px`,
                "--wbs-timeline-width-ratio": String(WBS_GANTT_TIMELINE_WIDTH_RATIO),
              } as React.CSSProperties
            }
          >
            <Gantt
              key={ganttRemountKey}
              tasks={ganttTasks}
              viewMode={viewMode}
              locale="ko"
              viewDate={timeline.viewDate}
              listCellWidth={`${LIST_WIDTH}px`}
              columnWidth={columnWidth}
              preStepsCount={preStepsCount}
              rowHeight={ROW_H}
              headerHeight={CALENDAR_HEADER_H}
              ganttHeight={ganttHeight}
              barCornerRadius={4}
              barFill={WBS_GANTT_BAR_FILL}
              fontFamily="var(--font-sans)"
              fontSize="11px"
              barProgressColor={WBS_GANTT_UNASSIGNED_COLOR}
              barProgressSelectedColor={WBS_GANTT_UNASSIGNED_COLOR}
              barBackgroundColor={WBS_GANTT_UNASSIGNED_COLOR}
              barBackgroundSelectedColor={WBS_GANTT_UNASSIGNED_COLOR}
              projectProgressColor={WBS_GANTT_MULTI_ASSIGNEE_COLOR}
              projectProgressSelectedColor={WBS_GANTT_MULTI_ASSIGNEE_COLOR}
              projectBackgroundColor={WBS_GANTT_MULTI_ASSIGNEE_COLOR}
              projectBackgroundSelectedColor={WBS_GANTT_MULTI_ASSIGNEE_COLOR}
              milestoneBackgroundColor="#f59e0b"
              milestoneBackgroundSelectedColor="#d97706"
              todayColor="color-mix(in srgb, #2563eb 12%, transparent)"
              arrowColor="#64748b"
              TaskListHeader={({ fontFamily, fontSize }) => (
                <WbsGanttTaskListHeader fontFamily={fontFamily} fontSize={fontSize} />
              )}
              TaskListTable={({ rowHeight, fontFamily, fontSize, tasks: listTasks, selectedTaskId, setSelectedTask }) => (
                <WbsGanttTaskListTable
                  rowHeight={rowHeight}
                  rowWidth={`${LIST_WIDTH}px`}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  tasks={listTasks}
                  metaByTaskId={listProps.metaByTaskId}
                  locale={listProps.locale}
                  selectedTaskId={selectedTaskId}
                  setSelectedTask={setSelectedTask}
                  onExpanderClick={listProps.onExpanderClick}
                />
              )}
              onExpanderClick={(task) => {
                if (task.type !== "project") return;
                toggleExpand(task.id);
              }}
            />
            {viewMode === ViewMode.Week && (
              <>
                <JiraWbsGanttMonthHeaderOverlay
                  rootRef={ganttRootRef}
                  listWidth={LIST_WIDTH}
                  calendarHeaderHeight={CALENDAR_HEADER_H}
                  weekColumnDates={timeline.dates}
                  columnWidth={columnWidth}
                  svgWidth={timeline.svgWidth}
                />
                <JiraWbsGanttWeekHeaderOverlay
                  rootRef={ganttRootRef}
                  listWidth={LIST_WIDTH}
                  calendarHeaderHeight={CALENDAR_HEADER_H}
                  weekColumnDates={timeline.dates}
                  columnWidth={columnWidth}
                  svgWidth={timeline.svgWidth}
                />
              </>
            )}
            <JiraWbsGanttProgressOverlay
              rootRef={ganttRootRef}
              displayTasks={displayGanttTasks}
              metaByTaskId={metaByTaskId}
              dates={timeline.dates}
              columnWidth={columnWidth}
              svgWidth={timeline.svgWidth}
              ganttHeight={ganttHeight}
              listWidth={LIST_WIDTH}
            />
            <JiraWbsGanttMilestoneOverlay
              rootRef={ganttRootRef}
              guides={milestoneGuides}
              listWidth={LIST_WIDTH}
              milestoneBand={MILESTONE_BAND}
              calendarHeaderHeight={CALENDAR_HEADER_H}
              bodyHeight={ganttHeight}
              svgWidth={timeline.svgWidth}
              scrollbarReserve={H_SCROLLBAR_RESERVE}
            />
          </div>
        )}
      </div>

      <footer className={cn(ui.cardFooter, "shrink-0 bg-muted/25")}>
        마일스톤:{" "}
        {WBS_PROJECT_MILESTONES.map((m, i) => {
          const arrowColor =
            m.tone === "amber" ? "#ea580c" : m.tone === "emerald" ? "#059669" : "#64748b";
          return (
            <span key={m.id} className="inline-flex items-center gap-1">
              {i > 0 ? <span className="text-muted-foreground"> · </span> : null}
              <span className="text-[10px] leading-none font-bold" style={{ color: arrowColor }} aria-hidden>
                ▼
              </span>
              <span>
                {m.label} ({wbsMilestoneCaption(m)})
              </span>
            </span>
          );
        })}
      </footer>
    </div>
  );
}

function WbsGanttToolbar({
  inProgressCount,
  allInProgressExpanded,
  onToggleInProgress,
  statusPopoverOpen,
  onStatusPopoverOpenChange,
  assigneePopoverOpen,
  onAssigneePopoverOpenChange,
  selectedSprintStatuses,
  allStatusesSelected,
  onToggleSprintStatus,
  onSelectAllSprintStatuses,
  assigneeOptions,
  selectedAssignees,
  onSelectAllAssignees,
  onToggleAssignee,
  assigneeFilterActive,
}: {
  inProgressCount: number;
  allInProgressExpanded: boolean;
  onToggleInProgress: () => void;
  statusPopoverOpen: boolean;
  onStatusPopoverOpenChange: (open: boolean) => void;
  assigneePopoverOpen: boolean;
  onAssigneePopoverOpenChange: (open: boolean) => void;
  selectedSprintStatuses: Set<WbsSprintStatusKind>;
  allStatusesSelected: boolean;
  onToggleSprintStatus: (kind: WbsSprintStatusKind, checked: boolean) => void;
  onSelectAllSprintStatuses: () => void;
  assigneeOptions: string[];
  selectedAssignees: Set<string> | null;
  onSelectAllAssignees: () => void;
  onToggleAssignee: (name: string, checked: boolean) => void;
  assigneeFilterActive: boolean;
}) {
  const statusLabel = allStatusesSelected ? "전체" : `${selectedSprintStatuses.size}종 선택`;
  const assigneeLabel = !assigneeFilterActive ? "전체 담당자" : `${selectedAssignees!.size}명 선택`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover modal={false} open={statusPopoverOpen} onOpenChange={onStatusPopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ListFilter className="h-3.5 w-3.5" />
            상태: {statusLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 rounded-xl p-2 shadow-lg">
          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
            onClick={() => onSelectAllSprintStatuses()}
            onKeyDown={(e) => e.key === "Enter" && onSelectAllSprintStatuses()}
          >
            <Checkbox
              checked={allStatusesSelected}
              onCheckedChange={() => onSelectAllSprintStatuses()}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs font-medium">전체 상태</span>
          </div>
          <div className="my-1 border-t border-border/50" />
          {WBS_SPRINT_STATUS_OPTIONS.map(({ kind, label }) => {
            const checked = selectedSprintStatuses.has(kind);
            const disabled =
              selectedSprintStatuses.size === 1 && selectedSprintStatuses.has(kind);
            return (
              <div
                key={kind}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5",
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/60"
                )}
                onClick={() => {
                  if (disabled) return;
                  onToggleSprintStatus(kind, !checked);
                }}
                onKeyDown={(e) => {
                  if (disabled || e.key !== "Enter") return;
                  onToggleSprintStatus(kind, !checked);
                }}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => onToggleSprintStatus(kind, v === true)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs">{label}</span>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={inProgressCount === 0}
        onClick={onToggleInProgress}
      >
        <ChevronsDownUp className="h-3.5 w-3.5" />
        {allInProgressExpanded ? "진행 중 접기" : "진행 중 펼치기"}
      </Button>

      <Popover modal={false} open={assigneePopoverOpen} onOpenChange={onAssigneePopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            {assigneeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-xl p-2 shadow-lg">
          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
            onClick={() => onSelectAllAssignees()}
            onKeyDown={(e) => e.key === "Enter" && onSelectAllAssignees()}
          >
            <Checkbox
              checked={!assigneeFilterActive}
              onCheckedChange={() => onSelectAllAssignees()}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs font-medium">전체 담당자</span>
          </div>
          <div className="my-1 border-t border-border/50" />
          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
            onClick={() =>
              onToggleAssignee(
                WBS_UNASSIGNED_SPRINT_KEY,
                !(assigneeFilterActive && (selectedAssignees?.has(WBS_UNASSIGNED_SPRINT_KEY) ?? false))
              )
            }
          >
            <Checkbox
              checked={assigneeFilterActive && (selectedAssignees?.has(WBS_UNASSIGNED_SPRINT_KEY) ?? false)}
              onCheckedChange={(v) => onToggleAssignee(WBS_UNASSIGNED_SPRINT_KEY, v === true)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs">{WBS_UNASSIGNED_SPRINT_LABEL}</span>
          </div>
          <div className="my-1 border-t border-border/50" />
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {assigneeOptions.map((name) => {
              const checked = assigneeFilterActive && (selectedAssignees?.has(name) ?? false);
              return (
                <div
                  key={name}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                  onClick={() => onToggleAssignee(name, !checked)}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggleAssignee(name, v === true)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <WbsAssigneeColorDot assignee={name} />
                  <span className="text-xs">{name}</span>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
