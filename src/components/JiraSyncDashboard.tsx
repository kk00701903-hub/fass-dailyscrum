/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Loader2, RefreshCw } from "lucide-react";
import {
  fetchJiraSprintsFromDb,
  invokeJiraSprintSync,
  subscribeJiraSprints,
  type JiraSprintRow,
} from "@/lib/jira-sprints-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import {
  JIRA_SYNC_SCHEDULE_HOUR,
  JIRA_SYNC_TIMEZONE,
} from "@/lib/jira-sync-schedule";
import { sprintStatusBadge, ui } from "@/lib/untitled-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusKind = "active" | "closed" | "future" | "other";

export type SprintGridRow = {
  id: string;
  sprint_name: string;
  status: string;
  statusLabel: string;
  statusKind: StatusKind;
  remaining_days: number;
  interface_time: string;
};

interface InterfaceHeaderState {
  lastInterfaceAt: string | null;
  success: boolean | null;
  error: string | null;
}

function formatKstDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: JIRA_SYNC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace("T", " ");
}

function normalizeStatus(status: string): { label: string; kind: StatusKind } {
  const s = status.trim().toLowerCase();
  if (s.includes("진행") || s === "active") return { label: "ACTIVE", kind: "active" };
  if (s.includes("종료") || s === "closed") return { label: "CLOSED", kind: "closed" };
  if (s.includes("예정") || s === "future") return { label: "FUTURE", kind: "future" };
  return { label: status.trim() || "—", kind: "other" };
}

function toGridRows(rows: JiraSprintRow[]): SprintGridRow[] {
  return rows.map((row) => {
    const { label, kind } = normalizeStatus(row.status);
    return {
      id: row.id ?? row.sprint_name,
      sprint_name: row.sprint_name || "—",
      status: row.status,
      statusLabel: label,
      statusKind: kind,
      remaining_days: row.remaining_days,
      interface_time: row.updated_at ? formatKstDateTime(row.updated_at) : "—",
    };
  });
}

function latestRowUpdatedAt(rows: JiraSprintRow[]): string | null {
  const sorted = rows
    .map((r) => r.updated_at)
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => b.localeCompare(a));
  return sorted[0] ?? null;
}

function StatusBadge({ label, kind }: { label: string; kind: StatusKind }) {
  return (
    <span className={cn(sprintStatusBadge[kind] ?? sprintStatusBadge.other)}>{label}</span>
  );
}

const columns: ColumnDef<SprintGridRow>[] = [
  {
    accessorKey: "sprint_name",
    header: "스프린트명",
    cell: ({ getValue }) => (
      <span className="text-sm font-medium text-slate-900">{String(getValue())}</span>
    ),
  },
  {
    id: "status",
    accessorKey: "statusLabel",
    header: "상태",
    cell: ({ row }) => (
      <StatusBadge label={row.original.statusLabel} kind={row.original.statusKind} />
    ),
  },
  {
    accessorKey: "remaining_days",
    header: () => <span className="block w-full text-right">남은 일수</span>,
    cell: ({ getValue }) => (
      <span className="block text-right tabular-nums text-sm text-slate-900">
        {getValue() as number}
        <span className="ml-0.5 text-xs text-slate-500">일</span>
      </span>
    ),
  },
  {
    accessorKey: "interface_time",
    header: "인터페이스 시간",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs tabular-nums text-slate-500">{String(getValue())}</span>
    ),
  },
];

export function JiraSyncDashboard() {
  const hydrateFromSupabase = useJiraSyncStore((s) => s.hydrateFromSupabase);
  const [rows, setRows] = useState<JiraSprintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [header, setHeader] = useState<InterfaceHeaderState>({
    lastInterfaceAt: null,
    success: null,
    error: null,
  });

  const configured = isSupabaseConfigured();
  const busy = loading || refreshing;

  const gridData = useMemo(() => toGridRows(rows), [rows]);

  const table = useReactTable({
    data: gridData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const loadFromDb = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      setRows([]);
      setHeader({ lastInterfaceAt: null, success: null, error: "Supabase 미설정" });
      return;
    }

    try {
      const data = await fetchJiraSprintsFromDb();
      setRows(data);
      const latest = latestRowUpdatedAt(data);
      setHeader({
        lastInterfaceAt: latest ? formatKstDateTime(latest) : formatKstDateTime(new Date()),
        success: true,
        error: null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setHeader((prev) => ({
        ...prev,
        success: false,
        error: message,
      }));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void loadFromDb().catch(() => undefined);
    if (!configured) return;
    return subscribeJiraSprints(() => {
      void loadFromDb().catch(() => undefined);
    });
  }, [configured, loadFromDb]);

  const handleManualSync = async () => {
    if (!configured || busy) return;
    setRefreshing(true);
    setHeader((prev) => ({ ...prev, error: null }));
    try {
      const syncResult = await invokeJiraSprintSync();
      if (!syncResult.ok) {
        setHeader((prev) => ({
          ...prev,
          success: false,
          error: syncResult.error ?? "JIRA 동기화에 실패했습니다.",
        }));
        return;
      }

      const data = await fetchJiraSprintsFromDb();
      setRows(data);
      const latest = latestRowUpdatedAt(data);
      setHeader({
        lastInterfaceAt: latest ? formatKstDateTime(latest) : formatKstDateTime(new Date()),
        success: true,
        error: null,
      });
      void hydrateFromSupabase();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setHeader((prev) => ({
        ...prev,
        success: false,
        error: message,
      }));
    } finally {
      setRefreshing(false);
    }
  };

  const tzLabel = JIRA_SYNC_TIMEZONE === "Asia/Seoul" ? "KST" : JIRA_SYNC_TIMEZONE;

  return (
    <div className={cn(ui.card, "overflow-hidden")}>
      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-gray-200 bg-slate-50/80 px-6 py-5">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className={ui.iconBox}>
              <Database className="h-4 w-4 text-slate-700" />
            </div>
            <h1 className={ui.title}>JIRA 스프린트 관제</h1>
            <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">
              jira_sprints
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-slate-600 shadow-xs">
              마지막 인터페이스 일시:{" "}
              <span className="font-mono font-medium text-slate-900">
                {header.lastInterfaceAt ?? "—"}
              </span>
            </span>

            {header.success === true && (
              <span className={ui.badgeSuccess}>
                <span aria-hidden>●</span> 동기화 성공
              </span>
            )}
            {header.success === false && (
              <span className={ui.badgeError}>
                <span aria-hidden>●</span> 동기화 실패
              </span>
            )}
            {busy && (
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                {refreshing ? "JIRA 동기화 중" : "조회 중"}
              </span>
            )}
          </div>

          <p className="max-w-2xl text-xs leading-relaxed text-slate-500">
            자동 인터페이스: 매일 {String(JIRA_SYNC_SCHEDULE_HOUR).padStart(2, "0")}:00 ({tzLabel}) · GitHub
            Actions · 수동: <strong className="font-medium text-slate-700">Jira 동기화</strong> → JIRA API 조회 후 DB
            전체 교체
            {import.meta.env.DEV
              ? " (개발: Vite JIRA 프록시)"
              : " (운영: Supabase Edge — sync-jira-all / jira-proxy)"}
          </p>
          {header.error && <p className="text-xs text-red-600">{header.error}</p>}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!configured || busy}
          onClick={() => void handleManualSync()}
          className="h-10 shrink-0 gap-2 rounded-lg px-4"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {refreshing ? "동기화 중…" : "불러오는 중…"}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Jira 동기화
            </>
          )}
        </Button>
      </header>

      {!configured && (
        <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 를 설정하세요.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200 bg-slate-50">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
                      h.column.id === "remaining_days" && "text-right"
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-sm text-slate-500">
                  <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin text-slate-400" />
                  데이터 불러오는 중...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-sm text-slate-500">
                  인터페이스된 스프린트가 없습니다.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={ui.tableRow}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-3.5 align-middle",
                        cell.column.id === "remaining_days" && "text-right"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className={ui.cardFooter}>
        총 {gridData.length}건 · 행별 인터페이스 시간은 DB <code className="font-mono text-slate-600">updated_at</code>{" "}
        기준
      </footer>
    </div>
  );
}
