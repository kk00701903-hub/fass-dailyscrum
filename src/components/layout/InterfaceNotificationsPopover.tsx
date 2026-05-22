import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  fetchJiraSprintsFromDb,
  subscribeJiraSprints,
  type JiraSprintRow,
} from "@/lib/jira-sprints-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import {
  formatSeoulDateTime,
  JIRA_SYNC_SCHEDULE_HOUR,
  JIRA_SYNC_TIMEZONE,
} from "@/lib/jira-sync-schedule";
import { ROUTES } from "@/lib/index";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

function formatInterfaceTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
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

function latestSprintUpdatedAt(rows: JiraSprintRow[]): string | null {
  const sorted = rows
    .map((r) => r.updated_at)
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => b.localeCompare(a));
  return sorted[0] ?? null;
}

export function InterfaceNotificationsPopover() {
  const configured = isSupabaseConfigured();
  const syncing = useJiraSyncStore((s) => s.syncing);
  const lastSyncAt = useJiraSyncStore((s) => s.lastSyncAt);
  const lastSyncSource = useJiraSyncStore((s) => s.lastSyncSource);
  const lastJiraError = useJiraSyncStore((s) => s.lastJiraError);
  const dataSource = useJiraSyncStore((s) => s.dataSource);
  const exporterWarnings = useJiraSyncStore((s) => s.exporterWarnings);
  const startSync = useJiraSyncStore((s) => s.startSync);
  const clearJiraError = useJiraSyncStore((s) => s.clearJiraError);

  const [open, setOpen] = useState(false);
  const [sprintRows, setSprintRows] = useState<JiraSprintRow[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);

  const loadSprints = useCallback(async () => {
    if (!configured) {
      setSprintRows([]);
      return;
    }
    setSprintsLoading(true);
    try {
      const data = await fetchJiraSprintsFromDb();
      setSprintRows(data);
    } catch {
      setSprintRows([]);
    } finally {
      setSprintsLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (!open) return;
    void loadSprints();
    if (!configured) return;
    return subscribeJiraSprints(() => void loadSprints());
  }, [open, configured, loadSprints]);

  const lastInterfaceAt = useMemo(() => {
    const fromDb = latestSprintUpdatedAt(sprintRows);
    if (fromDb) return formatInterfaceTime(fromDb);
    if (lastSyncAt != null) return formatSeoulDateTime(lastSyncAt);
    return "—";
  }, [sprintRows, lastSyncAt]);

  const recentSprints = useMemo(
    () =>
      [...sprintRows]
        .filter((r) => r.updated_at)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, 6),
    [sprintRows]
  );

  const hasAlert = Boolean(lastJiraError) || exporterWarnings.length > 0;
  const syncLabel =
    lastSyncAt != null
      ? `${formatSeoulDateTime(lastSyncAt)}${
          lastSyncSource === "schedule" ? " · 자동" : lastSyncSource === "manual" ? " · 수동" : ""
        }`
      : "—";

  const tzLabel = JIRA_SYNC_TIMEZONE === "Asia/Seoul" ? "KST" : JIRA_SYNC_TIMEZONE;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2 transition-colors hover:bg-muted/30"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="인터페이스 알림"
        >
          <Bell className="h-4 w-4" />
          {hasAlert ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          ) : syncing ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl border-border/80 p-0 shadow-lg">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">인터페이스 · 동기화</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            JIRA 연동 상태 ({tzLabel} 매일 {JIRA_SYNC_SCHEDULE_HOUR}:00 자동)
          </p>
        </div>

        <div className="max-h-[min(24rem,60vh)] space-y-2 overflow-y-auto p-3">
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
            <Row label="마지막 동기화" value={syncLabel} mono />
            <Row label="마지막 인터페이스" value={lastInterfaceAt} mono />
            <Row
              label="데이터 출처"
              value={
                dataSource === "supabase"
                  ? "Supabase"
                  : dataSource === "rest"
                    ? "JIRA REST"
                    : dataSource === "exporter"
                      ? "Exporter CSV"
                      : "—"
              }
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {syncing ? (
                <span className={cn(ui.badgeNeutral, "gap-1")}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  동기화 중
                </span>
              ) : lastJiraError ? (
                <span className={ui.badgeError}>
                  <XCircle className="mr-0.5 inline h-3 w-3" />
                  실패
                </span>
              ) : lastSyncAt != null ? (
                <span className={ui.badgeSuccess}>
                  <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
                  정상
                </span>
              ) : (
                <span className={ui.badgeNeutral}>미동기화</span>
              )}
            </div>
          </div>

          {lastJiraError ? (
            <div
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] leading-snug text-red-600 dark:text-red-400"
              role="alert"
            >
              {lastJiraError}
              <button
                type="button"
                className="mt-1.5 block text-[10px] font-medium underline"
                onClick={() => clearJiraError()}
              >
                닫기
              </button>
            </div>
          ) : null}

          {exporterWarnings.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">Exporter 경고</p>
              <ul className="mt-1 list-inside list-disc text-[10px] text-amber-900/90 dark:text-amber-100/90">
                {exporterWarnings.slice(0, 3).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              스프린트별 인터페이스
            </p>
            {!configured ? (
              <p className="text-[11px] text-muted-foreground">Supabase 미설정</p>
            ) : sprintsLoading ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                불러오는 중…
              </p>
            ) : recentSprints.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">인터페이스된 스프린트 없음</p>
            ) : (
              <ul className="space-y-1">
                {recentSprints.map((row) => (
                  <li
                    key={row.id ?? row.sprint_name}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-card/80 px-2 py-1"
                  >
                    <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                      {row.sprint_name}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
                      {formatInterfaceTime(row.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 p-2.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-xs"
            disabled={syncing}
            onClick={() => startSync("manual")}
          >
            JIRA 동기화
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
            <Link to={ROUTES.SETTINGS} onClick={() => setOpen(false)}>
              설정
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right leading-tight text-foreground",
          mono && "font-mono text-[10px] tabular-nums"
        )}
      >
        {value}
      </span>
    </div>
  );
}
