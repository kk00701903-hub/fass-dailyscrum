import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DatabaseZap, RefreshCw, AlertCircle, Inbox, ChevronDown, ChevronUp,
  ClipboardList, Plus, Trash2, Pencil, Check, X, ChevronRight,
} from "lucide-react";
import { fetchScrumEntriesFromDb } from "@/lib/supabase/jira-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScrumEntry } from "@/lib/index";
import { getTeamMember, TEAM_MEMBERS } from "@/lib/index";
import { cn } from "@/lib/utils";
import {
  fetchAllScrumNotes,
  createScrumNote,
  updateScrumNote,
  deleteScrumNote,
  type ScrumNote,
} from "@/lib/supabase/scrum-notes-repository";
import { fetchJiraSprintsFromDb, type JiraSprintRow } from "@/lib/jira-sprints-dashboard";

// ─── Constants ────────────────────────────────────────────────────────────────

/** 최근 7일만 조회 */
const DAY_RANGE = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cutoffDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** 긴 텍스트: 기본 2줄 표시 → 클릭 시 전체 펼치기 */
function ExpandableCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text.trim()) return <span className="text-muted-foreground">—</span>;

  const lines = text.split("\n");
  const isLong = lines.length > 2 || text.length > 80;

  if (!isLong) {
    return <span className="whitespace-pre-wrap break-words text-xs">{text}</span>;
  }

  return (
    <div className="text-xs">
      <span className={cn("whitespace-pre-wrap break-words", !expanded && "line-clamp-2")}>
        {text}
      </span>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-0.5 flex items-center gap-0.5 text-primary hover:underline"
      >
        {expanded ? (
          <><ChevronUp className="w-3 h-3" />접기</>
        ) : (
          <><ChevronDown className="w-3 h-3" />더보기</>
        )}
      </button>
    </div>
  );
}

/** selected_tasks 배지 목록 */
function TaskBadges({ tasks }: { tasks: string[] }) {
  if (tasks.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tasks.map((k) => (
        <span
          key={k}
          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 whitespace-nowrap"
        >
          {k}
        </span>
      ))}
    </div>
  );
}

// ─── 추가논의과제 패널 ──────────────────────────────────────────────────────────

const NO_SPRINT_KEY = "__no_sprint__";

function AgendaPanel() {
  const [sprints, setSprints] = useState<JiraSprintRow[]>([]);
  const [notes, setNotes] = useState<ScrumNote[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>(NO_SPRINT_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 새 메모 입력
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // 패널 접기
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const [sprintList, noteList] = await Promise.all([
        fetchJiraSprintsFromDb(),
        fetchAllScrumNotes(),
      ]);
      setSprints(sprintList);
      setNotes(noteList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 선택된 스프린트의 메모만 표시
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) =>
        selectedSprintId === NO_SPRINT_KEY
          ? !n.sprintId
          : n.sprintId === selectedSprintId
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [notes, selectedSprintId]);

  const today = new Date().toISOString().slice(0, 10);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      const note = await createScrumNote({
        sprintId: selectedSprintId === NO_SPRINT_KEY ? null : selectedSprintId,
        noteDate: today,
        title: text.split("\n")[0]?.slice(0, 80) ?? text,
        content: text,
        category: "general",
        authorId: TEAM_MEMBERS[0]?.id ?? "unknown",
      });
      setNotes((prev) => [...prev, note]);
      setNewText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleEditSave = async (id: string) => {
    const text = editText.trim();
    if (!text) return;
    try {
      const updated = await updateScrumNote(id, {
        title: text.split("\n")[0]?.slice(0, 80) ?? text,
        content: text,
      });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정 실패");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScrumNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const handleToggleResolved = async (note: ScrumNote) => {
    try {
      const updated = await updateScrumNote(note.id, { isResolved: !note.isResolved });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정 실패");
    }
  };

  const startEdit = (note: ScrumNote) => {
    setEditingId(note.id);
    setEditText(note.content);
  };

  return (
    <div className="border-t border-border mt-2">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-6 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
      >
        <ClipboardList className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 text-left">추가논의과제</span>
        {!collapsed && (
          <span className="text-xs font-normal text-muted-foreground mr-2">
            {filteredNotes.length}건
          </span>
        )}
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            !collapsed && "rotate-90"
          )}
        />
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* 스프린트 탭 */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSprintId(NO_SPRINT_KEY)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selectedSprintId === NO_SPRINT_KEY
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:bg-muted/30"
              )}
            >
              스프린트 미지정
            </button>
            {sprints.map((sp) => {
              const id = sp.id ?? sp.jira_sprint_id ?? sp.sprint_name;
              if (!id) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedSprintId(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedSprintId === id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card/50 text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {sp.sprint_name || id}
                </button>
              );
            })}
            {loading && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" /> 로드 중…
              </span>
            )}
          </div>

          {/* 메모 목록 */}
          <div className="space-y-2">
            {filteredNotes.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground py-2">
                이 스프린트에 등록된 논의과제가 없습니다.
              </p>
            )}
            {filteredNotes.map((note, idx) => (
              <div
                key={note.id}
                className={cn(
                  "group flex gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  note.isResolved
                    ? "border-border bg-muted/20 opacity-60"
                    : "border-border bg-card hover:bg-muted/20"
                )}
              >
                {/* 완료 체크 */}
                <button
                  type="button"
                  title={note.isResolved ? "완료 취소" : "완료로 표시"}
                  onClick={() => void handleToggleResolved(note)}
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    note.isResolved
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : "border-border text-transparent hover:border-emerald-400 hover:text-emerald-400"
                  )}
                >
                  <Check className="w-2.5 h-2.5" />
                </button>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  {editingId === note.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleEditSave(note.id)}
                          className="flex items-center gap-1 rounded border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 hover:bg-emerald-500/20"
                        >
                          <Check className="w-3 h-3" />저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/30"
                        >
                          <X className="w-3 h-3" />취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={cn(
                      "whitespace-pre-wrap break-words text-xs leading-relaxed",
                      note.isResolved && "line-through text-muted-foreground"
                    )}>
                      <span className="mr-2 font-medium text-muted-foreground opacity-60 select-none">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      {note.content}
                    </p>
                  )}
                </div>

                {/* 액션 버튼 (hover 시 표시) */}
                {editingId !== note.id && (
                  <div className="flex shrink-0 items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="수정"
                      onClick={() => startEdit(note)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => void handleDelete(note.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 새 항목 입력 */}
          <div className="space-y-1.5">
            <textarea
              ref={textareaRef}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="논의과제 또는 메모를 입력하세요… (Ctrl+Enter로 추가)"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={adding || !newText.trim()}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {adding ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              항목 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// 틀고정 컬럼: #(40px) · entry_date(112px) · member_id(96px) · member_name(96px)
// 이후 컬럼은 가로 스크롤
const STICKY_NUM_LEFT    = "left-0";
const STICKY_DATE_LEFT   = "left-10";         // 40px
const STICKY_MID_LEFT    = "left-[152px]";    // 40 + 112
const STICKY_NAME_LEFT   = "left-[248px]";    // 40 + 112 + 96

export default function ScrumDbLog() {
  const [allEntries, setAllEntries] = useState<ScrumEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError("Supabase가 설정되지 않았습니다. 환경 변수를 확인하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchScrumEntriesFromDb();
      setAllEntries(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // entry_date DESC 정렬 후 최근 7일 필터
  const filtered = useMemo<ScrumEntry[]>(() => {
    const cutoff = cutoffDate(DAY_RANGE);
    return [...allEntries]
      .filter((e) => e.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date) || a.memberId.localeCompare(b.memberId));
  }, [allEntries]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DatabaseZap className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">스크럼 입력 내역 (DB)</h1>
          <span className="text-xs text-muted-foreground rounded-full border border-border px-2 py-0.5">
            최근 {DAY_RANGE}일
          </span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {filtered.length}건
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-background text-muted-foreground hover:bg-muted disabled:opacity-50"
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          새로고침
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !allEntries.length && (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            불러오는 중…
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Inbox className="w-10 h-10" />
            <p className="text-sm">최근 {DAY_RANGE}일 내 입력 내역이 없습니다.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border" style={{ marginBottom: 0 }}>
            <table className="text-xs border-collapse" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {/* ── 틀고정 컬럼 ── */}
                  <th className={cn(
                    "sticky z-20 bg-muted/60 px-1.5 py-2 text-center text-muted-foreground font-normal w-10 border-r border-border",
                    STICKY_NUM_LEFT
                  )}>
                    #
                  </th>
                  <th className={cn(
                    "sticky z-20 bg-muted/60 px-3 py-2 text-left font-mono font-semibold text-foreground w-28 border-r border-border",
                    STICKY_DATE_LEFT
                  )}>
                    entry_date
                  </th>
                  <th className={cn(
                    "sticky z-20 bg-muted/60 px-3 py-2 text-left font-mono font-semibold text-foreground w-24 border-r border-border",
                    STICKY_MID_LEFT
                  )}>
                    member_id
                  </th>
                  <th className={cn(
                    "sticky z-20 bg-muted/60 px-3 py-2 text-left font-semibold text-foreground w-24 border-r border-border",
                    STICKY_NAME_LEFT
                  )}>
                    담당자
                  </th>
                  {/* ── 스크롤 컬럼 ── */}
                  <th className="px-3 py-2 text-left font-mono font-semibold text-foreground w-36 border-r border-border">sprint_id</th>
                  <th className="px-3 py-2 text-left font-mono font-semibold text-foreground w-48 border-r border-border">selected_tasks</th>
                  <th className="px-3 py-2 text-left font-mono font-semibold text-foreground w-72 border-r border-border">yesterday</th>
                  <th className="px-3 py-2 text-left font-mono font-semibold text-foreground w-72 border-r border-border">today</th>
                  <th className="px-3 py-2 text-left font-mono font-semibold text-foreground w-40">blockers</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={`${entry.date}-${entry.memberId}-${entry.sprintId}`}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors align-top"
                  >
                    {/* ── 틀고정 셀 ── */}
                    <td className={cn(
                      "sticky z-10 bg-background px-1.5 py-2 text-center text-muted-foreground border-r border-border",
                      STICKY_NUM_LEFT
                    )}>
                      {idx + 1}
                    </td>
                    <td className={cn(
                      "sticky z-10 bg-background px-3 py-2 font-mono border-r border-border whitespace-nowrap",
                      STICKY_DATE_LEFT
                    )}>
                      {entry.date}
                    </td>
                    <td className={cn(
                      "sticky z-10 bg-background px-3 py-2 font-mono border-r border-border whitespace-nowrap",
                      STICKY_MID_LEFT
                    )}>
                      {entry.memberId}
                    </td>
                    <td className={cn(
                      "sticky z-10 bg-background px-3 py-2 border-r border-border whitespace-nowrap font-medium",
                      STICKY_NAME_LEFT
                    )}>
                      {getTeamMember(entry.memberId).name}
                    </td>
                    {/* ── 스크롤 셀 ── */}
                    <td className="px-3 py-2 font-mono text-muted-foreground border-r border-border break-all">
                      {entry.sprintId || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-border">
                      <TaskBadges tasks={entry.selectedTasks} />
                    </td>
                    <td className="px-3 py-2 border-r border-border max-w-xs">
                      <ExpandableCell text={entry.yesterday} />
                    </td>
                    <td className="px-3 py-2 border-r border-border max-w-xs">
                      <ExpandableCell text={entry.today} />
                    </td>
                    <td className="px-3 py-2">
                      {entry.blockers.trim()
                        ? <span className="whitespace-pre-wrap break-words text-xs">{entry.blockers}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 추가논의과제 패널 */}
      <AgendaPanel />
    </div>
  );
}
