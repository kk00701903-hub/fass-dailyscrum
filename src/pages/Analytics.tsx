/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";
import { BurndownChart, VelocityChart, StatusPieChart } from "@/components/Charts";
import { StatCard, Card, SectionHeader } from "@/components/Stats";
import { TEAM_MEMBERS } from "@/lib/index";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { blockersFromJiraTasks } from "@/lib/jira-live-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { memberAvatarStyle, ui } from "@/lib/untitled-ui";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <motion.div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="스프린트 속도"
          value={velocity}
          unit="SP/일"
          description={tasks.length > 0 ? "JIRA 동기화 데이터 기준" : "동기화 후 집계"}
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="완료 스토리 포인트"
          value={doneSP}
          unit="SP"
          description={totalSP > 0 ? `목표 ${totalSP} SP` : "—"}
          icon={<CheckCircle2 className="h-5 w-5 text-cyan-600" />}
          iconBg="bg-cyan-50"
        />
        <StatCard
          label="블로커 이슈"
          value={blockers.length}
          unit="건"
          description="BLOCKED 상태"
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
        />
        <StatCard
          label="전체 태스크"
          value={tasks.length}
          unit="건"
          description="동기화된 이슈"
          icon={<Clock className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BurndownChart />
        <VelocityChart />
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatusPieChart />

        <motion.div className="lg:col-span-2">
          <Card className="p-6">
            <SectionHeader title="블로커 로그" subtitle="JIRA BLOCKED 이슈" />
            <motion.div className="space-y-2">
              {blockers.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">블로커 상태 이슈가 없습니다.</p>
              ) : (
                blockers.map((bl) => (
                  <motion.div
                    key={bl.id}
                    className="rounded-xl border border-orange-200 bg-orange-50 p-3"
                  >
                    <p className="text-sm text-slate-900">{bl.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {bl.reportedBy.name}
                      {bl.relatedTask ? ` · ${bl.relatedTask}` : ""}
                    </p>
                  </motion.div>
                ))
              )}
            </motion.div>
          </Card>
        </motion.div>
      </motion.div>

      <Card className="p-6">
        <SectionHeader title="팀원별 스프린트 기여도" subtitle="JIRA 배정 이슈" />
        <motion.div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TEAM_MEMBERS.map((m) => {
            const memberTasks = tasks.filter((t) => t.assignee.id === m.id);
            const memberDone = memberTasks.filter((t) => t.status === "DONE").length;
            const memberTotal = memberTasks.length;
            const pct = memberTotal > 0 ? Math.round((memberDone / memberTotal) * 100) : 0;
            return (
              <motion.div key={m.id} className={cn(ui.card, "p-4")}>
                <motion.div className="mb-3 flex items-center gap-2">
                  <motion.div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                    style={memberAvatarStyle(m.color)}
                  >
                    {m.avatar}
                  </motion.div>
                  <motion.div>
                    <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.role}</p>
                  </motion.div>
                </motion.div>
                <motion.div className="space-y-1.5">
                  <motion.div className="flex justify-between text-xs">
                    <span className="text-slate-500">완료율</span>
                    <span className="font-bold" style={{ color: m.color }}>
                      {pct}%
                    </span>
                  </motion.div>
                  <motion.div className="h-1.5 w-full rounded-full bg-slate-100">
                    <motion.div
                      className="h-1.5 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      style={{ background: m.color }}
                    />
                  </motion.div>
                  <motion.div className="flex justify-between text-[11px] text-slate-500">
                    <span>
                      {memberDone}/{memberTotal} 태스크
                    </span>
                    <span>{memberTasks.reduce((s, t) => s + t.storyPoints, 0)} SP</span>
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </Card>
    </div>
  );
}
