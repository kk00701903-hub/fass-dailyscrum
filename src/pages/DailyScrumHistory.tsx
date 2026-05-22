import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Table2,
  UsersRound,
} from "lucide-react";
import { TeamDailyLogGrid } from "@/components/scrum/TeamDailyLogGrid";
import { fetchDailyReportsByDate, type DailyReportRow } from "@/lib/daily-reports-repository";
import { fetchScrumEntriesByDate } from "@/lib/supabase/jira-repository";
import {
  getAllScrumHistory,
  getScrumEntriesRevision,
  hydrateScrumHistoryFromSupabase,
  SCRUM_ENTRIES_CHANGED_EVENT,
  subscribeScrumEntries,
} from "@/lib/scrum-storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { TEAM_MEMBERS, ROUTES } from "@/lib/index";
import {
  getMembersForScrumHistory,
  TEAM_MEMBER_PREFS_EVENT,
} from "@/lib/team-member-preferences";
import { buildTeamDailyLogRows } from "@/lib/team-daily-log";
import type { ScrumEntry } from "@/lib/index";
import { Card, SectionHeader } from "@/components/Stats";
import { memberAvatarStyle, ui } from "@/lib/design-system";
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

function MetaMiniBadge({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: "primary" | "neutral" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        accent === "primary" && "border-primary/30 bg-primary/10 text-primary",
        accent === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        (!accent || accent === "neutral") && ui.badgeNeutral
      )}
    >
      {children}
    </span>
  );
}

function MemberFilterChip({
  active,
  onClick,
  label,
  avatar,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  avatar?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary shadow-xs"
          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/40"
      )}
    >
      {avatar != null && color != null ? (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            ...memberAvatarStyle(color),
            border: `1px solid ${color}40`,
          }}
        >
          {avatar}
        </span>
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted/50">
          <UsersRound className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
      <span className="max-w-[5rem] truncate">{label}</span>
    </button>
  );
}

export default function DailyScrumHistory() {
  const location = useLocation();
  const dday = defaultDday();
  const [dateFilter, setDateFilter] = useState(() => todayIso());
  const [memberFilter, setMemberFilter] = useState<string>(ALL_MEMBERS);
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [scrumEntries, setScrumEntries] = useState<ScrumEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const entriesRevision = useSyncExternalStore(
    subscribeScrumEntries,
    getScrumEntriesRevision,
    getScrumEntriesRevision
  );

  const availableDates = useMemo(() => {
    const fromHistory = getAllScrumHistory().map((e) => e.date);
    const fromReports = reports.map((r) => r.report_date);
    return [...new Set([...fromHistory, ...fromReports, dateFilter, todayIso()])].sort((a, b) =>
      b.localeCompare(a)
    );
  }, [reports, dateFilter, entriesRevision]);

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

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void hydrateScrumHistoryFromSupabase();
  }, []);

  useEffect(() => {
    const onEntriesChanged = () => void loadData(dateFilter);
    window.addEventListener(SCRUM_ENTRIES_CHANGED_EVENT, onEntriesChanged);
    return () => window.removeEventListener(SCRUM_ENTRIES_CHANGED_EVENT, onEntriesChanged);
  }, [dateFilter, loadData]);

  useEffect(() => {
    if (location.pathname !== ROUTES.SCRUM_HISTORY) return;
    void loadData(dateFilter);
  }, [location.pathname, dateFilter, loadData]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadData(dateFilter);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [dateFilter, loadData]);

  const scrumMembers = useSyncExternalStore(
    (cb) => {
      window.addEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
      return () => window.removeEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
    },
    getMembersForScrumHistory,
    getMembersForScrumHistory
  );

  const tableData = useMemo(
    () =>
      buildTeamDailyLogRows(
        dateFilter,
        reports,
        scrumEntries,
        memberFilter,
        ALL_MEMBERS,
        scrumMembers
      ),
    [dateFilter, reports, scrumEntries, memberFilter, scrumMembers, entriesRevision]
  );

  useEffect(() => {
    if (memberFilter === ALL_MEMBERS) return;
    if (!scrumMembers.some((m) => m.id === memberFilter)) {
      setMemberFilter(ALL_MEMBERS);
    }
  }, [memberFilter, scrumMembers]);

  const dateIndex = availableDates.indexOf(dateFilter);
  const isDday = dateFilter === dday;
  const filledCount = tableData.filter((r) => r.hasReport).length;
  const memberCount = memberFilter === ALL_MEMBERS ? scrumMembers.length : 1;

  const goPrevDay = () => {
    if (dateIndex < availableDates.length - 1) setDateFilter(availableDates[dateIndex + 1]!);
  };
  const goNextDay = () => {
    if (dateIndex > 0) setDateFilter(availableDates[dateIndex - 1]!);
  };

  const today = todayIso();
  const tableTitle =
    memberFilter === ALL_MEMBERS ? "팀 전체 일지" : `${memberName(memberFilter)} 일지`;

  return (
    <div className="space-y-3">
      <div className={ui.pageHeader}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn(ui.iconBoxSm, ui.iconCyan)}>
            <Table2 className="h-4 w-4" />
          </div>
          <h2 className={ui.title}>데일리 스크럼 일지</h2>
        </div>
        <Link to={ROUTES.DAILY_SCRUM} className={ui.btnSecondary}>
          <ArrowLeft className="h-3.5 w-3.5" />
          입력 화면
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/25 px-3 py-1.5">
          <MetaMiniBadge accent="neutral">
            <CalendarDays className="h-3 w-3" />
            {formatDateLabel(dateFilter)}
          </MetaMiniBadge>
          {isDday && <MetaMiniBadge accent="primary">D-day 기준</MetaMiniBadge>}
          <MetaMiniBadge accent="neutral">
            {memberFilter === ALL_MEMBERS ? `전체 ${memberCount}명` : memberName(memberFilter)}
          </MetaMiniBadge>
          <MetaMiniBadge accent={filledCount > 0 ? "success" : "neutral"}>
            입력 {filledCount}건
          </MetaMiniBadge>
          <MetaMiniBadge accent="neutral">{tableData.length}행</MetaMiniBadge>
          {loading && (
            <MetaMiniBadge accent="neutral">
              <Loader2 className="h-3 w-3 animate-spin" />
              불러오는 중
            </MetaMiniBadge>
          )}
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className={cn(ui.label, "mr-1 shrink-0")}>일자</span>
            <button
              type="button"
              onClick={goPrevDay}
              disabled={dateIndex >= availableDates.length - 1 || dateIndex < 0}
              className={cn(ui.btnSecondary, "h-8 w-8 shrink-0 px-0")}
              title="이전 일자"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={cn(ui.input, "h-8 w-[9.5rem] shrink-0")}
            />
            <button
              type="button"
              onClick={() => setDateFilter(dday)}
              className={cn(
                ui.btnSecondary,
                "h-8 shrink-0 px-2.5",
                isDday && "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              D-day
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(today)}
              className={cn(
                ui.btnSecondary,
                "h-8 shrink-0 px-2.5",
                dateFilter === today && "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={goNextDay}
              disabled={dateIndex <= 0}
              className={cn(ui.btnSecondary, "h-8 w-8 shrink-0 px-0")}
              title="다음 일자"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex min-w-0 max-w-full items-center lg:max-w-[min(100%,32rem)] lg:justify-end">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <MemberFilterChip
                active={memberFilter === ALL_MEMBERS}
                onClick={() => setMemberFilter(ALL_MEMBERS)}
                label="전체"
              />
              {scrumMembers.map((m) => (
                <MemberFilterChip
                  key={m.id}
                  active={memberFilter === m.id}
                  onClick={() => setMemberFilter(m.id)}
                  label={m.name}
                  avatar={m.avatar}
                  color={m.color}
                />
              ))}
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="border-b border-border px-3 py-1.5 text-[10px] text-red-500">{loadError}</p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-muted/15 px-3 py-2">
          <SectionHeader
            dense
            title={tableTitle}
            subtitle={`${dateFilter} · 스크럼 기록 조회`}
          />
        </div>
        <TeamDailyLogGrid data={tableData} />
      </Card>
    </div>
  );
}
