import { useEffect, useState, type RefObject } from "react";
import type { Task } from "gantt-task-react";
import {
  WBS_GANTT_CALENDAR_HEADER_HEIGHT,
  WBS_GANTT_MILESTONE_LABEL_BAND,
  WBS_GANTT_ROW_HEIGHT,
  dateToTimelineX,
} from "@/lib/jira-wbs-gantt-timeline";
import type { WbsGanttMeta } from "@/lib/jira-wbs-gantt";

type Props = {
  rootRef: RefObject<HTMLDivElement | null>;
  displayTasks: Task[];
  metaByTaskId: Map<string, WbsGanttMeta>;
  dates: Date[];
  columnWidth: number;
  svgWidth: number;
  ganttHeight: number;
  listWidth: number;
};

const HEADER_H = WBS_GANTT_MILESTONE_LABEL_BAND + WBS_GANTT_CALENDAR_HEADER_HEIGHT;
const ROW_H = WBS_GANTT_ROW_HEIGHT;
/** 진행 바 높이 (px) */
const TRACK_H = 4;
/** 행 하단으로부터 진행 바까지 여백 (px) */
const BOTTOM_PAD = 4;

/**
 * 진행 중(active) 스프린트 각 행 하단에 얇은 진행률 바를 오버레이로 표시.
 * - 회색 트랙: 전체 스프린트 일정 범위
 * - 파란 진행 바: 오늘 기준 경과 비율
 */
export function JiraWbsGanttProgressOverlay({
  rootRef,
  displayTasks,
  metaByTaskId,
  dates,
  columnWidth,
  svgWidth,
  ganttHeight,
  listWidth,
}: Props) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // 가로 스크롤 요소
    const timelineEl = root.querySelector<HTMLElement>("._CZjuD");
    const hScrollEl = root.querySelector<HTMLElement>("._2k9Ys");
    // 세로 스크롤 요소 — 타임라인 본문 스크롤 컨테이너
    const vScrollEl = root.querySelector<HTMLElement>("._3eULf > div:nth-child(2) ._2B2zv");

    const readScroll = () => {
      const sl = timelineEl?.scrollLeft ?? hScrollEl?.scrollLeft ?? 0;
      setScrollLeft(sl);
      const st = vScrollEl?.scrollTop ?? 0;
      setScrollTop(st);
    };

    readScroll();
    timelineEl?.addEventListener("scroll", readScroll, { passive: true });
    hScrollEl?.addEventListener("scroll", readScroll, { passive: true });
    vScrollEl?.addEventListener("scroll", readScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(readScroll) : null;
    if (timelineEl) ro?.observe(timelineEl);

    return () => {
      timelineEl?.removeEventListener("scroll", readScroll);
      hScrollEl?.removeEventListener("scroll", readScroll);
      vScrollEl?.removeEventListener("scroll", readScroll);
      ro?.disconnect();
    };
  }, [rootRef, svgWidth]);

  const bars = displayTasks.flatMap((task, rowIndex) => {
    const meta = metaByTaskId.get(task.id);
    if (!meta || meta.kind !== "sprint" || meta.statusKind !== "active") return [];

    const progress = task.progress; // 0~100, 시간 경과 비율
    if (progress <= 0) return [];

    const startX = dateToTimelineX(task.start, dates, columnWidth);
    const endX = dateToTimelineX(task.end, dates, columnWidth);
    const trackW = Math.max(0, endX - startX);
    if (trackW <= 0) return [];

    const fillW = trackW * (progress / 100);
    const rowTop = HEADER_H + rowIndex * ROW_H;
    const barY = rowTop + ROW_H - BOTTOM_PAD - TRACK_H;

    return [{ id: task.id, startX, trackW, fillW, barY }];
  });

  if (bars.length === 0) return null;

  const svgHeight = HEADER_H + ganttHeight;

  return (
    <div
      className="pointer-events-none absolute z-[15]"
      style={{ left: listWidth, top: 0, right: 0, bottom: 0, overflow: "hidden" }}
      aria-hidden
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block shrink-0 overflow-visible"
        style={{ transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` }}
      >
        {bars.map(({ id, startX, trackW, fillW, barY }) => (
          <g key={`prog-${id}`}>
            {/* 전체 기간 트랙 */}
            <rect
              x={startX}
              y={barY}
              width={trackW}
              height={TRACK_H}
              rx={TRACK_H / 2}
              fill="rgba(148,163,184,0.35)"
            />
            {/* 경과 진행률 */}
            <rect
              x={startX}
              y={barY}
              width={fillW}
              height={TRACK_H}
              rx={TRACK_H / 2}
              fill="#3b82f6"
              opacity={0.9}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
