import { useEffect, useState, type RefObject } from "react";
import { WBS_GANTT_CALENDAR_HEADER_HEIGHT } from "@/lib/jira-wbs-gantt-timeline";
import {
  formatWbsProjectWeekHeaderLabel,
  WBS_WEEK_HEADER_FULL_LABEL_MIN_PX,
} from "@/lib/wbs-project-week";
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
 * gantt-task-react Week 뷰 하단 주차 라벨 대체 — 0W/1W/… 프로젝트 주차 + 열 중앙 정렬.
 * Y좌표는 우측 타임라인 달력 헤더(68px) 기준 — 좌측 마일스톤 띠(24px)는 포함하지 않음.
 */
export function JiraWbsGanttWeekHeaderOverlay({
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

  if (weekColumnDates.length === 0) return null;

  return (
    <div
      className="wbs-gantt-week-header-layer pointer-events-none absolute z-[16] overflow-hidden"
      style={{
        left: `var(--wbs-list-min-width, ${listWidth}px)`,
        right: 0,
      }}
      aria-hidden
    >
      <div
        className="wbs-gantt-week-header-track flex h-full items-center justify-start"
        style={{
          width: svgWidth,
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        {weekColumnDates.map((date, index) => {
          const { label, title } = formatWbsProjectWeekHeaderLabel(date, columnWidth);
          return (
            <div
              key={`${date.getTime()}-${index}`}
              className={cn(
                "wbs-gantt-week-header-cell flex shrink-0 items-center justify-center",
                "text-center font-semibold leading-none tabular-nums",
                columnWidth < WBS_WEEK_HEADER_FULL_LABEL_MIN_PX ? "text-[8px]" : "text-[10px]",
                "text-slate-700 dark:text-slate-200"
              )}
              style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }}
              title={title}
            >
              <span className="block max-w-full truncate px-px">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
