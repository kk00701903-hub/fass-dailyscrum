import { useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseZap, RefreshCw, AlertCircle, Inbox, ChevronDown, ChevronUp } from "lucide-react";
import { fetchScrumEntriesFromDb } from "@/lib/supabase/jira-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScrumEntry } from "@/lib/index";
import { getTeamMember } from "@/lib/index";
import { cn } from "@/lib/utils";

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
          <div className="overflow-x-auto rounded-lg border border-border">
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
    </div>
  );
}
