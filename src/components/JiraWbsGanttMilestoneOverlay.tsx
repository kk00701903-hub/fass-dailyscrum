import { useEffect, useState, type RefObject } from "react";
import {
  WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  WBS_GANTT_MILESTONE_LABEL_BAND,
  type WbsMilestoneGuide,
} from "@/lib/jira-wbs-gantt-timeline";
import { cn } from "@/lib/utils";

type Props = {
  rootRef: RefObject<HTMLDivElement | null>;
  guides: WbsMilestoneGuide[];
  listWidth: number;
  milestoneBand?: number;
  calendarHeaderHeight?: number;
  bodyHeight: number;
  svgWidth: number;
  scrollbarReserve: number;
};

/**
 * 마일스톤 라벨: 좌측 메타 상단 띠 + 우측 라벨 띠.
 * 세로 기준선: 타임라인 최상단(y=0)부터 차트 하단까지 — 년/월·주차 헤더 관통.
 */
export function JiraWbsGanttMilestoneOverlay({
  rootRef,
  guides,
  listWidth,
  milestoneBand = WBS_GANTT_MILESTONE_LABEL_BAND,
  calendarHeaderHeight = WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  bodyHeight,
  svgWidth,
  scrollbarReserve,
}: Props) {
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const timelineEl = root.querySelector<HTMLElement>("._CZjuD");
    const hScrollEl = root.querySelector<HTMLElement>("._2k9Ys");

    const readScroll = () => {
      const sl = timelineEl?.scrollLeft ?? hScrollEl?.scrollLeft ?? 0;
      setScrollLeft(sl);
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
  }, [rootRef, guides, svgWidth]);

  if (guides.length === 0) return null;

  /** wbs-gantt-root 기준 — 마일스톤 띠(24) + 달력 2단(68) + 본문 */
  const lineStartY = 0;
  const headerStackHeight = milestoneBand + calendarHeaderHeight;
  const svgHeight = headerStackHeight + bodyHeight;

  return (
    <>
      {/* 좌측 메타 마일스톤 spacer만 — 우측 달력 월/주 행을 가리지 않음 */}
      <div
        className="pointer-events-none absolute top-0 z-[20] border-b border-[var(--wbs-border,#cbd5e1)] bg-[var(--wbs-header-bg)]"
        style={{ left: 0, width: listWidth, height: milestoneBand }}
        aria-hidden
      />

      {/* 마일스톤 라벨 — 월/주 헤더보다 위 */}
      <div
        className="wbs-milestone-label-band pointer-events-none absolute z-[21] overflow-hidden border-b border-[var(--wbs-border,#cbd5e1)] bg-[var(--wbs-header-bg)]"
        style={{
          left: listWidth,
          top: 0,
          right: 0,
          height: milestoneBand,
        }}
        aria-hidden
      >
        <div
          className="relative h-full"
          style={{
            width: svgWidth,
            transform: `translateX(${-scrollLeft}px)`,
          }}
        >
          {guides.map((m) => (
            <span
              key={`${m.id}-label`}
              className="wbs-milestone-label absolute left-0 top-1 max-w-[min(12rem,40vw)] -translate-x-1/2 truncate px-0.5 text-[10px] font-bold leading-tight"
              style={{ left: m.x, color: m.badgeText }}
              title={m.label}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* 세로 기준선 — 년/월·주차 헤더 위(z-19), 라벨(z-21) 아래 */}
      <div
        className="wbs-milestone-guide-lines pointer-events-none absolute z-[19]"
        style={{
          left: listWidth,
          top: 0,
          right: 0,
          bottom: scrollbarReserve,
          overflow: "visible",
        }}
        aria-hidden
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          className={cn("block shrink-0 overflow-visible", "wbs-milestone-overlay")}
          style={{ transform: `translateX(${-scrollLeft}px)` }}
        >
          {guides.map((m) => (
            <line
              key={`${m.id}-line`}
              x1={m.x}
              x2={m.x}
              y1={lineStartY}
              y2={svgHeight}
              stroke={m.lineColor}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.9}
              className="wbs-milestone-guide-line"
            />
          ))}
        </svg>
      </div>
    </>
  );
}
