/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Analytics-dense chart panels (Analytics page only).
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, SectionHeader, StatusBadge } from "@/components/Stats";
import { AnalyticsEmpty } from "@/components/analytics/AnalyticsEmpty";
import {
  burndownFromTasks,
  burndownSummaryFromTasks,
  memberVelocityFromTasks,
  statusDistributionFromTasks,
} from "@/lib/jira-live-data";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { STATUS_CONFIG, type TaskStatus } from "@/lib/index";
import {
  CHART_COLORS,
  chartAxisTickFill,
  chartGridStroke,
  getChartTooltipStyle,
  ui,
} from "@/lib/design-system";
import { cn } from "@/lib/utils";

const tooltipStyle = getChartTooltipStyle();
const axisTick = { fontSize: 9, fill: chartAxisTickFill() };
const gridStroke = chartGridStroke();

function BurndownSummaryTable({
  remaining,
  done,
  total,
}: {
  remaining: number;
  done: number;
  total: number;
}) {
  const rows = [
    { label: "잔여 SP", value: remaining },
    { label: "완료 SP", value: done },
    { label: "전체 SP", value: total },
  ];
  return (
    <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-border/60 pl-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 text-[10px]">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BurndownChart() {
  const tasks = getActiveJiraTasks();
  const data = burndownFromTasks(tasks);
  const summary = burndownSummaryFromTasks(tasks);
  const showIdeal = data.length > 1;
  const empty = tasks.length === 0;

  return (
    <Card className={cn(ui.panelDense, "hover:translate-y-0")}>
      <SectionHeader dense title="번다운 차트" subtitle="JIRA · 잔여 SP" />
      {empty ? (
        <AnalyticsEmpty className="min-h-[260px]" />
      ) : (
        <div className="flex min-h-[260px] gap-3">
          <div className="min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRemainingDense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                {showIdeal && (
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="이상"
                    stroke={CHART_COLORS.ideal}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="remaining"
                  name="잔여 SP"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  fill="url(#gradRemainingDense)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <BurndownSummaryTable remaining={summary.remaining} done={summary.done} total={summary.total} />
        </div>
      )}
    </Card>
  );
}

function VelocityMemberTable({
  rows,
}: {
  rows: { name: string; completed: number; inProgress: number; todo: number }[];
}) {
  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <div className="mb-1 grid grid-cols-4 gap-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>담당</span>
        <span className="text-right">완료</span>
        <span className="text-right">진행</span>
        <span className="text-right">할일</span>
      </div>
      <div className="max-h-[88px] space-y-0.5 overflow-y-auto">
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-4 gap-1 rounded-md px-1 py-0.5 text-[10px] hover:bg-muted/30"
          >
            <span className="truncate font-medium text-foreground">{r.name}</span>
            <span className="text-right tabular-nums" style={{ color: CHART_COLORS.green }}>
              {r.completed}
            </span>
            <span className="text-right tabular-nums" style={{ color: CHART_COLORS.primary }}>
              {r.inProgress}
            </span>
            <span className="text-right tabular-nums text-muted-foreground">{r.todo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VelocityChart() {
  const tasks = getActiveJiraTasks();
  const data = memberVelocityFromTasks(tasks);
  const empty = data.length === 0;

  return (
    <Card className={cn(ui.panelDense, "hover:translate-y-0")}>
      <SectionHeader dense title="팀원별 진행 현황" subtitle="스토리 포인트 · 스택" />
      {empty ? (
        <AnalyticsEmpty className="min-h-[200px]" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: 4 }} iconSize={8} />
              <Bar dataKey="completed" name="완료" stackId="a" fill={CHART_COLORS.green} maxBarSize={28} />
              <Bar dataKey="inProgress" name="진행" stackId="a" fill={CHART_COLORS.purple} maxBarSize={28} />
              <Bar
                dataKey="todo"
                name="할 일"
                stackId="a"
                fill={CHART_COLORS.orange}
                radius={[2, 2, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
          <VelocityMemberTable rows={data} />
        </>
      )}
    </Card>
  );
}

const STATUS_PIE_COLORS: Record<TaskStatus, string> = {
  DONE: "#34d399",
  IN_PROGRESS: "#22d3ee",
  IN_REVIEW: "#a78bfa",
  TODO: "#475569",
  BLOCKED: "#f87171",
};

function statusRowsForLegend(tasks: ReturnType<typeof getActiveJiraTasks>) {
  const dist = statusDistributionFromTasks(tasks);
  return dist.map((d) => {
    const status = (Object.keys(STATUS_CONFIG) as TaskStatus[]).find(
      (k) => STATUS_CONFIG[k].label === d.name
    )!;
    return { ...d, status };
  });
}

export function StatusPieChart() {
  const tasks = getActiveJiraTasks();
  const legendRows = statusRowsForLegend(tasks);
  const pieData = legendRows.filter((d) => d.value > 0);
  const total = pieData.reduce((s, d) => s + d.value, 0);
  const empty = tasks.length === 0;

  return (
    <Card className={cn(ui.panelDense, "hover:translate-y-0")}>
      <SectionHeader dense title="태스크 상태 분포" subtitle={`전체 ${tasks.length}건`} />
      {empty ? (
        <AnalyticsEmpty className="min-h-[200px]" />
      ) : (
        <div className="flex min-h-[200px] items-center gap-2">
          <div className="w-[48%] shrink-0">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: "—", value: 1, fill: "#e2e8f0" }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {legendRows.map((item) => {
              const status =
                "status" in item && item.status
                  ? item.status
                  : ((Object.keys(STATUS_CONFIG) as TaskStatus[]).find(
                      (k) => STATUS_CONFIG[k].label === item.name
                    ) ?? "TODO");
              const cfg = STATUS_CONFIG[status];
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/15 px-2 py-1"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.fill }} />
                    <StatusBadge status="" color={cfg.color} bg={cfg.bg} label={item.name} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 tabular-nums text-[10px]">
                    <span className="font-bold text-foreground">{item.value}</span>
                    {total > 0 && <span className="text-muted-foreground">{pct}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
