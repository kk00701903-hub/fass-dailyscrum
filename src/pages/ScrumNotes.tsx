import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NotebookPen,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ui, cardSurfaceStyle, surfaceBorderStyle, primaryGradientStyle } from "@/lib/design-system";
import { useAuthStore } from "@/store/authStore";
import {
  type ScrumNote,
  type NoteCategory,
  type CreateScrumNoteInput,
  fetchRecentScrumNotes,
  createScrumNote,
  updateScrumNote,
  deleteScrumNote,
} from "@/lib/supabase/scrum-notes-repository";
import { getActiveJiraSprintOrEmpty } from "@/lib/jira-data-registry";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  NoteCategory,
  { label: string; color: string; bg: string; border: string }
> = {
  general:     { label: "일반",     color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)" },
  decision:    { label: "결정사항", color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)"  },
  action_item: { label: "액션아이템", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
  blocker:     { label: "블로커",   color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
  share:       { label: "공유사항", color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  },
};

const CATEGORY_ORDER: NoteCategory[] = ["decision", "action_item", "blocker", "share", "general"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]})`;
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ─── NoteCard ──────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onToggleResolved,
  onDelete,
}: {
  note: ScrumNote;
  onEdit: (note: ScrumNote) => void;
  onToggleResolved: (note: ScrumNote) => void;
  onDelete: (id: string) => void;
}) {
  const meta = CATEGORY_META[note.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: note.isResolved ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn("group relative rounded-xl p-3.5 transition-shadow hover:shadow-md", note.isResolved && "grayscale-[30%]")}
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
    >
      {/* Category badge + actions */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: meta.color, background: `${meta.color}20`, border: `1px solid ${meta.border}` }}
        >
          {meta.label}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onToggleResolved(note)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            title={note.isResolved ? "미완료로 변경" : "완료 처리"}
          >
            {note.isResolved ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            title="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-red-400"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      {note.title && (
        <p
          className={cn("mb-1 text-xs font-semibold leading-snug text-foreground", note.isResolved && "line-through opacity-70")}
        >
          {note.title}
        </p>
      )}

      {/* Content */}
      {note.content && (
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {note.content}
        </p>
      )}

      {/* Author + resolved indicator */}
      <div className="mt-2 flex items-center gap-2">
        {note.authorId && (
          <span className="text-[10px] text-muted-foreground/70">by {note.authorId}</span>
        )}
        {note.isResolved && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />완료
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── NoteFormModal ─────────────────────────────────────────────────────────────

function NoteFormModal({
  initial,
  noteDate,
  sprintId,
  authorId,
  onSave,
  onClose,
}: {
  initial?: ScrumNote | null;
  noteDate: string;
  sprintId: string | null;
  authorId: string;
  onSave: (note: ScrumNote) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState<NoteCategory>(initial?.category ?? "general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleSave() {
    if (!content.trim() && !title.trim()) {
      setError("제목 또는 내용을 입력하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        const updated = await updateScrumNote(initial.id, { title, content, category });
        onSave(updated);
      } else {
        const input: CreateScrumNoteInput = {
          sprintId,
          noteDate,
          title,
          content,
          category,
          authorId,
        };
        const created = await createScrumNote(input);
        onSave(created);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleSave();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-2xl p-5"
        style={cardSurfaceStyle()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {initial ? "메모 수정" : "새 메모"}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category pills */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_META) as NoteCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                style={
                  active
                    ? { background: meta.bg, color: meta.color, border: `1.5px solid ${meta.color}` }
                    : { background: "transparent", color: "var(--muted-foreground)", border: `1.5px solid ${surfaceBorderStyle()}` }
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          className={cn(ui.input, "mb-2")}
        />

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요… (Ctrl+Enter 저장)"
          rows={4}
          className={cn(ui.textarea, "mb-3")}
        />

        {error && (
          <p className="mb-2 text-[11px] text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ui.btnSecondary}>
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className={cn(ui.btnPrimary, "gap-1.5 disabled:opacity-60")}
            style={primaryGradientStyle()}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ScrumNotes() {
  const authUser = useAuthStore((s) => s.user);
  const authorId = authUser?.loginId ?? authUser?.name ?? "익명";

  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [notes, setNotes] = useState<ScrumNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ScrumNote | null>(null);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeSprint = getActiveJiraSprintOrEmpty();
  const sprintId = activeSprint?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecentScrumNotes(30);
      setNotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Notes for selected date, optionally filtered by category
  const visibleNotes = useMemo(() => {
    const forDate = notes.filter((n) => n.noteDate === selectedDate);
    if (filterCategory === "all") return forDate;
    return forDate.filter((n) => n.category === filterCategory);
  }, [notes, selectedDate, filterCategory]);

  // Grouped by category for display
  const grouped = useMemo(() => {
    const map = new Map<NoteCategory, ScrumNote[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = visibleNotes.filter((n) => n.category === cat);
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [visibleNotes]);

  // All dates that have notes (for navigation dot indicator)
  const datesWithNotes = useMemo(() => new Set(notes.map((n) => n.noteDate)), [notes]);

  function handleSaved(note: ScrumNote) {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = note;
        return next;
      }
      return [...prev, note];
    });
    setShowForm(false);
    setEditTarget(null);
    // Switch to the note's date
    setSelectedDate(note.noteDate);
  }

  async function handleToggleResolved(note: ScrumNote) {
    try {
      const updated = await updateScrumNote(note.id, { isResolved: !note.isResolved });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch {
      /* silent */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("메모를 삭제할까요?")) return;
    setDeletingId(id);
    try {
      await deleteScrumNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const borderSubtle = surfaceBorderStyle();
  const totalForDate = notes.filter((n) => n.noteDate === selectedDate).length;

  return (
    <div className={cn(ui.page, "flex h-full flex-col gap-4")}>
      {/* Page Header */}
      <div className={ui.pageHeader}>
        <div className="flex items-center gap-2.5">
          <div className={cn(ui.iconBox, ui.iconCyan)}>
            <NotebookPen className="h-4 w-4" />
          </div>
          <div>
            <h2 className={ui.title}>스크럼 메모</h2>
            <p className={ui.subtitle}>데일리 스크럼 소주제·결정사항·액션아이템 기록</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className={cn(ui.btnPrimary, "gap-1.5")}
          style={primaryGradientStyle()}
        >
          <Plus className="h-3.5 w-3.5" />
          새 메모
        </button>
      </div>

      {/* Date Navigator */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5"
        style={cardSurfaceStyle()}
      >
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-semibold text-foreground">{formatDate(selectedDate)}</span>
          <div className="flex items-center gap-1.5">
            {datesWithNotes.has(selectedDate) && (
              <span className="text-[10px] text-primary">{totalForDate}건</span>
            )}
            {activeSprint && (
              <span className="text-[10px] text-muted-foreground">{activeSprint.name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {selectedDate !== todayIso() && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso())}
              className="mr-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors"
              style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}
            >
              오늘
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={selectedDate >= todayIso()}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
          style={
            filterCategory === "all"
              ? { background: "rgba(34,211,238,0.15)", color: "var(--primary)", border: "1.5px solid rgba(34,211,238,0.4)" }
              : { background: "transparent", color: "var(--muted-foreground)", border: `1.5px solid ${borderSubtle}` }
          }
        >
          전체
        </button>
        {(Object.keys(CATEGORY_META) as NoteCategory[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const active = filterCategory === cat;
          const count = notes.filter((n) => n.noteDate === selectedDate && n.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(active ? "all" : cat)}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
              style={
                active
                  ? { background: meta.bg, color: meta.color, border: `1.5px solid ${meta.color}` }
                  : { background: "transparent", color: "var(--muted-foreground)", border: `1.5px solid ${borderSubtle}` }
              }
            >
              {meta.label}{count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>

      {/* Notes Area */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
          불러오는 중…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-400">
          오류: {error}
        </div>
      ) : visibleNotes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-16 text-center"
        >
          <NotebookPen className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {filterCategory === "all" ? "이날 메모가 없습니다" : `${CATEGORY_META[filterCategory].label} 메모가 없습니다`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">
              오늘 스크럼 소주제를 기록해 보세요
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className={cn(ui.btnPrimary, "mt-1 gap-1.5")}
            style={primaryGradientStyle()}
          >
            <Plus className="h-3.5 w-3.5" />
            첫 메모 추가
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-6">
          {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = grouped.get(cat)!;
            return (
              <section key={cat}>
                <div
                  className="mb-2.5 flex items-center gap-2"
                  style={{ borderBottom: `1px solid ${borderSubtle}`, paddingBottom: "6px" }}
                >
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{items.length}건</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence>
                    {items.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={(n) => { setEditTarget(n); setShowForm(true); }}
                        onToggleResolved={(n) => void handleToggleResolved(n)}
                        onDelete={(id) => { if (deletingId !== id) void handleDelete(id); }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <NoteFormModal
            initial={editTarget}
            noteDate={selectedDate}
            sprintId={sprintId && sprintId !== "" ? sprintId : null}
            authorId={authorId}
            onSave={handleSaved}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
