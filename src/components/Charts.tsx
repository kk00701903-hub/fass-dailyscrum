/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, SectionHeader } from "@/components/Stats";
import {
  burndownFromTasks,
  memberVelocityFromTasks,
  statusDistributionFromTasks,
} from "@/lib/jira-live-data";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";

const CHART_COLORS = { primary: "#0f172a", purple: "#6366f1", green: "#10b981" };

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  color: "#0f172a",
  fontSize: "12px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

function EmptyChart({ message }: { message: string }) {
  return <p className="py-12 text-center text-xs text-slate-500">{message}</p>;
}

export function BurndownChart() {
  const data = burndownFromTasks(getActiveJiraTasks());
  return (
    <Card className="p-6">
      <SectionHeader title="번다운 차트" subtitle="JIRA 동기화 · 잔여 SP" />
      {data.length === 0 ? (
        <EmptyChart message="JIRA 이슈 동기화 후 표시됩니다." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRemaining" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="remaining"
              name="잔여 SP"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill="url(#gradRemaining)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function VelocityChart() {
  const data = memberVelocityFromTasks(getActiveJiraTasks());
  return (
    <Card className="p-6">
      <SectionHeader title="팀원별 진행 현황" subtitle="스토리 포인트 기준" />
      {data.length === 0 ? (
        <EmptyChart message="JIRA 이슈 동기화 후 표시됩니다." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "#64748b" }} />
            <Bar dataKey="completed" name="완료" stackId="a" fill={CHART_COLORS.green} />
            <Bar dataKey="inProgress" name="진행 중" stackId="a" fill={CHART_COLORS.purple} />
            <Bar dataKey="todo" name="할 일" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function StatusPieChart() {
  const tasks = getActiveJiraTasks();
  const data = statusDistributionFromTasks(tasks);
  return (
    <Card className="p-6">
      <SectionHeader title="태스크 상태 분포" subtitle={`전체 ${tasks.length}건`} />
      {data.length === 0 ? (
        <EmptyChart message="JIRA 이슈 동기화 후 표시됩니다." />
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={180}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
                  <span className="text-xs text-slate-500">{item.name}</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
