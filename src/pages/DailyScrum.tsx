import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Save,
  ClipboardCheck,
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Table2,
  History,
} from "lucide-react";
import {
  addCalendarDays,
  findPreviousMemberSelectedTasks,
  findPreviousScrumEntry,
  groupScrumTodayPlansByDate,
  memberHasAnyScrumEntryOnDate,
  memberHasSelectedTasksOnDate,
} from "@/lib/scrum-carryover";
import {
  excludeParentsWithListedSubtasks,
  filterTasksByStatuses,
  getMemberActiveAssignedTasks,
  getMemberAssignedTasks,
  resolveScrumEntrySprintId,
  sanitizeSelectedTaskKeys,
  SCRUM_TASK_STATUS_FILTER_DEFAULT,
  type ScrumTaskPickerItem,
} from "@/lib/scrum-backlog";
import { ScrumTaskStatusFilter } from "@/components/ScrumTaskStatusFilter";
import { ScrumPerTaskFields } from "@/components/scrum/ScrumPerTaskFields";
import { parseLegacyTaskTexts, pruneTaskTextMap } from "@/lib/scrum-task-fields";
import type { TaskStatus } from "@/lib/index";
import {
  canEditScrumTextFields,
  getScrumSaveValidationMessage,
  isScrumFormSavable,
} from "@/lib/scrum-save-validation";
import {
  findScrumEntry,
  getAllScrumHistory,
  getScrumEntriesRevision,
  saveScrumEntry,
  hydrateScrumHistoryFromSupabase,
  hydrateMemberSprintsFromSupabase,
  resolveScrumFormTaskFields,
  subscribeScrumEntries,
  SCRUM_ENTRIES_CHANGED_EVENT,
} from "@/lib/scrum-storage";
import { fetchDailyReport } from "@/lib/daily-reports-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { DAILY_SCRUM_MEMBERS, getTeamMember, ROUTES, type ScrumEntry } from "@/lib/index";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { getActiveJiraSprints } from "@/lib/jira-data-registry";
import { resolveSprintName } from "@/lib/jira-live-data";
import { Card } from "@/components/Stats";
import { saveButtonStyle, ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { ScrumTaskPicker } from "@/components/ScrumTaskPicker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SCRUM_BLOCKER_NONE_LABEL = "병목없음";

function blockerFieldMode(blockers: string): "none" | "custom" {
  const t = blockers.trim();
  if (!t || t === "없음" || t === SCRUM_BLOCKER_NONE_LABEL) return "none";
  return "custom";
}

function normalizeBlockersFromStorage(blockers: string): string {
  const t = blockers.trim();
  if (!t || t === "없음") return SCRUM_BLOCKER_NONE_LABEL;
  return blockers;
}
import {
  getTeamActiveSprintId,
  getMemberSprintFocus,
  getInProgressSprints,
  SCRUM_SPRINT_PREFS_EVENT,
} from "@/lib/scrum-sprint-preferences";

interface ScrumForm {
  yesterdayByTask: Record<string, string>;
  todayByTask: Record<string, string>;
  blockers: string;
  selectedTasks: string[];
  isCompleted: boolean;
}

const defaultForm: ScrumForm = {
  yesterdayByTask: {},
  todayByTask: {},
  blockers: SCRUM_BLOCKER_NONE_LABEL,
  selectedTasks: [],
  isCompleted: false,
};

function formKey(memberId: string, sprintId: string): string {
  return `${memberId}::${sprintId}`;
}

function entryToForm(e: ScrumEntry, isCompleted = false): ScrumForm {
  const keys = [...e.selectedTasks];
  return {
    yesterdayByTask: parseLegacyTaskTexts(e.yesterday, keys),
    todayByTask: parseLegacyTaskTexts(e.today, keys),
    blockers: normalizeBlockersFromStorage(e.blockers),
    selectedTasks: keys,
    isCompleted,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildFormFromHistory(dateStr: string, memberId: string, sprintId: string): ScrumForm {
  const e = findScrumEntry(dateStr, memberId, sprintId);
  return e ? entryToForm(e) : { ...defaultForm };
}

function buildAllForms(dateStr: string): Record<string, ScrumForm> {
  const teamId = getTeamActiveSprintId();
  const inProgressIds = getInProgressSprints().map((s) => s.id);
  const next: Record<string, ScrumForm> = {};
  for (const m of DAILY_SCRUM_MEMBERS) {
    const sprintIds = new Set(inProgressIds);
    if (teamId) sprintIds.add(teamId);
    const focus = getMemberSprintFocus(m.id);
    if (focus) sprintIds.add(focus);
    for (const sid of sprintIds) {
      next[formKey(m.id, sid)] = buildFormFromHistory(dateStr, m.id, sid);
    }
  }
  return next;
}

function memberFormHasContent(forms: Record<string, ScrumForm>, memberId: string): boolean {
  return Object.keys(forms).some((key) => {
    if (!key.startsWith(`${memberId}::`)) return false;
    const f = forms[key];
    if (!f) return false;
    const hasYesterday = Object.values(f.yesterdayByTask).some((v) => v.trim());
    const hasToday = Object.values(f.todayByTask).some((v) => v.trim());
    return hasYesterday || hasToday;
  });
}

function collectMergedSelectedTasks(
  prev: Record<string, ScrumForm>,
  memberId: string,
  panelSprintIds: string[],
  teamSprintId: string,
  allowedKeys: Set<string>
): string[] {
  const merged = new Set<string>();
  for (const sid of panelSprintIds) {
    for (const key of prev[formKey(memberId, sid)]?.selectedTasks ?? []) {
      if (allowedKeys.has(key)) merged.add(key);
    }
  }
  if (teamSprintId) {
    for (const key of prev[formKey(memberId, teamSprintId)]?.selectedTasks ?? []) {
      if (allowedKeys.has(key)) merged.add(key);
    }
  }
  return [...merged];
}

/** 멤버의 스프린트별 폼에 동일한 담당 이슈 선택을 반영 (해제 시 재병합 방지) */
function syncMemberSelectedTasksAcrossSprints(
  prev: Record<string, ScrumForm>,
  memberId: string,
  sprintIds: Iterable<string>,
  selectedTasks: string[],
  dateStr: string
): Record<string, ScrumForm> {
  const next = { ...prev };
  const keys = [...selectedTasks];
  for (const sid of sprintIds) {
    if (!sid) continue;
    const k = formKey(memberId, sid);
    const cur = next[k] ?? buildFormFromHistory(dateStr, memberId, sid);
    next[k] = {
      ...cur,
      selectedTasks: keys,
      yesterdayByTask: pruneTaskTextMap(cur.yesterdayByTask, keys),
      todayByTask: pruneTaskTextMap(cur.todayByTask, keys),
    };
  }
  return next;
}

function memberSprintIdsForTaskSync(
  prev: Record<string, ScrumForm>,
  memberId: string,
  panelSprintIds: string[],
  teamSprintId: string,
  canonicalSprintId: string
): string[] {
  const ids = new Set(panelSprintIds);
  if (teamSprintId) ids.add(teamSprintId);
  if (canonicalSprintId) ids.add(canonicalSprintId);
  for (const key of Object.keys(prev)) {
    if (!key.startsWith(`${memberId}::`)) continue;
    const sid = key.slice(memberId.length + 2);
    if (sid) ids.add(sid);
  }
  return [...ids];
}

function applyMemberTaskSelection(
  prev: Record<string, ScrumForm>,
  memberId: string,
  sprintIds: string[],
  selectedTasks: string[],
  dateStr: string,
  assignedTasks: ReturnType<typeof getMemberAssignedTasks>
): Record<string, ScrumForm> {
  const clean = sanitizeSelectedTaskKeys(selectedTasks, assignedTasks);
  return syncMemberSelectedTasksAcrossSprints(prev, memberId, sprintIds, clean, dateStr);
}

const scrumFieldDisabledClass =
  "cursor-not-allowed opacity-50 bg-muted/30 pointer-events-none";

function blockerTextForInput(blockers: string): string {
  if (blockers === SCRUM_BLOCKER_NONE_LABEL || blockers === "없음") return "";
  return blockers;
}

function ScrumBlockerField({
  mode,
  onModeChange,
  value,
  onChange,
  action,
  disabled = false,
}: {
  mode: "none" | "custom";
  onModeChange: (mode: "none" | "custom") => void;
  value: string;
  onChange: (v: string) => void;
  action?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1",
        disabled && "opacity-60"
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-1.5">
        <label className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <span>🚧</span>
          병목
        </label>
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </div>
      <RadioGroup
        value={mode}
        onValueChange={(m) => onModeChange(m as "none" | "custom")}
        className="flex shrink-0 flex-wrap items-center gap-4"
        disabled={disabled}
      >
        <label
          className={cn(
            "flex items-center gap-2 text-xs text-foreground",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          <RadioGroupItem
            value="none"
            id="scrum-blocker-none"
            className="h-3.5 w-3.5"
            disabled={disabled}
          />
          {SCRUM_BLOCKER_NONE_LABEL}
        </label>
        <label
          className={cn(
            "flex items-center gap-2 text-xs text-foreground",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          <RadioGroupItem
            value="custom"
            id="scrum-blocker-custom"
            className="h-3.5 w-3.5"
            disabled={disabled}
          />
          직접 입력
        </label>
      </RadioGroup>
      {mode === "custom" && (
        <textarea
          value={blockerTextForInput(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            disabled ? "좌측에서 담당 이슈를 먼저 선택하세요" : "병목 내용을 입력하세요"
          }
          className={cn(
            ui.textarea,
            "min-h-[2.25rem] flex-1 resize-none font-sans text-xs leading-snug",
            "border-red-200/80 bg-red-50/30 focus:ring-red-300/30",
            disabled && scrumFieldDisabledClass
          )}
        />
      )}
    </div>
  );
}

function defaultActiveMemberId(): string {
  const authMemberId = useAuthStore.getState().user?.memberId;
  if (authMemberId && DAILY_SCRUM_MEMBERS.some((m) => m.id === authMemberId)) {
    return authMemberId;
  }
  return DAILY_SCRUM_MEMBERS[0]!.id;
}

export default function DailyScrum() {
  const [prefsTick, setPrefsTick] = useState(0);
  const [scrumDate, setScrumDate] = useState(() => todayIso());
  const [activeMember, setActiveMember] = useState(defaultActiveMemberId);
  const [forms, setForms] = useState<Record<string, ScrumForm>>(() => buildAllForms(todayIso()));
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [yesterdayCarryoverHint, setYesterdayCarryoverHint] = useState<string | null>(null);
  const [planCarryoverHint, setPlanCarryoverHint] = useState<string | null>(null);
  const [blockersCarryoverHint, setBlockersCarryoverHint] = useState<string | null>(null);
  const [blockerUiMode, setBlockerUiMode] = useState<"none" | "custom">("none");
  const [highlightTaskSelection, setHighlightTaskSelection] = useState(false);
  const [todoHintOpen, setTodoHintOpen] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatus>(
    SCRUM_TASK_STATUS_FILTER_DEFAULT
  );
  const [todoHintTaskKey, setTodoHintTaskKey] = useState<string | null>(null);
  /** 단일 이슈 자동 선택 — 사용자가 해제한 뒤 prefsTick 등으로 effect가 다시 돌 때 재선택 방지 */
  const skipAutoSelectKeyRef = useRef<string | null>(null);

  useEffect(() => {
    skipAutoSelectKeyRef.current = null;
  }, [activeMember, scrumDate, taskStatusFilter]);

  useEffect(() => {
    const onPrefs = () => {
      setPrefsTick((t) => t + 1);
    };
    window.addEventListener(SCRUM_SPRINT_PREFS_EVENT, onPrefs);
    window.addEventListener(SCRUM_ENTRIES_CHANGED_EVENT, onPrefs);
    return () => {
      window.removeEventListener(SCRUM_SPRINT_PREFS_EVENT, onPrefs);
      window.removeEventListener(SCRUM_ENTRIES_CHANGED_EVENT, onPrefs);
    };
  }, []);

  useEffect(() => {
    setForms(buildAllForms(scrumDate));
  }, [scrumDate]);

  const hydrateFromSupabase = useJiraSyncStore((s) => s.hydrateFromSupabase);
  const lastJiraDataAt = useJiraSyncStore((s) => s.lastSyncAt);
  const scrumHistoryRevision = useSyncExternalStore(
    subscribeScrumEntries,
    getScrumEntriesRevision,
    () => 0
  );

  const pastTodayPlansByDate = useMemo(
    () => groupScrumTodayPlansByDate(getAllScrumHistory(), activeMember, scrumDate),
    [activeMember, scrumHistoryRevision, scrumDate]
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void Promise.all([hydrateScrumHistoryFromSupabase(), hydrateMemberSprintsFromSupabase()]).then(
      () => setForms(buildAllForms(scrumDate))
    );
    void hydrateFromSupabase();
  }, [hydrateFromSupabase, scrumDate]);

  /** 전일 담당 이슈 체크 → 익일(오늘·이후) 미저장 시 자동 반영·저장 (과거 일자·전체 해제 저장일 제외) */
  useEffect(() => {
    if (scrumDate < todayIso()) return;


    const history = getAllScrumHistory();
    const teamId = getTeamActiveSprintId();
    const inProgress = getInProgressSprints();
    const persistJobs: { memberId: string; sprintId: string; form: ScrumForm }[] = [];

    setForms((prev) => {
      let next = prev;
      let changed = false;

      for (const m of DAILY_SCRUM_MEMBERS) {
        if (memberHasSelectedTasksOnDate(history, m.id, scrumDate)) continue;
        if (memberHasAnyScrumEntryOnDate(history, m.id, scrumDate)) continue;

        const backlog = getMemberActiveAssignedTasks(m.id);
        const prevTasks = sanitizeSelectedTaskKeys(
          findPreviousMemberSelectedTasks(history, m.id, scrumDate),
          backlog
        );
        if (prevTasks.length === 0) continue;

        const panelIds = new Set<string>();
        for (const t of backlog) {
          if (t.sprintId) panelIds.add(t.sprintId);
        }
        if (teamId) panelIds.add(teamId);
        const focus = getMemberSprintFocus(m.id);
        if (focus) panelIds.add(focus);
        for (const s of inProgress) panelIds.add(s.id);

        const canonical = resolveScrumEntrySprintId(prevTasks, backlog, teamId);
        const syncIds = memberSprintIdsForTaskSync(
          next,
          m.id,
          [...panelIds],
          teamId,
          canonical
        );
        next = applyMemberTaskSelection(
          next,
          m.id,
          syncIds,
          prevTasks,
          scrumDate,
          backlog
        );
        changed = true;

        const saveSprintId =
          canonical ||
          (backlog.length > 0 ? teamId : getMemberSprintFocus(m.id)) ||
          "";
        if (!saveSprintId) continue;

        const fkSave = formKey(m.id, canonical || saveSprintId);
        persistJobs.push({
          memberId: m.id,
          sprintId: saveSprintId,
          form: next[fkSave] ?? buildFormFromHistory(scrumDate, m.id, saveSprintId),
        });
      }

      return changed ? next : prev;
    });

    for (const job of persistJobs) {
      const existing = findScrumEntry(scrumDate, job.memberId, job.sprintId);
      void saveScrumEntry({
        id: existing?.id,
        date: scrumDate,
        memberId: job.memberId,
        sprintId: job.sprintId,
        yesterdayByTask: job.form.yesterdayByTask,
        todayByTask: job.form.todayByTask,
        blockers: job.form.blockers.trim() || SCRUM_BLOCKER_NONE_LABEL,
        selectedTasks: job.form.selectedTasks,
        isCompleted: job.form.isCompleted,
      }).catch((e) => {
        console.warn("[DailyScrum] task carryover save failed", e);
      });
    }
  }, [scrumDate, scrumHistoryRevision, prefsTick, lastJiraDataAt]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void fetchDailyReport(activeMember, scrumDate)
      .then((row) => {
        if (!row) return;
        setForms((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (!key.startsWith(`${activeMember}::`)) continue;
            const cur = next[key]!;
            next[key] = {
              ...cur,
              isCompleted: row.is_completed,
              blockers: cur.blockers || row.bottleneck,
            };
          }
          return next;
        });
      })
      .catch(() => {
        /* Supabase 미연동 또는 스키마 미적용 */
      });
  }, [activeMember, scrumDate]);

  const teamSprintId = useMemo(() => getTeamActiveSprintId(), [prefsTick]);
  const inProgressSprints = useMemo(() => getInProgressSprints(), [prefsTick, lastJiraDataAt]);

  const assignedTasks = useMemo(
    () => getMemberAssignedTasks(activeMember),
    [activeMember, lastJiraDataAt]
  );

  const visibleTasks = useMemo(
    () =>
      excludeParentsWithListedSubtasks(
        filterTasksByStatuses(assignedTasks, [taskStatusFilter])
      ),
    [assignedTasks, taskStatusFilter]
  );

  const panelSprintIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of assignedTasks) {
      if (t.sprintId) ids.add(t.sprintId);
    }
    const teamId = getTeamActiveSprintId();
    if (teamId) ids.add(teamId);
    const focus = getMemberSprintFocus(activeMember);
    if (focus) ids.add(focus);
    for (const s of inProgressSprints) ids.add(s.id);
    return [...ids];
  }, [assignedTasks, activeMember, inProgressSprints, prefsTick, lastJiraDataAt]);

  const panelSprints = useMemo(() => {
    const byId = new Map(getActiveJiraSprints().map((s) => [s.id, s]));
    return panelSprintIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [panelSprintIds, prefsTick, lastJiraDataAt]);

  const allowedTaskKeys = useMemo(
    () => new Set(assignedTasks.map((t) => t.key)),
    [assignedTasks]
  );

  const mergedSelectedTasks = useMemo(() => {
    const raw = collectMergedSelectedTasks(
      forms,
      activeMember,
      panelSprintIds,
      teamSprintId,
      allowedTaskKeys
    );
    return sanitizeSelectedTaskKeys(raw, assignedTasks);
  }, [forms, activeMember, panelSprintIds, teamSprintId, allowedTaskKeys, assignedTasks]);

  const canonicalSprintId = useMemo(
    () => resolveScrumEntrySprintId(mergedSelectedTasks, assignedTasks, teamSprintId),
    [mergedSelectedTasks, assignedTasks, teamSprintId]
  );

  const saveSprintId =
    canonicalSprintId ||
    (assignedTasks.length > 0 ? teamSprintId : getMemberSprintFocus(activeMember));

  const fk = formKey(activeMember, canonicalSprintId);
  const currentForm = forms[fk] ?? buildFormFromHistory(scrumDate, activeMember, canonicalSprintId);

  useEffect(() => {
    setBlockerUiMode(blockerFieldMode(currentForm.blockers));
  }, [activeMember, scrumDate, canonicalSprintId]);

  const sprintLabel = canonicalSprintId
    ? resolveSprintName(canonicalSprintId)
    : "담당 스프린트 없음";
  const hasSelectableTasks = visibleTasks.some((t) => t.status !== "TODO");

  const canEditScrumText = canEditScrumTextFields({
    hasSelectableTasks,
    selectedTaskCount: mergedSelectedTasks.length,
  });

  const pickerTasks: ScrumTaskPickerItem[] = useMemo(() => {
    const sprintNameById = new Map(panelSprints.map((s) => [s.id, s.name]));
    return visibleTasks.map((task) => ({
      task,
      sprintName: sprintNameById.get(task.sprintId) ?? resolveSprintName(task.sprintId),
    }));
  }, [visibleTasks, panelSprints]);

  const tasksByKey = useMemo(
    () => new Map(assignedTasks.map((t) => [t.key, t])),
    [assignedTasks]
  );

  const orderedSelectedKeys = useMemo(
    () =>
      [...mergedSelectedTasks].sort((a, b) => {
        const ta = tasksByKey.get(a);
        const tb = tasksByKey.get(b);
        if (!ta || !tb) return a.localeCompare(b);
        return a.localeCompare(b);
      }),
    [mergedSelectedTasks, tasksByKey]
  );

  useEffect(() => {
    if (!canonicalSprintId || !activeMember) return;
    const entry = findScrumEntry(scrumDate, activeMember, canonicalSprintId);
    const keys =
      (entry?.selectedTasks.length ?? 0) > 0
        ? [...(entry?.selectedTasks ?? [])]
        : mergedSelectedTasks;
    void resolveScrumFormTaskFields(
      scrumDate,
      activeMember,
      canonicalSprintId,
      keys,
      entry?.yesterday ?? "",
      entry?.today ?? ""
    ).then((fields) => {
      setForms((prev) => {
        const k = formKey(activeMember, canonicalSprintId);
        const cur = prev[k] ?? buildFormFromHistory(scrumDate, activeMember, canonicalSprintId);
        const selected = cur.selectedTasks.length > 0 ? cur.selectedTasks : keys;
        return {
          ...prev,
          [k]: {
            ...cur,
            yesterdayByTask: pruneTaskTextMap(fields.yesterdayByTask, selected),
            todayByTask: pruneTaskTextMap(fields.todayByTask, selected),
          },
        };
      });
    });
  }, [activeMember, scrumDate, canonicalSprintId, scrumHistoryRevision]);

  const taskPickerEmptyMessage =
    assignedTasks.length === 0
      ? "JIRA 동기화·배정을 확인하세요"
      : "선택한 상태의 담당 이슈가 없습니다. 상태 필터를 조정하세요.";

  /** 분산된 selectedTasks를 멤버 스프린트 폼 전체에 동기화 */
  useEffect(() => {
    setForms((prev) => {
      const nextKeys = collectMergedSelectedTasks(
        prev,
        activeMember,
        panelSprintIds,
        teamSprintId,
        allowedTaskKeys
      );
      const canonical = resolveScrumEntrySprintId(nextKeys, assignedTasks, teamSprintId);
      const k = formKey(activeMember, canonical);
      const cur = prev[k] ?? buildFormFromHistory(scrumDate, activeMember, canonical);
      const same =
        nextKeys.length === cur.selectedTasks.length &&
        nextKeys.every((key, i) => cur.selectedTasks[i] === key);
      if (same) return prev;
      const sanitized = sanitizeSelectedTaskKeys(nextKeys, assignedTasks);
      return applyMemberTaskSelection(
        prev,
        activeMember,
        memberSprintIdsForTaskSync(prev, activeMember, panelSprintIds, teamSprintId, canonical),
        sanitized,
        scrumDate,
        assignedTasks
      );
    });
  }, [activeMember, panelSprintIds, assignedTasks, teamSprintId, scrumDate, allowedTaskKeys, lastJiraDataAt]);

  /** 담당 이슈가 1개뿐이면 자동 선택 (할 일 제외) — 사용자 해제 후에는 재선택 안 함 */
  useEffect(() => {
    if (visibleTasks.length !== 1) return;
    const only = visibleTasks[0]!;
    if (only.status === "TODO") return;
    const taskKey = only.key;
    const autoKey = `${activeMember}::${scrumDate}::${taskKey}`;
    if (skipAutoSelectKeyRef.current === autoKey) return;

    setForms((prev) => {
      const nextKeys = sanitizeSelectedTaskKeys(
        collectMergedSelectedTasks(
          prev,
          activeMember,
          panelSprintIds,
          teamSprintId,
          allowedTaskKeys
        ),
        assignedTasks
      );
      if (nextKeys.length > 0) return prev;

      const history = getAllScrumHistory();
      const hasEmptySavedSelection = history.some(
        (e) =>
          e.memberId === activeMember &&
          e.date === scrumDate &&
          e.selectedTasks.length === 0
      );
      if (hasEmptySavedSelection) return prev;

      const canonical = resolveScrumEntrySprintId([taskKey], assignedTasks, teamSprintId);
      return applyMemberTaskSelection(
        prev,
        activeMember,
        memberSprintIdsForTaskSync(prev, activeMember, panelSprintIds, teamSprintId, canonical),
        [taskKey],
        scrumDate,
        assignedTasks
      );
    });
  }, [visibleTasks, assignedTasks, activeMember, panelSprintIds, teamSprintId, scrumDate, allowedTaskKeys]);

  const patchForm = (patch: Partial<ScrumForm>) => {
    setSaveError(null);
    setForms((prev) => ({
      ...prev,
      [fk]: { ...(prev[fk] ?? currentForm), ...patch },
    }));
  };

  const updateTaskYesterday = (issueKey: string, value: string) => {
    if (!canEditScrumText) return;
    patchForm({
      yesterdayByTask: {
        ...currentForm.yesterdayByTask,
        [issueKey]: value,
      },
    });
  };

  const updateTaskToday = (issueKey: string, value: string) => {
    if (!canEditScrumText) return;
    patchForm({
      todayByTask: {
        ...currentForm.todayByTask,
        [issueKey]: value,
      },
    });
  };

  const updateBlockers = (value: string) => {
    if (!canEditScrumText) return;
    patchForm({ blockers: value });
  };

  const handleSave = () => {
    const form = forms[fk] ?? currentForm;
    const requireTaskSelection = hasSelectableTasks;
    const validationMsg = getScrumSaveValidationMessage(form, { requireTaskSelection });
    if (!isScrumFormSavable(form, { requireTaskSelection })) {
      setSaveError(validationMsg ?? "입력 내용을 확인한 뒤 저장할 수 있습니다.");
      setHighlightTaskSelection(requireTaskSelection && form.selectedTasks.length === 0);
      return;
    }
    setHighlightTaskSelection(false);
    if (!saveSprintId) {
      setSaveError("담당 스프린트·이슈가 없어 저장할 수 없습니다. JIRA 배정·스프린트 등록을 확인하세요.");
      return;
    }
    const existing = findScrumEntry(scrumDate, activeMember, saveSprintId);
    const jiraIssueIdByKey: Record<string, string> = {};
    for (const key of form.selectedTasks) {
      const t = tasksByKey.get(key);
      if (t?.id) jiraIssueIdByKey[key] = t.id;
    }
    void saveScrumEntry({
      id: existing?.id,
      date: scrumDate,
      memberId: activeMember,
      sprintId: saveSprintId,
      yesterdayByTask: form.yesterdayByTask,
      todayByTask: form.todayByTask,
      jiraIssueIdByKey,
      blockers: form.blockers.trim() || SCRUM_BLOCKER_NONE_LABEL,
      selectedTasks: form.selectedTasks,
      isCompleted: form.isCompleted,
    }).then(() => {
      setSaveError(null);
      setSaved((prev) => ({ ...prev, [activeMember]: true }));
      const memberName = getTeamMember(activeMember).name;
      toast({
        title: "저장되었습니다",
        description: `${memberName} · ${scrumDate} · ${sprintLabel}`,
        duration: 5000,
      });
      setTimeout(() => setSaved((prev) => ({ ...prev, [activeMember]: false })), 4000);
    }).catch((e) => {
      setSaveError(e instanceof Error ? e.message : String(e));
    });
  };

  const noPrevHint = `${addCalendarDays(scrumDate, -1)} · ${sprintLabel} 기록 없음`;

  const handleLoadPreviousToYesterday = () => {
    if (!canEditScrumText) return;
    const prev = findPreviousScrumEntry(getAllScrumHistory(), activeMember, canonicalSprintId, scrumDate);
    if (!prev) {
      setYesterdayCarryoverHint(noPrevHint);
      return;
    }
    void resolveScrumFormTaskFields(
      prev.date,
      activeMember,
      canonicalSprintId,
      prev.selectedTasks.length > 0 ? prev.selectedTasks : orderedSelectedKeys,
      prev.yesterday,
      prev.today
    ).then((fields) => {
      const keys = orderedSelectedKeys;
      const nextYesterday: Record<string, string> = { ...currentForm.yesterdayByTask };
      for (const key of keys) {
        const v = (fields.todayByTask[key] ?? "").trim();
        if (v) nextYesterday[key] = v;
      }
      if (!Object.values(nextYesterday).some((v) => v.trim())) {
        setYesterdayCarryoverHint(noPrevHint);
        return;
      }
      patchForm({ yesterdayByTask: pruneTaskTextMap(nextYesterday, keys) });
      setYesterdayCarryoverHint(`${prev.date} 오늘 계획 → 전일 성과 반영`);
    });
  };

  const handleLoadPreviousPlan = () => {
    if (!canEditScrumText) return;
    const prev = findPreviousScrumEntry(getAllScrumHistory(), activeMember, canonicalSprintId, scrumDate);
    if (!prev) {
      setPlanCarryoverHint(noPrevHint);
      return;
    }
    void resolveScrumFormTaskFields(
      prev.date,
      activeMember,
      canonicalSprintId,
      prev.selectedTasks.length > 0 ? prev.selectedTasks : orderedSelectedKeys,
      prev.yesterday,
      prev.today
    ).then((fields) => {
      const keys = orderedSelectedKeys;
      const nextToday = pruneTaskTextMap(
        { ...currentForm.todayByTask, ...fields.todayByTask },
        keys
      );
      if (!Object.values(nextToday).some((v) => v.trim())) {
        setPlanCarryoverHint(noPrevHint);
        return;
      }
      patchForm({ todayByTask: nextToday });
      setPlanCarryoverHint(`${prev.date} 오늘 계획 반영`);
    });
  };

  const handleLoadPreviousBlockers = () => {
    if (!canEditScrumText) return;
    const prev = findPreviousScrumEntry(getAllScrumHistory(), activeMember, canonicalSprintId, scrumDate);
    if (!prev) {
      setBlockersCarryoverHint(noPrevHint);
      return;
    }
    const blockers = normalizeBlockersFromStorage(prev.blockers);
    setForms((f) => ({
      ...f,
      [fk]: {
        ...(f[fk] ?? currentForm),
        blockers,
      },
    }));
    setBlockerUiMode(blockerFieldMode(blockers));
    setBlockersCarryoverHint(`${prev.date} 병목 반영`);
  };

  const handleBlockerModeChange = (mode: "none" | "custom") => {
    if (!canEditScrumText) return;
    setBlockerUiMode(mode);
    if (mode === "none") {
      updateBlockers(SCRUM_BLOCKER_NONE_LABEL);
    } else if (
      currentForm.blockers === SCRUM_BLOCKER_NONE_LABEL ||
      currentForm.blockers === "없음"
    ) {
      updateBlockers("");
    }
  };

  const loadPrevBtnClass = (enabled: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary transition-all duration-300 ease-in-out",
      enabled &&
        "hover:scale-[1.02] hover:bg-primary/15 active:scale-[0.98]",
      !enabled && "cursor-not-allowed opacity-50"
    );

  const loadYesterdayPrevBtn = (
    <button
      type="button"
      disabled={!canEditScrumText}
      onClick={handleLoadPreviousToYesterday}
      className={loadPrevBtnClass(canEditScrumText)}
    >
      <History className="w-3 h-3" />
      전일 불러오기
    </button>
  );

  const loadPlanPrevBtn = (
    <button
      type="button"
      disabled={!canEditScrumText}
      onClick={handleLoadPreviousPlan}
      className={loadPrevBtnClass(canEditScrumText)}
    >
      <History className="w-3 h-3" />
      전일 불러오기
    </button>
  );

  const loadBlockersPrevBtn = (
    <button
      type="button"
      disabled={!canEditScrumText}
      onClick={handleLoadPreviousBlockers}
      className={loadPrevBtnClass(canEditScrumText)}
    >
      <History className="w-3 h-3" />
      전일 불러오기
    </button>
  );

  const persistTaskSelection = (form: ScrumForm, sprintId: string) => {
    const existing = findScrumEntry(scrumDate, activeMember, sprintId);
    const jiraIssueIdByKey: Record<string, string> = {};
    for (const key of form.selectedTasks) {
      const t = tasksByKey.get(key);
      if (t?.id) jiraIssueIdByKey[key] = t.id;
    }
    void saveScrumEntry({
      id: existing?.id,
      date: scrumDate,
      memberId: activeMember,
      sprintId,
      yesterdayByTask: form.yesterdayByTask,
      todayByTask: form.todayByTask,
      jiraIssueIdByKey,
      blockers: form.blockers.trim() || SCRUM_BLOCKER_NONE_LABEL,
      selectedTasks: form.selectedTasks,
      isCompleted: form.isCompleted,
    }).catch((e) => {
      setSaveError(e instanceof Error ? e.message : String(e));
    });
  };

  const handleToggleBacklogTask = (taskKey: string) => {
    setSaveError(null);
    setHighlightTaskSelection(false);

    const task = assignedTasks.find((t) => t.key === taskKey);
    const isSelecting = !mergedSelectedTasks.includes(taskKey);
    if (task?.status === "TODO" && isSelecting) {
      setTodoHintTaskKey(taskKey);
      setTodoHintOpen(true);
      return;
    }

    setForms((prev) => {
      const merged = new Set(
        sanitizeSelectedTaskKeys(
          collectMergedSelectedTasks(
            prev,
            activeMember,
            panelSprintIds,
            teamSprintId,
            allowedTaskKeys
          ),
          assignedTasks
        )
      );
      const wasSelected = merged.has(taskKey);
      if (wasSelected) merged.delete(taskKey);
      else merged.add(taskKey);
      const nextKeys = sanitizeSelectedTaskKeys([...merged], assignedTasks);

      if (
        wasSelected &&
        nextKeys.length === 0 &&
        visibleTasks.length === 1 &&
        visibleTasks[0]?.key === taskKey
      ) {
        skipAutoSelectKeyRef.current = `${activeMember}::${scrumDate}::${taskKey}`;
      }

      // #region agent log
      fetch("http://127.0.0.1:7436/ingest/f57db699-ba2a-4440-aed0-464c4fb46b81", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "bf5f5d",
        },
        body: JSON.stringify({
          sessionId: "bf5f5d",
          runId: "post-fix",
          hypothesisId: "H4",
          location: "DailyScrum.tsx:handleToggleBacklogTask",
          message: "toggle task selection",
          data: {
            memberId: activeMember,
            taskKey,
            wasSelected,
            nextKeys,
            skipAuto: skipAutoSelectKeyRef.current,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const canonical = resolveScrumEntrySprintId(nextKeys, assignedTasks, teamSprintId);
      const next = applyMemberTaskSelection(
        prev,
        activeMember,
        memberSprintIdsForTaskSync(prev, activeMember, panelSprintIds, teamSprintId, canonical),
        nextKeys,
        scrumDate,
        assignedTasks
      );
      const persistSprintId =
        canonical || (assignedTasks.length > 0 ? teamSprintId : getMemberSprintFocus(activeMember));
      if (persistSprintId) {
        const k = formKey(activeMember, persistSprintId);
        const form = next[k] ?? buildFormFromHistory(scrumDate, activeMember, persistSprintId);
        persistTaskSelection(form, persistSprintId);
      }
      return next;
    });
  };

  const handleClearAllSelectedTasks = () => {
    setSaveError(null);
    setHighlightTaskSelection(false);
    if (visibleTasks.length === 1 && visibleTasks[0]?.status !== "TODO") {
      skipAutoSelectKeyRef.current = `${activeMember}::${scrumDate}::${visibleTasks[0]!.key}`;
    }
    setForms((prev) => {
      const canonical = resolveScrumEntrySprintId([], assignedTasks, teamSprintId);
      const next = applyMemberTaskSelection(
        prev,
        activeMember,
        memberSprintIdsForTaskSync(prev, activeMember, panelSprintIds, teamSprintId, canonical),
        [],
        scrumDate,
        assignedTasks
      );
      const persistSprintId =
        canonical || (assignedTasks.length > 0 ? teamSprintId : getMemberSprintFocus(activeMember));
      if (persistSprintId) {
        const k = formKey(activeMember, persistSprintId);
        const form = next[k] ?? buildFormFromHistory(scrumDate, activeMember, persistSprintId);
        persistTaskSelection(form, persistSprintId);
      }
      return next;
    });
  };

  const isToday = scrumDate === todayIso();

  const clearCarryoverHints = () => {
    setYesterdayCarryoverHint(null);
    setPlanCarryoverHint(null);
    setBlockersCarryoverHint(null);
    setSaveError(null);
  };

  const shiftScrumDate = (deltaDays: number) => {
    setScrumDate(addCalendarDays(scrumDate, deltaDays));
    clearCarryoverHints();
  };

  return (
    <div className="flex h-[calc(100dvh-5.25rem)] max-h-[calc(100dvh-5.25rem)] min-h-[28rem] flex-col gap-2 overflow-hidden text-xs">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {DAILY_SCRUM_MEMBERS.map((m) => {
          const on = activeMember === m.id;
          const has = memberFormHasContent(forms, m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActiveMember(m.id);
                setYesterdayCarryoverHint(null);
                setPlanCarryoverHint(null);
                setBlockersCarryoverHint(null);
                setSaveError(null);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-300 ease-in-out hover:scale-[1.01] active:scale-[0.98]",
                on ? "shadow-sm" : "border-border/60 bg-card/80 text-muted-foreground hover:bg-muted/50"
              )}
              style={
                on
                  ? { background: `${m.color}14`, borderColor: `${m.color}44`, color: m.color }
                  : undefined
              }
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.avatar}
              </span>
              {m.name}
              {has && <span className="h-1 w-1 rounded-full bg-green-400" />}
            </button>
          );
        })}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => shiftScrumDate(-1)}
            className={cn(ui.btnSecondary, "h-8 w-8 shrink-0 px-0")}
            title="전일"
            aria-label="전일"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <input
            id="scrum-date"
            type="date"
            value={scrumDate}
            onChange={(e) => {
              setScrumDate(e.target.value);
              clearCarryoverHints();
            }}
            className={cn(ui.input, "h-8 w-[9.5rem] shrink-0 px-2 text-xs tabular-nums")}
          />
          <button
            type="button"
            onClick={() => shiftScrumDate(1)}
            className={cn(ui.btnSecondary, "h-8 w-8 shrink-0 px-0")}
            title="익일"
            aria-label="익일"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => {
                setScrumDate(todayIso());
                clearCarryoverHints();
              }}
              className={cn(ui.btnSecondary, "h-8 px-2 text-[10px] font-medium")}
            >
              오늘
            </button>
          )}
          <Link
            to={ROUTES.SCRUM_HISTORY}
            className={cn(ui.btnSecondary, "h-8 gap-1 px-2.5 text-xs")}
          >
            <Table2 className="w-3 h-3" />
            일지
          </Link>
          <button
            type="button"
            onClick={handleSave}
            aria-live="polite"
            className={cn(
              ui.btnPrimary,
              "h-9 min-w-[5.5rem] gap-1.5 px-3.5 text-sm font-semibold transition-all",
              saved[activeMember] && "ring-2 ring-emerald-300/80 ring-offset-2 ring-offset-background"
            )}
            style={saveButtonStyle()}
          >
            {saved[activeMember] ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                저장됨
              </>
            ) : (
              <>
                <Save className="h-4 w-4 shrink-0" />
                저장
              </>
            )}
          </button>
          {saveError ? (
            <p className="w-full basis-full text-right text-xs font-medium leading-snug text-red-600 sm:w-auto sm:basis-auto">
              {saveError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[17.2rem_1fr_17.2rem]">
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden p-3 transition-shadow",
            highlightTaskSelection && "ring-2 ring-amber-400/80"
          )}
        >
          <div className="mb-1.5 shrink-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">담당 이슈</p>
                <p className="text-xs text-muted-foreground">
                  {assignedTasks.length === 0
                    ? "JIRA 동기화·배정을 확인하세요"
                    : `${mergedSelectedTasks.length}건 선택 · ${visibleTasks.length}건 표시`}
                </p>
              </div>
              {mergedSelectedTasks.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAllSelectedTasks}
                  className="shrink-0 rounded-md border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  전체 해제
                </button>
              ) : null}
            </div>
            <ScrumTaskStatusFilter
              className="mt-2"
              value={taskStatusFilter}
              onChange={setTaskStatusFilter}
            />
          </div>
          <ScrumTaskPicker
            tasks={pickerTasks}
            selectedKeys={mergedSelectedTasks}
            onToggleTask={handleToggleBacklogTask}
            emptyMessage={taskPickerEmptyMessage}
          />
        </Card>

        <div className="grid min-h-0 grid-rows-3 gap-2">
          <Card className="flex min-h-0 flex-col overflow-hidden p-2.5">
            <ScrumPerTaskFields
              icon="📋"
              title="전일 성과"
              hint={
                mergedSelectedTasks.length > 0
                  ? `선택 ${mergedSelectedTasks.length}건 · 이슈별 입력`
                  : hasSelectableTasks
                    ? "좌측 이슈를 먼저 선택하세요"
                    : "좌측 이슈 클릭으로 선택"
              }
              taskKeys={orderedSelectedKeys}
              tasksByKey={tasksByKey}
              values={currentForm.yesterdayByTask}
              onChange={updateTaskYesterday}
              action={loadYesterdayPrevBtn}
              disabled={!canEditScrumText}
            />
            {yesterdayCarryoverHint && (
              <p
                className={cn(
                  "mt-1 shrink-0 px-1 text-[10px]",
                  yesterdayCarryoverHint.includes("없음") ? "text-amber-600" : "text-emerald-600"
                )}
              >
                {yesterdayCarryoverHint}
              </p>
            )}
          </Card>
          <Card className="flex min-h-0 flex-col overflow-hidden p-2.5">
            <ScrumPerTaskFields
              icon="🎯"
              title="오늘 계획"
              hint={
                canEditScrumText
                  ? `${sprintLabel} · 이슈별 입력`
                  : hasSelectableTasks
                    ? "좌측 이슈를 먼저 선택하세요"
                    : sprintLabel
              }
              taskKeys={orderedSelectedKeys}
              tasksByKey={tasksByKey}
              values={currentForm.todayByTask}
              onChange={updateTaskToday}
              action={loadPlanPrevBtn}
              disabled={!canEditScrumText}
            />
            {planCarryoverHint && (
              <p
                className={cn(
                  "mt-1 shrink-0 px-1 text-[10px]",
                  planCarryoverHint.includes("없음") ? "text-amber-600" : "text-emerald-600"
                )}
              >
                {planCarryoverHint}
              </p>
            )}
          </Card>
          <Card className="flex min-h-0 flex-col overflow-hidden p-2.5">
            <ScrumBlockerField
              mode={blockerUiMode}
              onModeChange={handleBlockerModeChange}
              value={currentForm.blockers}
              onChange={updateBlockers}
              action={loadBlockersPrevBtn}
              disabled={!canEditScrumText}
            />
            {blockersCarryoverHint && (
              <p
                className={cn(
                  "mt-1 shrink-0 px-1 text-[10px]",
                  blockersCarryoverHint.includes("없음") ? "text-amber-600" : "text-emerald-600"
                )}
              >
                {blockersCarryoverHint}
              </p>
            )}
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col overflow-hidden p-3">
          <div className="mb-1.5 shrink-0">
            <p className="text-sm font-semibold text-foreground">과거 기록</p>
            <p className="text-xs text-muted-foreground">
              선택 일자 기준 D-7 ~ D-1 · 오늘 계획만
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
            {pastTodayPlansByDate.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                저장된 오늘 계획이 없습니다.
              </p>
            ) : (
              pastTodayPlansByDate.map((day) => (
                <div
                  key={day.date}
                  className="rounded-lg border border-border/50 bg-muted/20 p-2.5"
                >
                  <p className="mb-1 text-xs font-semibold text-primary">{day.dateLabel}</p>
                  <div className="space-y-2">
                    {day.plans.map((plan) => {
                      const spName = resolveSprintName(plan.sprintId);
                      const showSprint = day.plans.length > 1;
                      return (
                        <div key={plan.id}>
                          {showSprint ? (
                            <p className="mb-0.5 truncate text-[11px] text-muted-foreground" title={spName}>
                              {spName}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap text-xs leading-snug text-foreground">
                            {plan.today}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {saved[activeMember] && (
          <motion.div
            role="status"
            aria-live="polite"
            aria-label="데일리 스크럼 저장 완료"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="pointer-events-none fixed inset-x-0 bottom-8 z-[100] flex justify-center px-4"
          >
            <div className="flex max-w-md items-center gap-4 rounded-2xl border-2 border-emerald-400/50 bg-emerald-600 px-6 py-4 text-white shadow-2xl shadow-emerald-900/25">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                <ClipboardCheck className="h-7 w-7" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-lg font-bold tracking-tight">저장되었습니다</p>
                <p className="mt-0.5 text-sm font-medium text-emerald-50/95">
                  {getTeamMember(activeMember).name} · {scrumDate}
                  {sprintLabel !== "담당 스프린트 없음" ? ` · ${sprintLabel}` : ""}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={todoHintOpen} onOpenChange={setTodoHintOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>할 일 상태 이슈</AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-relaxed">
              {todoHintTaskKey ? (
                <span className="font-mono text-foreground">{todoHintTaskKey}</span>
              ) : null}
              {todoHintTaskKey ? " 은(는) " : ""}
              JIRA에서 <strong>진행 중</strong>으로 변경한 뒤 <strong>JIRA 동기화</strong>를 실행하면 데일리
              스크럼 담당 이슈에 반영되어 선택·등록할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTodoHintOpen(false)}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
