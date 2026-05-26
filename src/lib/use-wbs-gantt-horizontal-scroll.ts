import { useEffect, type RefObject } from "react";

/**
 * gantt-task-react 가로 스크롤 보강 — 하단 트랙(_2k9Ys) ↔ 타임라인(_CZjuD) scrollLeft 동기화.
 * CSS flex 수축으로 scrollWidth가 줄어드는 경우에도 헤더·바디·오버레이가 함께 이동한다.
 */
export function useWbsGanttHorizontalScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  /** Gantt remount 시 DOM·리스너 재바인딩 */
  remountKey?: string
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    const timeline = root.querySelector<HTMLElement>("._CZjuD");
    const hScroll = root.querySelector<HTMLElement>("._2k9Ys");
    if (!timeline || !hScroll) return;

    let syncing = false;

    const applyTimelineScroll = (left: number) => {
      const max = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
      const next = Math.max(0, Math.min(left, max));
      if (timeline.scrollLeft !== next) {
        timeline.scrollLeft = next;
      }
    };

    const syncFromBar = () => {
      if (syncing) return;
      syncing = true;
      applyTimelineScroll(hScroll.scrollLeft);
      syncing = false;
    };

    const syncFromTimeline = () => {
      if (syncing) return;
      syncing = true;
      if (hScroll.scrollLeft !== timeline.scrollLeft) {
        hScroll.scrollLeft = timeline.scrollLeft;
      }
      syncing = false;
    };

    syncFromBar();
    hScroll.addEventListener("scroll", syncFromBar, { passive: true });
    timeline.addEventListener("scroll", syncFromTimeline, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            applyTimelineScroll(hScroll.scrollLeft);
          })
        : null;
    ro?.observe(timeline);
    ro?.observe(hScroll);

    return () => {
      hScroll.removeEventListener("scroll", syncFromBar);
      timeline.removeEventListener("scroll", syncFromTimeline);
      ro?.disconnect();
    };
  }, [rootRef, enabled, remountKey]);
}
