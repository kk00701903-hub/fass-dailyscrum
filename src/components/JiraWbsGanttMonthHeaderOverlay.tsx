import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  formatWbsGanttMonthHeaderLabel,
  groupWeekColumnDatesByCalendarMonth,
} from "@/lib/jira-wbs-gantt-timeline";
import { cn } from "@/lib/utils";

type Props = {
  rootRef: RefObject<HTMLDivElement | null>;
  listWidth: number;
  calendarHeaderHeight?: number;
  weekColumnDates: Date[];
  columnWidth: number;
  svgWidth: number;
};

/**
 * gantt-task-react Week 뷰 상단 월 라벨 대체 — weekCalendarMonth 기준 열 폭과 정렬
 */
export function JiraWbsGanttMonthHeaderOverlay({
  rootRef,
  listWidth,
  calendarHeaderHeight = WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  weekColumnDates,
  columnWidth,
  svgWidth,
}: Props) {
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const timelineEl = root.querySelector<HTMLElement>("._CZjuD");
    const hScrollEl = root.querySelector<HTMLElement>("._2k9Ys");

    const readScroll = () => {
      setScrollLeft(timelineEl?.scrollLeft ?? hScrollEl?.scrollLeft ?? 0);
    };

    readScroll();
    timelineEl?.addEventListener("scroll", readScroll, { passive: true });
    hScrollEl?.addEventListener("scroll", readScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(readScroll) : null;
    if (timelineEl) ro?.observe(timelineEl);

    return () => {
      timelineEl?.removeEventListener("scroll", readScroll);
      hScrollEl?.removeEventListener("scroll", readScroll);
      ro?.disconnect();
    };
  }, [rootRef, weekColumnDates.length, svgWidth, columnWidth]);

  const monthGroups = useMemo(
    () => groupWeekColumnDatesByCalendarMonth(weekColumnDates),
    [weekColumnDates]
  );

  if (monthGroups.length === 0) return null;

  return (
    <div
      className="wbs-gantt-month-header-layer pointer-events-none absolute z-[18] overflow-hidden"
      style={{
        left: `var(--wbs-list-min-width, ${listWidth}px)`,
        right: 0,
      }}
      aria-hidden
    >
      <div
        className="wbs-gantt-month-header-track flex h-full items-center justify-start"
        style={{
          width: svgWidth,
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        {monthGroups.map((g) => (
          <div
            key={`${g.year}-${g.month}`}
            className={cn(
              "wbs-gantt-month-header-cell flex shrink-0 items-center justify-center",
              "border-r border-[var(--wbs-border,#cbd5e1)] text-center text-[10px] font-semibold leading-tight tracking-tight",
              "text-slate-700 dark:text-slate-200"
            )}
            style={{
              width: g.weekCount * columnWidth,
              minWidth: g.weekCount * columnWidth,
              maxWidth: g.weekCount * columnWidth,
            }}
            title={formatWbsGanttMonthHeaderLabel(g.year, g.month)}
          >
            <span className="block max-w-full truncate px-0.5">
              {formatWbsGanttMonthHeaderLabel(g.year, g.month)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
