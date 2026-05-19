import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Save, ClipboardCheck, CalendarDays, Table2, Pin, History, Plus, Layers } from "lucide-react";
import { addCalendarDays, buildCarryoverFromPrevious, findPreviousScrumEntry } from "@/lib/scrum-carryover";
import { getMemberBacklog } from "@/lib/scrum-backlog";
import {
  findScrumEntry,
  getAllScrumHistory,
  saveScrumEntry,
  registerMemberSprint,
  hydrateScrumHistoryFromSupabase,
} from "@/lib/scrum-storage";
import { fetchDailyReport } from "@/lib/daily-reports-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { TEAM_MEMBERS, ROUTES, type ScrumEntry } from "@/lib/index";
import { getActiveJiraSprints } from "@/lib/jira-data-registry";
import { resolveSprintName } from "@/lib/jira-live-data";
import { Card } from "@/components/Stats";
import { ScrumBacklogPicker } from "@/components/ScrumBacklogPicker";
import {
  getTeamActiveSprintId,
  setTeamActiveSprintId,
  getMemberSprintFocus,
  setMemberSprintFocus,
  getSprintsForMember,
  getSprintsAvailableToRegister,
  getInProgressSprints,
  SCRUM_SPRINT_PREFS_EVENT,
} from "@/lib/scrum-sprint-preferences";

interface ScrumForm {
  yesterday: string;
  today: string;
  blockers: string;
  selectedTasks: string[];
  isCompleted: boolean;
}

const defaultForm: ScrumForm = {
  yesterday: "",
  today: "",
  blockers: "",
  selectedTasks: [],
  isCompleted: false,
};

function formKey(memberId: string, sprintId: string): string {
  return `${memberId}::${sprintId}`;
}

function entryToForm(e: ScrumEntry, isCompleted = false): ScrumForm {
  return {
    yesterday: e.yesterday,
    today: e.today,
    blockers: e.blockers,
    selectedTasks: [...e.selectedTasks],
    isCompleted,
  };
}

const fieldBox: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "var(--foreground)",
  lineHeight: 1.45,
};

function defaultDateString(): string {
  const dates = getAllScrumHistory().map((e) => e.date);
  if (dates.length === 0) return new Date().toISOString().slice(0, 10);
  return [...dates].sort((a, b) => b.localeCompare(a))[0]!;
}

function buildFormFromHistory(dateStr: string, memberId: string, sprintId: string): ScrumForm {
  const e = findScrumEntry(dateStr, memberId, sprintId);
  return e ? entryToForm(e) : { ...defaultForm };
}

function buildAllForms(dateStr: string): Record<string, ScrumForm> {
  const next: Record<string, ScrumForm> = {};
  for (const m of TEAM_MEMBERS) {
    const sprintIds = new Set(getSprintsForMember(m.id).map((s) => s.id));
    sprintIds.add(getMemberSprintFocus(m.id));
    for (const sid of sprintIds) {
      next[formKey(m.id, sid)] = buildFormFromHistory(dateStr, m.id, sid);
    }
  }
  return next;
}

function isScrumFormSavable(form: ScrumForm): boolean {
  return (
    form.yesterday.trim().length > 0 &&
    form.today.trim().length > 0 &&
    form.selectedTasks.length > 0
  );
}

function ScrumField({
  icon,
  title,
  hint,
  value,
  onChange,
  accent,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  accent?: "danger";
  action?: React.ReactNode;
}) {
  const borderFocus = accent === "danger" ? "rgba(248,113,113,0.4)" : "rgba(34,211,238,0.4)";
  const borderDefault = accent === "danger" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.08)";
  const bg = accent === "danger" ? "rgba(248,113,113,0.04)" : fieldBox.background;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-1">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <label className="flex items-center gap-1.5 min-w-0 text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
          <span>{icon}</span>
          {title}
          {hint && (
            <span className="font-normal truncate" style={{ color: "var(--muted-foreground)" }}>
              {hint}
            </span>
          )}
        </label>
        {action && <div className="flex items-center gap-1 shrink-0">{action}</div>}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full flex-1 min-h-[3.25rem] resize-none rounded-md px-2 py-1.5 text-xs outline-none"
        style={{ ...fieldBox, background: bg, border: `1px solid ${borderDefault}` }}
        onFocus={(e) => (e.target.style.borderColor = borderFocus)}
        onBlur={(e) => (e.target.style.borderColor = borderDefault)}
      />
    </div>
  );
}

export default function DailyScrum() {
  const [prefsTick, setPrefsTick] = useState(0);
  const [scrumDate, setScrumDate] = useState(defaultDateString);
  const [activeMember, setActiveMember] = useState(TEAM_MEMBERS[0].id);
  const [forms, setForms] = useState<Record<string, ScrumForm>>(() => buildAllForms(defaultDateString()));
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planCarryoverHint, setPlanCarryoverHint] = useState<string | null>(null);
  const [blockersCarryoverHint, setBlockersCarryoverHint] = useState<string | null>(null);

  useEffect(() => {
    const onPrefs = () => setPrefsTick((t) => t + 1);
    window.addEventListener(SCRUM_SPRINT_PREFS_EVENT, onPrefs);
    window.addEventListener("scrum-entries-changed", onPrefs);
    return () => {
      window.removeEventListener(SCRUM_SPRINT_PREFS_EVENT, onPrefs);
      window.removeEventListener("scrum-entries-changed", onPrefs);
    };
  }, []);

  useEffect(() => {
    setForms(buildAllForms(scrumDate));
  }, [scrumDate, prefsTick]);

  const hydrateFromSupabase = useJiraSyncStore((s) => s.hydrateFromSupabase);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void hydrateScrumHistoryFromSupabase().then(() => setForms(buildAllForms(scrumDate)));
    void hydrateFromSupabase();
  }, [hydrateFromSupabase, scrumDate]);

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
              yesterday: cur.yesterday || row.yesterday_achievement,
              today: cur.today || row.today_plan,
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
  const inProgressSprints = useMemo(() => getInProgressSprints(), []);

  const memberSprints = useMemo(() => {
    const from = getSprintsForMember(activeMember);
    if (from.length > 0) return from;
    const tid = getTeamActiveSprintId();
    const t = getActiveJiraSprints().find((s) => s.id === tid);
    return t ? [t] : [];
  }, [activeMember, prefsTick]);
  const memberSprintId = useMemo(() => getMemberSprintFocus(activeMember), [activeMember, prefsTick]);
  const sprintsToRegister = useMemo(
    () => getSprintsAvailableToRegister(activeMember),
    [activeMember, prefsTick]
  );
  const memberBacklog = useMemo(
    () => getMemberBacklog(activeMember, memberSprintId),
    [activeMember, memberSprintId, prefsTick]
  );

  const currentMember = TEAM_MEMBERS.find((m) => m.id === activeMember)!;
  const fk = formKey(activeMember, memberSprintId);
  const currentForm = forms[fk] ?? buildFormFromHistory(scrumDate, activeMember, memberSprintId);
  const sprintLabel = resolveSprintName(memberSprintId);

  const patchForm = (patch: Partial<ScrumForm>) => {
    setSaveError(null);
    setForms((prev) => ({
      ...prev,
      [fk]: { ...(prev[fk] ?? currentForm), ...patch },
    }));
  };

  const updateForm = (field: "yesterday" | "today" | "blockers", value: string) => {
    patchForm({ [field]: value });
  };

  const handleSave = () => {
    const form = forms[fk] ?? currentForm;
    if (!isScrumFormSavable(form)) {
      setSaveError("백로그 선택, 전일 성과, 오늘 계획을 모두 입력한 뒤 저장할 수 있습니다.");
      return;
    }
    const existing = findScrumEntry(scrumDate, activeMember, memberSprintId);
    void saveScrumEntry({
      id: existing?.id,
      date: scrumDate,
      memberId: activeMember,
      sprintId: memberSprintId,
      yesterday: form.yesterday.trim(),
      today: form.today.trim(),
      blockers: form.blockers.trim() || "없음",
      selectedTasks: form.selectedTasks,
      isCompleted: form.isCompleted,
    }).then(() => {
      setSaveError(null);
      setSaved((prev) => ({ ...prev, [activeMember]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [activeMember]: false })), 2500);
    }).catch((e) => {
      setSaveError(e instanceof Error ? e.message : String(e));
    });
  };

  const applyMemberSprintFilter = (sprintId: string) => {
    setMemberSprintFocus(activeMember, sprintId);
    const k = formKey(activeMember, sprintId);
    setForms((prev) => ({
      ...prev,
      [k]: prev[k] ?? buildFormFromHistory(scrumDate, activeMember, sprintId),
    }));
  };

  const handleRegisterSprint = (sprintId: string) => {
    if (!sprintId) return;
    registerMemberSprint(activeMember, sprintId);
    applyMemberSprintFilter(sprintId);
  };

  const noPrevHint = `${addCalendarDays(scrumDate, -1)} · ${sprintLabel} 기록 없음`;

  const handleLoadPreviousPlan = () => {
    const prev = findPreviousScrumEntry(getAllScrumHistory(), activeMember, memberSprintId, scrumDate);
    if (!prev) {
      setPlanCarryoverHint(noPrevHint);
      return;
    }
    const carried = buildCarryoverFromPrevious(prev, { fillYesterdayFromPrevPlan: true });
    setForms((f) => ({
      ...f,
      [fk]: {
        ...(f[fk] ?? currentForm),
        yesterday: carried.yesterday,
        today: carried.today,
        selectedTasks: prev.selectedTasks,
      },
    }));
    setPlanCarryoverHint(`${prev.date} 계획 → 전일 성과·오늘 계획 반영`);
  };

  const handleLoadPreviousBlockers = () => {
    const prev = findPreviousScrumEntry(getAllScrumHistory(), activeMember, memberSprintId, scrumDate);
    if (!prev) {
      setBlockersCarryoverHint(noPrevHint);
      return;
    }
    setForms((f) => ({
      ...f,
      [fk]: { ...(f[fk] ?? currentForm), blockers: prev.blockers },
    }));
    setBlockersCarryoverHint(`${prev.date} 병목 반영`);
  };

  const loadPrevBtnStyle = {
    background: "rgba(34,211,238,0.1)",
    border: "1px solid rgba(34,211,238,0.25)",
    color: "var(--primary)",
  } as const;

  const loadPlanPrevBtn = (
    <button
      type="button"
      onClick={handleLoadPreviousPlan}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0"
      style={loadPrevBtnStyle}
    >
      <History className="w-3 h-3" />
      전일 불러오기
    </button>
  );

  const loadBlockersPrevBtn = (
    <button
      type="button"
      onClick={handleLoadPreviousBlockers}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0"
      style={loadPrevBtnStyle}
    >
      <History className="w-3 h-3" />
      전일 불러오기
    </button>
  );

  const filledCount = TEAM_MEMBERS.filter((m) => {
    const sid = getMemberSprintFocus(m.id);
    const f = forms[formKey(m.id, sid)];
    return !!(f?.yesterday || f?.today);
  }).length;

  return (
    <div className="flex flex-col h-[calc(100dvh-6.75rem)] max-h-[calc(100dvh-6.75rem)] min-h-[32rem] gap-2 text-[13px] overflow-hidden">
      {/* 툴바: 일자 선택 + 저장 */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 shrink-0">
        <p className="text-[11px] tabular-nums pt-1" style={{ color: "var(--muted-foreground)" }}>
          {filledCount}/{TEAM_MEMBERS.length}명 · {scrumDate}
        </p>
        <div className="flex flex-col items-end gap-1 ml-auto min-w-0">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <input
              id="scrum-date"
              type="date"
              value={scrumDate}
              onChange={(e) => {
                setScrumDate(e.target.value);
                setPlanCarryoverHint(null);
                setBlockersCarryoverHint(null);
                setSaveError(null);
              }}
              className="h-7 rounded-md px-1.5 text-[11px] outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            />
            <Link
              to={ROUTES.SCRUM_HISTORY}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            >
              <Table2 className="w-3 h-3" />
              일지
            </Link>
          </div>
          <motion.div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-1.5 text-[10px] cursor-pointer select-none">
              <Checkbox
                checked={currentForm.isCompleted}
                onCheckedChange={(v) => {
                  const completed = v === true;
                  setForms((prev) => {
                    const next = { ...prev };
                    for (const key of Object.keys(next)) {
                      if (!key.startsWith(`${activeMember}::`)) continue;
                      next[key] = { ...next[key]!, isCompleted: completed };
                    }
                    return next;
                  });
                }}
              />
              <span style={{ color: "var(--muted-foreground)" }}>일일 업무 완료</span>
            </label>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold min-w-[7.5rem]"
              style={{
                background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, black))",
                color: "var(--primary-foreground)",
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {currentMember.name} 저장
            </button>
          </motion.div>
          {isSupabaseConfigured() && (
            <p className="text-[9px] text-right" style={{ color: "var(--muted-foreground)" }}>
              저장 시 Supabase daily_reports · scrum_entries 반영
            </p>
          )}
          {saveError && (
            <p className="text-[10px] text-right max-w-[16rem] leading-tight" style={{ color: "#fca5a5" }}>
              {saveError}
            </p>
          )}
        </div>
      </div>

      {/* 담당자 선택 */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {TEAM_MEMBERS.map((m) => {
          const on = activeMember === m.id;
          const sid = getMemberSprintFocus(m.id);
          const f = forms[formKey(m.id, sid)];
          const has = !!(f?.yesterday || f?.today);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActiveMember(m.id);
                setPlanCarryoverHint(null);
                setBlockersCarryoverHint(null);
                setSaveError(null);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors"
              style={{
                background: on ? `${m.color}18` : "rgba(255,255,255,0.03)",
                borderColor: on ? `${m.color}55` : "rgba(255,255,255,0.08)",
                color: on ? m.color : "var(--muted-foreground)",
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.avatar}
              </span>
              {m.name}
              {has && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
            </button>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center gap-2 shrink-0 py-1.5 px-2 rounded-md border"
        style={{ borderColor: "rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.04)" }}
      >
        <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: "#c4b5fd" }} />
        <span className="text-[10px] font-medium shrink-0" style={{ color: "#c4b5fd" }}>
          {currentMember.name} 스프린트
        </span>
        {memberSprints.map((s) => {
          const on = s.id === memberSprintId;
          const stateLabel = s.state === "active" ? "진행" : s.state === "future" ? "예정" : "종료";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => applyMemberSprintFilter(s.id)}
              className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
              style={{
                background: on ? "rgba(167,139,250,0.18)" : "transparent",
                borderColor: on ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.1)",
                color: on ? "#e9d5ff" : "var(--muted-foreground)",
              }}
            >
              {s.name}
              <span className="opacity-60 ml-0.5">({stateLabel})</span>
            </button>
          );
        })}
        {sprintsToRegister.length > 0 && (
          <label className="inline-flex items-center gap-1 text-[10px] ml-auto">
            <Plus className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            <select
              className="h-6 rounded px-1 outline-none max-w-[9rem]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--foreground)",
              }}
              defaultValue=""
              onChange={(e) => {
                handleRegisterSprint(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                스프린트 등록
              </option>
              {sprintsToRegister.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[9.5rem_1fr_10.5rem] gap-2 flex-1 min-h-0">
        <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
          <p className="text-[11px] font-semibold shrink-0 mb-0.5" style={{ color: "var(--foreground)" }}>
            백로그
          </p>
          <p className="text-[9px] shrink-0 mb-1" style={{ color: "var(--muted-foreground)" }}>
            {sprintLabel} · {currentForm.selectedTasks.length}건 선택
          </p>
          <ScrumBacklogPicker
            tasks={memberBacklog}
            selectedKeys={currentForm.selectedTasks}
            onChange={(keys) => patchForm({ selectedTasks: keys })}
          />
        </Card>

        <div className="grid grid-rows-3 gap-2 min-h-0">
          <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
            <ScrumField
              icon="📋"
              title="전일 성과"
              hint={currentForm.selectedTasks.length > 0 ? `선택 ${currentForm.selectedTasks.length}건` : "백로그 선택"}
              value={currentForm.yesterday}
              onChange={(v) => updateForm("yesterday", v)}
            />
          </Card>
          <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
            <ScrumField
              icon="🎯"
              title="오늘 계획"
              hint={sprintLabel}
              value={currentForm.today}
              onChange={(v) => updateForm("today", v)}
              action={loadPlanPrevBtn}
            />
            {planCarryoverHint && (
              <p
                className="text-[9px] mt-0.5 px-1 shrink-0"
                style={{
                  color: planCarryoverHint.includes("없음") ? "#fbbf24" : "#34d399",
                }}
              >
                {planCarryoverHint}
              </p>
            )}
          </Card>
          <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
            <ScrumField
              icon="🚧"
              title="병목"
              hint="없으면 '없음'"
              value={currentForm.blockers}
              onChange={(v) => updateForm("blockers", v)}
              accent="danger"
              action={loadBlockersPrevBtn}
            />
            {blockersCarryoverHint && (
              <p
                className="text-[9px] mt-0.5 px-1 shrink-0"
                style={{
                  color: blockersCarryoverHint.includes("없음") ? "#fbbf24" : "#34d399",
                }}
              >
                {blockersCarryoverHint}
              </p>
            )}
          </Card>
        </div>

        <Card className="p-2 flex flex-col min-h-0 overflow-hidden">
          <p className="text-[11px] font-semibold shrink-0 mb-1" style={{ color: "var(--foreground)" }}>
            과거 기록
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
            {getAllScrumHistory()
              .filter((s) => s.memberId === activeMember)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8)
              .map((entry) => {
                const spName = resolveSprintName(entry.sprintId);
                return (
                  <div
                    key={entry.id}
                    className="rounded p-1.5"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex justify-between gap-1 text-[9px] mb-0.5">
                      <span style={{ color: "var(--primary)" }}>{entry.date}</span>
                      <span className="truncate opacity-70" style={{ color: "var(--muted-foreground)" }}>
                        {spName}
                      </span>
                    </div>
                    <p className="text-[10px] line-clamp-2 leading-tight" style={{ color: "var(--muted-foreground)" }}>
                      {entry.today}
                    </p>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      {/* 팀 기본 스프린트 — 하단 한 줄 */}
      <div
        className="flex flex-wrap items-center gap-2 shrink-0 py-1.5 px-2 rounded-md border"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <Pin className="w-3 h-3 shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          팀 기본 스프린트 (대시보드)
        </span>
        {inProgressSprints.map((s) => {
          const on = s.id === teamSprintId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTeamActiveSprintId(s.id)}
              className="text-[10px] px-2 py-0.5 rounded-full border"
              style={{
                background: on ? "rgba(34,211,238,0.12)" : "transparent",
                borderColor: on ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.08)",
                color: on ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {saved[activeMember] && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs shadow-lg z-50"
            style={{ background: "#1e293b", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}
          >
            <ClipboardCheck className="w-4 h-4" />
            {currentMember.name} 저장 완료
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
