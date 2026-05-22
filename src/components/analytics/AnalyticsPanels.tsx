/**
 * @license
 * Analytics dense list panels (recent tasks, blockers).
 */
import { Flame } from "lucide-react";
import { Card, SectionHeader, StatusBadge } from "@/components/Stats";
import { AnalyticsEmpty } from "@/components/analytics/AnalyticsEmpty";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { blockersFromJiraTasks } from "@/lib/jira-live-data";
import { STATUS_CONFIG, type Blocker } from "@/lib/index";
import { displayText } from "@/lib/display-text";
import { memberAvatarStyle, ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

const BLOCKER_TINT: Record<Blocker["severity"], string> = {
  critical: "border-red-300/80 bg-red-50/90",
  high: "border-orange-300/80 bg-orange-50/90",
  medium: "border-amber-200/80 bg-amber-50/80",
  low: "border-slate-200/80 bg-slate-50/90",
};

export function AnalyticsRecentTasks() {
  const tasks = getActiveJiraTasks();
  const list = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Card
      className={cn(
        ui.panelDense,
        "flex max-h-[22rem] min-h-[16rem] flex-col overflow-hidden hover:translate-y-0 lg:h-full lg:max-h-[22rem]"
      )}
    >
      <div className="shrink-0">
        <SectionHeader dense title="최근 태스크" subtitle="JIRA 동기화" />
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-y-contain",
          "pr-0.5 [scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35",
          "[&::-webkit-scrollbar-track]:bg-transparent"
        )}
      >
        {list.length === 0 ? (
          <AnalyticsEmpty className="min-h-[120px] border-0 bg-transparent" />
        ) : (
          list.map((task) => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 border-b border-border/45 py-2 last:border-0",
                  ui.tableRow
                )}
              >
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                  {displayText(task.key)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {displayText(task.summary)}
                </span>
                <StatusBadge status={task.status} color={cfg.color} bg={cfg.bg} label={cfg.label} />
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                  style={memberAvatarStyle(task.assignee.color)}
                >
                  {task.assignee.avatar}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export function AnalyticsBlockerFeed() {
  const tasks = getActiveJiraTasks();
  const blockers = blockersFromJiraTasks(tasks);

  return (
    <Card
      className={cn(
        ui.panelDense,
        "flex max-h-[22rem] min-h-[16rem] flex-col overflow-hidden hover:translate-y-0 lg:h-full lg:max-h-[22rem]"
      )}
    >
      <div className="shrink-0">
        <SectionHeader
          dense
          title="병목 구간"
          subtitle={`${blockers.length}건 BLOCKED`}
        />
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-0.5",
          "[scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35",
          "[&::-webkit-scrollbar-track]:bg-transparent"
        )}
      >
        {blockers.length === 0 ? (
          <AnalyticsEmpty className="min-h-[120px] border-0 bg-transparent">
            BLOCKED 이슈가 없습니다
          </AnalyticsEmpty>
        ) : (
          blockers.map((bl) => (
            <div
              key={bl.id}
              className={cn(
                "rounded-lg border p-2.5 transition-colors hover:shadow-sm",
                BLOCKER_TINT[bl.severity]
              )}
            >
              <div className="flex items-start gap-2">
                <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-foreground">{displayText(bl.description)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{displayText(bl.reportedBy.name)}</span>
                    {bl.relatedTask && (
                      <span className="font-mono">{displayText(bl.relatedTask)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
