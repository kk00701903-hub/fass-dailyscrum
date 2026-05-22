/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 */
import { useEffect, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AnalyticsBlockerFeed, AnalyticsRecentTasks } from "@/components/analytics/AnalyticsPanels";
import { AnalyticsEmpty } from "@/components/analytics/AnalyticsEmpty";
import { GrafanaDashboardEmbed } from "@/components/GrafanaDashboardEmbed";
import { StatCard, Card, SectionHeader } from "@/components/Stats";
import { ROUTES } from "@/lib/index";
import { getMembersForAnalytics, TEAM_MEMBER_PREFS_EVENT } from "@/lib/team-member-preferences";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { blockersFromJiraTasks, memberTaskCompletionCounts } from "@/lib/jira-live-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { memberAvatarStyle, ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const fadeUp = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } };

/** KPI 4칸·팀원 기여도 카드 공통 그리드 */
const ANALYTICS_KPI_GRID = "grid grid-cols-2 gap-3 md:grid-cols-4";

export default function Analytics() {
  const hydrateFromSupabase = useJiraSyncStore((s) => s.hydrateFromSupabase);
  const tasks = getActiveJiraTasks();
  const blockers = blockersFromJiraTasks(tasks);

  useEffect(() => {
    if (isSupabaseConfigured()) void hydrateFromSupabase();
  }, [hydrateFromSupabase]);

  const totalSP = tasks.reduce((s, t) => s + t.storyPoints, 0);
  const doneSP = tasks.filter((t) => t.status === "DONE").reduce((s, t) => s + t.storyPoints, 0);
  const velocity = tasks.length > 0 ? Math.round(doneSP / 7) : 0;

  const analyticsMembers = useSyncExternalStore(
    (cb) => {
      window.addEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
      return () => window.removeEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
    },
    getMembersForAnalytics,
    getMembersForAnalytics
  );

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="-mt-1 space-y-3 text-xs"
    >
      <motion.div variants={fadeUp} className={ANALYTICS_KPI_GRID}>
        <StatCard
          variant="dense"
          tall
          label="스프린트 속도"
          value={velocity}
          unit="SP/일"
          description="JIRA 동기화 데이터"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#34d399" }} />}
          iconBg="rgba(52,211,153,0.12)"
        />
        <StatCard
          variant="dense"
          tall
          label="완료 스토리 포인트"
          value={doneSP}
          unit="SP"
          description={totalSP > 0 ? `목표 ${totalSP} SP` : "—"}
          icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#22d3ee" }} />}
          iconBg="rgba(34,211,238,0.12)"
        />
        <StatCard
          variant="dense"
          tall
          label="블로커 이슈"
          value={blockers.length}
          unit="건"
          description="BLOCKED 상태"
          icon={<AlertTriangle className="h-4 w-4" style={{ color: "#fb923c" }} />}
          iconBg="rgba(251,146,60,0.12)"
        />
        <StatCard
          variant="dense"
          tall
          label="전체 태스크"
          value={tasks.length}
          unit="건"
          description="동기화된 이슈"
          icon={<Clock className="h-4 w-4" style={{ color: "#a78bfa" }} />}
          iconBg="rgba(167,139,250,0.12)"
        />
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch"
      >
        <AnalyticsBlockerFeed />
        <AnalyticsRecentTasks />
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className={cn(ui.panelDense, "hover:translate-y-0 p-3.5")}>
          <SectionHeader
            title="팀원별 스프린트 기여도"
            subtitle="담당 전체 태스크 중 완료(DONE) 건수"
          />
          <div className={cn("mt-3", ANALYTICS_KPI_GRID)}>
            {analyticsMembers.length === 0 ? (
              <AnalyticsEmpty className="col-span-full min-h-[7rem] py-6">
                <span>
                  표시할 담당자가 없습니다.{" "}
                  <Link
                    to={ROUTES.SETTINGS}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    설정 → 팀 구성
                  </Link>
                  에서 애널리틱스 대상을 선택하세요.
                </span>
              </AnalyticsEmpty>
            ) : (
              analyticsMembers.map((m) => {
                const { total, done, pct } = memberTaskCompletionCounts(tasks, m.id);

                return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-3.5 shadow-sm transition-colors hover:bg-muted/20"
                  >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={memberAvatarStyle(m.color)}
                    >
                      {m.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-snug text-foreground">
                        {m.name}
                      </p>
                      <p className="truncate text-xs leading-snug text-slate-600 dark:text-slate-400">
                        {m.role}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center gap-1 tabular-nums">
                      <span
                        className="text-2xl font-bold leading-none tracking-tight"
                        style={{ color: m.color }}
                      >
                        {done}
                      </span>
                      <span className="text-lg font-medium text-muted-foreground">/</span>
                      <span className="text-xl font-semibold leading-none text-foreground">
                        {total}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">건</span>
                    </div>
                    <p className="text-center text-xs leading-snug text-slate-600 dark:text-slate-400">
                      완료 태스크 / 전체 태스크
                    </p>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${m.name} 완료율`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: m.color }}
                      />
                    </div>
                    <p className="text-center text-xs font-semibold leading-snug tabular-nums text-foreground">
                      완료율{" "}
                      <span style={{ color: m.color }}>{pct}%</span>
                      {total === 0 ? (
                        <span className="font-normal text-muted-foreground"> · 담당 태스크 없음</span>
                      ) : null}
                    </p>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <GrafanaDashboardEmbed />
      </motion.div>
    </motion.div>
  );
}
