import { useEffect, type RefObject } from "react";

/**
 * gantt-task-react 세로 스크롤 보강 — 좌측 리스트·우측 그리드·우측 VerticalScroll(scrollY) 동기화.
 * 그리드에서 직접 스크롤해도 우측 트랙·상대 패널이 함께 움직이도록 scroll 이벤트를 브로드캐스트한다.
 */
export function useWbsGanttVerticalScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    const listBody = root.querySelector<HTMLElement>("._3eULf > div:first-child ._2B2zv");
    const timelineBody = root.querySelector<HTMLElement>("._3eULf > div:nth-child(2) ._2B2zv");
    const verticalTrack = root.querySelector<HTMLElement>("._3eULf > ._1eT-t");
    if (!listBody || !timelineBody || !verticalTrack) return;

    const bodies = [listBody, timelineBody];
    let syncing = false;

    const clampScrollTop = (el: HTMLElement, top: number) =>
      Math.max(0, Math.min(top, Math.max(0, el.scrollHeight - el.clientHeight)));

    const publishScrollTop = (top: number, source?: HTMLElement) => {
      syncing = true;
      for (const el of bodies) {
        const next = clampScrollTop(el, top);
        if (el.scrollTop !== next) el.scrollTop = next;
      }
      const trackTop = clampScrollTop(verticalTrack, top);
      if (verticalTrack.scrollTop !== trackTop) {
        verticalTrack.scrollTop = trackTop;
      }
      syncing = false;

      if (source !== verticalTrack) {
        verticalTrack.dispatchEvent(new Event("scroll", { bubbles: false }));
      }
    };

    const onListScroll = () => {
      if (syncing) return;
      publishScrollTop(listBody.scrollTop, listBody);
    };

    const onTimelineScroll = () => {
      if (syncing) return;
      publishScrollTop(timelineBody.scrollTop, timelineBody);
    };

    const onTrackScroll = () => {
      if (syncing) return;
      syncing = true;
      publishScrollTop(verticalTrack.scrollTop, verticalTrack);
      syncing = false;
    };

    listBody.addEventListener("scroll", onListScroll, { passive: true });
    timelineBody.addEventListener("scroll", onTimelineScroll, { passive: true });
    verticalTrack.addEventListener("scroll", onTrackScroll, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            publishScrollTop(verticalTrack.scrollTop, verticalTrack);
          })
        : null;
    ro?.observe(listBody);

    return () => {
      listBody.removeEventListener("scroll", onListScroll);
      timelineBody.removeEventListener("scroll", onTimelineScroll);
      verticalTrack.removeEventListener("scroll", onTrackScroll);
      ro?.disconnect();
    };
  }, [rootRef, enabled]);
}
