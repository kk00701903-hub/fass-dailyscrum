/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useEffect, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertTriangle, Layers, Flame, ArrowRight } from "lucide-react";
import { StatCard, Card, SectionHeader } from "@/components/Stats";
import { GrafanaDashboardEmbed } from "@/components/GrafanaDashboardEmbed";
import { STATUS_CONFIG, TEAM_MEMBERS, ROUTES } from "@/lib/index";
import { StatusBadge } from "@/components/Stats";
import { Link } from "react-router-dom";
import { getTeamActiveSprintId, SCRUM_SPRINT_PREFS_EVENT } from "@/lib/scrum-sprint-preferences";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { blockersFromJiraTasks, resolveSprintName, sprintRollupFromJira } from "@/lib/jira-live-data";
import { getAllScrumHistory } from "@/lib/scrum-storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { displayText, EMPTY_CONTENT_LABEL } from "@/lib/display-text";
import { memberAvatarStyle, ui } from "@/lib/untitled-ui";
import { cn } from "@/lib/utils";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const hydrateFromSupabase = useJiraSyncStore((s) => s.hydrateFromSupabase);
  const jiraTick = useJiraSyncStore((s) => s.lastSyncAt);

  useEffect(() => {
    if (isSupabaseConfigured()) void hydrateFromSupabase();
  }, [hydrateFromSupabase]);

  const teamSprintId = useSyncExternalStore(
    (cb) => {
      window.addEventListener(SCRUM_SPRINT_PREFS_EVENT, cb);
      return () => window.removeEventListener(SCRUM_SPRINT_PREFS_EVENT, cb);
    },
    getTeamActiveSprintId,
    getTeamActiveSprintId
  );

  const tasks = getActiveJiraTasks();
  const scrumHistory = getAllScrumHistory();
  const blockers = blockersFromJiraTasks(tasks);
  const teamSprintName = resolveSprintName(teamSprintId);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const totalSP = tasks.reduce((s, t) => s + t.storyPoints, 0);
  const doneSP = tasks.filter((t) => t.status === "DONE").reduce((s, t) => s + t.storyPoints, 0);
  const { totalSprints, completedSprints } = sprintRollupFromJira();
  const sprintCompletePct =
    totalSprints > 0 ? Math.round((completedSprints / totalSprints) * 100) : 0;
  const hasJiraTasks = totalTasks > 0;

  void jiraTick;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="스프린트 완료율"
          value={totalSprints > 0 ? `${sprintCompletePct}%` : EMPTY_CONTENT_LABEL}
          description={
            totalSprints > 0
              ? `완료 ${completedSprints}개 · 전체 ${totalSprints}개 스프린트`
              : EMPTY_CONTENT_LABEL
          }
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="진행 중 태스크"
          value={hasJiraTasks ? inProgress : EMPTY_CONTENT_LABEL}
          unit={hasJiraTasks ? "개" : undefined}
          description={
            hasJiraTasks
              ? `진행 중 ${inProgress}개 · 전체 ${totalTasks}개 · 완료 ${doneTasks}개`
              : EMPTY_CONTENT_LABEL
          }
          icon={<Clock className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-50"
        />
        <StatCard
          label="활성 블로커"
          value={hasJiraTasks ? blocked : EMPTY_CONTENT_LABEL}
          unit={hasJiraTasks ? "개" : undefined}
          delta={blocked > 0 ? "주의 필요" : undefined}
          deltaType="down"
          description={hasJiraTasks ? undefined : EMPTY_CONTENT_LABEL}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-50"
        />
        <StatCard
          label="남은 스토리 포인트"
          value={totalSP > 0 ? totalSP - doneSP : EMPTY_CONTENT_LABEL}
          unit={totalSP > 0 ? "SP" : undefined}
          description={totalSP > 0 ? `총 ${totalSP} SP` : EMPTY_CONTENT_LABEL}
          icon={<Layers className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <GrafanaDashboardEmbed />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <SectionHeader
            title="최근 태스크"
            subtitle="JIRA 동기화 기준"
            action={
              <Link to={ROUTES.JIRA_SYNC} className={ui.link}>
                전체 보기 <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          <motion.div className="space-y-0">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{EMPTY_CONTENT_LABEL}</p>
            ) : (
              tasks.slice(0, 6).map((task) => {
                const cfg = STATUS_CONFIG[task.status];
                return (
                  <motion.div
                    key={task.id}
                    className={cn("flex items-center gap-3 border-b border-gray-100 py-3 last:border-0", ui.tableRow)}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {displayText(task.key)}
                    </span>
                    <span className="flex-1 truncate text-xs text-slate-900">
                      {displayText(task.summary)}
                    </span>
                    <StatusBadge status={task.status} color={cfg.color} bg={cfg.bg} label={cfg.label} />
                    <motion.div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={memberAvatarStyle(task.assignee.color)}
                    >
                      {task.assignee.avatar}
                    </motion.div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </Card>

        <Card className="p-6">
          <SectionHeader
            title="병목 구간 (Blockers)"
            subtitle={
              blockers.length > 0
                ? `${blockers.length}개 JIRA 블로커 상태`
                : EMPTY_CONTENT_LABEL
            }
          />
          <motion.div className="space-y-3">
            {blockers.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{EMPTY_CONTENT_LABEL}</p>
            ) : (
              blockers.map((bl) => (
                <motion.div
                  key={bl.id}
                  className="rounded-xl border border-orange-200 bg-orange-50 p-3"
                >
                  <motion.div className="flex items-start gap-2">
                    <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                    <motion.div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-slate-900">
                        {displayText(bl.description)}
                      </p>
                      <motion.div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[10px] text-slate-500">
                          {displayText(bl.reportedBy.name)}
                        </span>
                        {bl.relatedTask && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {displayText(bl.relatedTask)}
                          </span>
                        )}
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              ))
            )}
          </motion.div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="p-6">
          <SectionHeader
            title="오늘의 스크럼 요약"
            subtitle={`${displayText(teamSprintName, "스프린트")} · 최근 일자 기준`}
            action={
              <Link to={ROUTES.DAILY_SCRUM} className={ui.link}>
                스크럼 입력 <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          <motion.div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TEAM_MEMBERS.map((member) => {
              const entry = [...scrumHistory]
                .filter((s) => s.memberId === member.id && (!teamSprintId || s.sprintId === teamSprintId))
                .sort((a, b) => b.date.localeCompare(a.date))[0];
              return (
                <motion.div key={member.id} className={cn(ui.memberCard, "flex-col items-stretch space-y-2")}>
                  <motion.div className="flex items-center gap-2">
                    <motion.div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={memberAvatarStyle(member.color)}
                    >
                      {member.avatar}
                    </motion.div>
                    <motion.div>
                      <p className="text-xs font-semibold text-slate-900">{member.name}</p>
                      <p className="text-[10px] text-slate-500">{member.role}</p>
                    </motion.div>
                  </motion.div>
                  {entry ? (
                    <>
                      <p className="line-clamp-2 text-[11px] leading-snug text-slate-600">
                        {displayText(entry.today)}
                      </p>
                      {entry.blockers && entry.blockers !== "없음" && (
                        <p className="line-clamp-1 text-[11px] text-red-600">
                          {displayText(entry.blockers)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">{EMPTY_CONTENT_LABEL}</p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
