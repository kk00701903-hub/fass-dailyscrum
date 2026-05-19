import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Table2,
  Users,
} from "lucide-react";
import { resolveSprintName } from "@/lib/jira-live-data";
import { fetchDailyReportsByDate, type DailyReportRow } from "@/lib/daily-reports-repository";
import { fetchScrumEntriesByDate } from "@/lib/supabase/jira-repository";
import { getMemberSprintFocus } from "@/lib/scrum-sprint-preferences";
import { getAllScrumHistory } from "@/lib/scrum-storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { TEAM_MEMBERS, ROUTES } from "@/lib/index";
import type { ScrumEntry, TeamMember } from "@/lib/index";
import { Card, SectionHeader } from "@/components/Stats";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ALL_MEMBERS = "all";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultDday(): string {
  const dates = getAllScrumHistory().map((e) => e.date);
  if (dates.length === 0) return todayIso();
  return [...dates].sort((a, b) => b.localeCompare(a))[0]!;
}

function memberName(id: string) {
  return TEAM_MEMBERS.find((m) => m.id === id)?.name ?? id;
}

function formatDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00`));
}

export type TeamDailyReportRow = {
  id: string;
  member_id: string;
  member: TeamMember;
  sprint: string;
  yesterday_achievement: string | null;
  today_plan: string | null;
  bottleneck: string | null;
  hasReport: boolean;
};

function buildTeamRows(
  reportDate: string,
  reports: DailyReportRow[],
  scrumEntries: ScrumEntry[],
  memberFilter: string
): TeamDailyReportRow[] {
  const members =
    memberFilter === ALL_MEMBERS ? TEAM_MEMBERS : TEAM_MEMBERS.filter((m) => m.id === memberFilter);

  return members.map((member) => {
    const report = reports.find((r) => r.member_id === member.id) ?? null;
    const scrumEntry = scrumEntries.find((e) => e.memberId === member.id) ?? null;

    let sprint = "—";
    if (scrumEntry) {
      sprint = resolveSprintName(scrumEntry.sprintId);
    } else if (report) {
      const focusId = getMemberSprintFocus(member.id);
      sprint = focusId ? resolveSprintName(focusId) : "—";
    }

    return {
      id: report?.id ?? `${reportDate}-${member.id}`,
      member_id: member.id,
      member,
      sprint,
      yesterday_achievement: report?.yesterday_achievement?.trim() ? report.yesterday_achievement : null,
      today_plan: report?.today_plan?.trim() ? report.today_plan : null,
      bottleneck: report?.bottleneck?.trim() ? report.bottleneck : null,
      hasReport: Boolean(report),
    };
  });
}

function EmptyItalic({ children = "미입력" }: { children?: string }) {
  return (
    <span className="italic" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </span>
  );
}

function ReportTextCell({
  value,
  variant = "muted",
}: {
  value: string | null;
  variant?: "muted" | "foreground" | "danger";
}) {
  if (!value?.trim()) return <EmptyItalic />;
  const color =
    variant === "danger" ? "#f87171" : variant === "foreground" ? "var(--foreground)" : "var(--muted-foreground)";
  return <span style={{ color }}>{value}</span>;
}

function SortableHeader({
  label,
  onClick,
  sorted,
}: {
  label: string;
  onClick: () => void;
  sorted: false | "asc" | "desc";
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold hover:opacity-80 text-[11px]"
      onClick={onClick}
    >
      {label}
      <ArrowUpDown className={cn("w-3 h-3", sorted ? "opacity-100" : "opacity-40")} />
    </button>
  );
}

function createColumns(): ColumnDef<TeamDailyReportRow>[] {
  return [
    {
      id: "member_id",
      accessorFn: (row) => row.member.name,
      header: ({ column }) => (
        <SortableHeader
          label="담당자"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const member = row.original.member;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: `${member.color}25`, color: member.color }}
            >
              {member.avatar}
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
              {member.name}
            </span>
          </div>
        );
      },
      sortingFn: "alphanumeric",
    },
    {
      id: "sprint",
      accessorKey: "sprint",
      header: ({ column }) => (
        <SortableHeader
          label="스프린트"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs whitespace-nowrap align-top">{String(getValue() ?? "—")}</span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "yesterday_achievement",
      accessorKey: "yesterday_achievement",
      header: () => <span className="text-[11px] font-semibold">전일 성과</span>,
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="text-[11px] align-top leading-snug max-w-[320px]">
          <ReportTextCell value={getValue() as string | null} variant="muted" />
        </div>
      ),
    },
    {
      id: "today_plan",
      accessorKey: "today_plan",
      header: () => <span className="text-[11px] font-semibold">오늘 계획</span>,
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="text-[11px] align-top leading-snug max-w-[320px]">
          <ReportTextCell value={getValue() as string | null} variant="foreground" />
        </div>
      ),
    },
    {
      id: "bottleneck",
      accessorKey: "bottleneck",
      header: () => <span className="text-[11px] font-semibold">병목</span>,
      enableSorting: false,
      cell: ({ row }) => {
        if (!row.original.hasReport) {
          return <span className="text-[11px] align-top">—</span>;
        }
        return (
          <div className="text-[11px] align-top leading-snug max-w-[220px]">
            <ReportTextCell value={row.original.bottleneck} variant="danger" />
          </div>
        );
      },
    },
  ];
}

export default function DailyScrumHistory() {
  const dday = defaultDday();
  const [dateFilter, setDateFilter] = useState(() => todayIso());
  const [memberFilter, setMemberFilter] = useState<string>(ALL_MEMBERS);
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [scrumEntries, setScrumEntries] = useState<ScrumEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const availableDates = useMemo(() => {
    const fromHistory = getAllScrumHistory().map((e) => e.date);
    const fromReports = reports.map((r) => r.report_date);
    return [...new Set([...fromHistory, ...fromReports, dateFilter, todayIso()])].sort((a, b) =>
      b.localeCompare(a)
    );
  }, [reports, dateFilter]);

  const loadData = useCallback(async (reportDate: string) => {
    if (!isSupabaseConfigured()) {
      setReports([]);
      setScrumEntries([]);
      setLoadError("Supabase가 설정되지 않았습니다.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [reportRows, entryRows] = await Promise.all([
        fetchDailyReportsByDate(reportDate),
        fetchScrumEntriesByDate(reportDate).catch(() => [] as ScrumEntry[]),
      ]);
      setReports(reportRows);
      setScrumEntries(entryRows);
    } catch (e) {
      setReports([]);
      setScrumEntries([]);
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(dateFilter);
  }, [dateFilter, loadData]);

  const tableData = useMemo(
    () => buildTeamRows(dateFilter, reports, scrumEntries, memberFilter),
    [dateFilter, reports, scrumEntries, memberFilter]
  );

  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const dateIndex = availableDates.indexOf(dateFilter);
  const isDday = dateFilter === dday;
  const filledCount = tableData.filter((r) => r.hasReport).length;
  const memberCount = memberFilter === ALL_MEMBERS ? TEAM_MEMBERS.length : 1;

  const goPrevDay = () => {
    if (dateIndex < availableDates.length - 1) setDateFilter(availableDates[dateIndex + 1]!);
  };
  const goNextDay = () => {
    if (dateIndex > 0) setDateFilter(availableDates[dateIndex - 1]!);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.2)" }}
          >
            <Table2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              데일리 스크럼 일지
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              일자(D-day) 기준으로 팀 전체를 보거나, 담당자별로 좁혀 조회합니다.
            </p>
          </div>
        </div>
        <Link
          to={ROUTES.DAILY_SCRUM}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-opacity hover:opacity-85 shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          입력 화면
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
            일자 조회
            {isDday && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(34,211,238,0.15)", color: "var(--primary)" }}
              >
                D-day
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goPrevDay}
              disabled={dateIndex >= availableDates.length - 1 || dateIndex < 0}
              className="p-2 rounded-lg disabled:opacity-30 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              title="이전 일자"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 rounded-lg px-2 text-xs outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--foreground)",
              }}
            />
            <button
              type="button"
              onClick={() => setDateFilter(dday)}
              className="text-xs px-3 py-2 rounded-lg font-medium transition-all border"
              style={{
                background: isDday ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                borderColor: isDday ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.1)",
                color: isDday ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              D-day
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(todayIso())}
              className="text-xs px-3 py-2 rounded-lg font-medium transition-all border"
              style={{
                background: dateFilter === todayIso() ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "var(--muted-foreground)",
              }}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={goNextDay}
              disabled={dateIndex <= 0}
              className="p-2 rounded-lg disabled:opacity-30 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
              title="다음 일자"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted-foreground)" }}>
          {formatDateLabel(dateFilter)}
          {memberFilter === ALL_MEMBERS
            ? ` · 전체 ${memberCount}명 · 입력 ${filledCount}건`
            : ` · ${memberName(memberFilter)} · 입력 ${filledCount}건`}
          {loading && (
            <span className="inline-flex items-center gap-1 ml-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              불러오는 중
            </span>
          )}
        </p>
        {loadError && (
          <p className="text-[11px] mt-2" style={{ color: "#f87171" }}>
            {loadError}
          </p>
        )}
        {availableDates.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {availableDates.slice(0, 8).map((d) => {
              const on = d === dateFilter;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDateFilter(d)}
                  className="text-[10px] px-2.5 py-1 rounded-full font-medium border transition-all"
                  style={{
                    background: on ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.03)",
                    borderColor: on ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.08)",
                    color: on ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {d === dday ? "D-day · " : ""}
                  {d}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          <Users className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
          담당자 필터
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMemberFilter(ALL_MEMBERS)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-all border"
            style={{
              background: memberFilter === ALL_MEMBERS ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: memberFilter === ALL_MEMBERS ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.1)",
              color: memberFilter === ALL_MEMBERS ? "var(--primary)" : "var(--muted-foreground)",
            }}
          >
            전체
          </button>
          {TEAM_MEMBERS.map((m) => {
            const on = memberFilter === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberFilter(m.id)}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-all border flex items-center gap-1.5"
                style={{
                  background: on ? `${m.color}20` : "rgba(255,255,255,0.04)",
                  borderColor: on ? `${m.color}50` : "rgba(255,255,255,0.1)",
                  color: on ? m.color : "var(--muted-foreground)",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: `${m.color}25`, color: m.color }}
                >
                  {m.avatar}
                </span>
                {m.name}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <SectionHeader
            title={memberFilter === ALL_MEMBERS ? "팀 전체 일지" : `${memberName(memberFilter)} 일지`}
            subtitle={`${dateFilter} · ${table.getRowModel().rows.length}행 표시`}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-[11px] whitespace-nowrap",
                        header.column.id === "member_id" && "w-[100px]",
                        header.column.id === "sprint" && "w-[108px]",
                        header.column.id === "yesterday_achievement" && "min-w-[140px]",
                        header.column.id === "today_plan" && "min-w-[140px]",
                        header.column.id === "bottleneck" && "min-w-[120px]"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-10 text-sm" style={{ color: "var(--muted-foreground)" }}>
                    조건에 맞는 기록이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    style={{
                      borderColor: "rgba(255,255,255,0.05)",
                      opacity: row.original.hasReport ? 1 : 0.55,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "align-top",
                          cell.column.id === "member_id" && "whitespace-nowrap"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
