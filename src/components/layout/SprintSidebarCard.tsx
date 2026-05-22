import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { taskIsAssignedToMember } from "@/lib/scrum-backlog";
import type { Sprint } from "@/lib/index";
import {
  getMemberSidebarActiveSprintId,
  getMemberSidebarSprints,
  SCRUM_SPRINT_PREFS_EVENT,
  setMemberSidebarActiveSprintId,
} from "@/lib/scrum-sprint-preferences";
import { useAuthStore } from "@/store/authStore";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { useSidebar } from "@/context/SidebarContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function daysUntil(endDate: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate.slice(0, 10));
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function sprintCardMetrics(sprint: Sprint, memberId: string) {
  const tasks = getActiveJiraTasks().filter(
    (t) => t.sprintId === sprint.id && taskIsAssignedToMember(t, memberId)
  );
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const d = sprint.endDate ? daysUntil(sprint.endDate) : null;
  const dLabel = d == null ? "—" : d > 0 ? `D-${d}` : d === 0 ? "D-Day" : `D+${Math.abs(d)}`;
  return { progressPct, dLabel, isActive: sprint.state === "active" };
}

function SprintCardBody({ sprint, memberId }: { sprint: Sprint; memberId: string }) {
  const { progressPct, dLabel, isActive } = sprintCardMetrics(sprint, memberId);
  const endLabel = sprint.endDate
    ? `${sprint.endDate.slice(0, 10)} 마감`
    : "종료일 미정";

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-xs font-semibold leading-snug" style={{ color: "var(--primary)" }}>
          {sprint.name}
          {isActive ? " · 진행 중" : ""}
        </span>
        {isActive && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(34,211,238,0.2)", color: "var(--primary)" }}
          >
            ACTIVE
          </span>
        )}
      </div>
      <div className="mb-2 text-[11px] leading-snug" style={{ color: "var(--muted-foreground)" }}>
        {endLabel}
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ background: "var(--primary)" }}
        />
      </div>
      <div
        className="mt-1 flex justify-between text-[10px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span>{progressPct}% 완료</span>
        <span>{dLabel}</span>
      </div>
    </>
  );
}

const cardShellClass = "mx-3 mt-3 mb-1 rounded-lg p-3";
const cardShellStyle = {
  background: "rgba(34,211,238,0.07)",
  border: "1px solid rgba(34,211,238,0.15)",
};

export function SprintSidebarCard() {
  const { collapsed } = useSidebar();
  const memberId = useAuthStore((s) => s.user?.memberId ?? "");
  const lastJiraDataAt = useJiraSyncStore((s) => s.lastSyncAt);
  const activeSprintId = useSyncExternalStore(
    (cb) => {
      window.addEventListener(SCRUM_SPRINT_PREFS_EVENT, cb);
      return () => window.removeEventListener(SCRUM_SPRINT_PREFS_EVENT, cb);
    },
    () => (memberId ? getMemberSidebarActiveSprintId(memberId) : ""),
    () => ""
  );

  const sprints = useMemo(
    () => (memberId ? getMemberSidebarSprints(memberId) : []),
    [memberId, activeSprintId, lastJiraDataAt]
  );

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [slideIndex, setSlideIndex] = useState(0);

  const onCarouselSelect = useCallback(() => {
    if (!carouselApi || !memberId) return;
    const idx = carouselApi.selectedScrollSnap();
    setSlideIndex(idx);
    const sprint = sprints[idx];
    if (sprint && sprint.id !== activeSprintId) {
      setMemberSidebarActiveSprintId(memberId, sprint.id);
    }
  }, [carouselApi, sprints, activeSprintId, memberId]);

  useEffect(() => {
    if (!carouselApi) return;
    onCarouselSelect();
    carouselApi.on("select", onCarouselSelect);
    carouselApi.on("reInit", onCarouselSelect);
    return () => {
      carouselApi.off("select", onCarouselSelect);
      carouselApi.off("reInit", onCarouselSelect);
    };
  }, [carouselApi, onCarouselSelect]);

  useEffect(() => {
    if (!carouselApi || sprints.length === 0) return;
    const idx = Math.max(
      0,
      sprints.findIndex((s) => s.id === activeSprintId)
    );
    if (carouselApi.selectedScrollSnap() !== idx) {
      carouselApi.scrollTo(idx, true);
    }
    setSlideIndex(idx);
  }, [carouselApi, activeSprintId, sprints]);

  const activeSprint = sprints.find((s) => s.id === activeSprintId) ?? sprints[0];

  if (collapsed) {
    const title =
      !memberId
        ? "로그인 후 표시"
        : sprints.length === 0
          ? "담당 스프린트 없음"
          : (activeSprint?.name ?? "스프린트");

    const iconButton = (
      <button
        type="button"
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted/30"
        style={{
          borderColor: "rgba(34,211,238,0.25)",
          color: "var(--primary)",
        }}
        aria-label={title}
      >
        <CalendarRange className="h-4 w-4" />
      </button>
    );

    if (!memberId || sprints.length === 0) {
      return (
        <div className="flex justify-center px-1.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>{iconButton}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {title}
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }

    return (
      <div className="flex justify-center px-1.5 py-2">
        <Popover>
          <PopoverTrigger asChild>{iconButton}</PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-56 p-3 text-xs">
            {activeSprint ? (
              <SprintCardBody sprint={activeSprint} memberId={memberId} />
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (!memberId) {
    return (
      <div
        className={cardShellClass}
        style={{
          background: "rgba(34,211,238,0.05)",
          border: "1px solid rgba(34,211,238,0.12)",
        }}
      >
        <span style={{ color: "var(--muted-foreground)" }} className="text-xs">
          로그인 후 내 스프린트 표시
        </span>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div
        className={cardShellClass}
        style={{
          background: "rgba(34,211,238,0.05)",
          border: "1px solid rgba(34,211,238,0.12)",
        }}
      >
        <span style={{ color: "var(--muted-foreground)" }} className="text-xs">
          내 담당 진행 스프린트 없음
        </span>
      </div>
    );
  }

  if (sprints.length === 1) {
    return (
      <div className={cardShellClass} style={cardShellStyle}>
        <SprintCardBody sprint={sprints[0]!} memberId={memberId} />
      </div>
    );
  }

  return (
    <div className="mx-3 mt-3 mb-1">
      <Carousel
        setApi={setCarouselApi}
        opts={{ align: "start", loop: false }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {sprints.map((sprint) => (
            <CarouselItem key={sprint.id} className="basis-full pl-0">
              <div className={cn(cardShellClass, "mx-0 mt-0")} style={cardShellStyle}>
                <SprintCardBody sprint={sprint} memberId={memberId} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-1.5 flex items-center justify-center gap-2 px-1">
        <button
          type="button"
          aria-label="이전 스프린트"
          disabled={slideIndex <= 0}
          onClick={() => carouselApi?.scrollPrev()}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5">
          {sprints.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${s.name} 보기`}
              onClick={() => carouselApi?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === slideIndex ? "w-3 bg-primary" : "w-1.5 bg-muted-foreground/35"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="다음 스프린트"
          disabled={slideIndex >= sprints.length - 1}
          onClick={() => carouselApi?.scrollNext()}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
