import { useAuthStore } from "@/store/authStore";
import { useSidebar } from "@/context/SidebarContext";
import { useTeamPresenceContext } from "@/context/TeamPresenceContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SidebarSelfPresence() {
  const { collapsed } = useSidebar();
  const user = useAuthStore((s) => s.user);
  const { tracking, channelReady } = useTeamPresenceContext();

  if (!user) return null;

  const label = tracking
    ? "접속 중 · 팀원 목록에 표시"
    : channelReady
      ? "접속 등록 중…"
      : "Realtime 연결 대기";

  const box = (
    <div
      className={cn(
        "mb-2 flex items-center rounded-lg border border-border/60 bg-muted/20",
        collapsed ? "mx-1.5 justify-center px-2 py-2" : "mx-3 gap-2 px-2.5 py-2"
      )}
      title={collapsed ? undefined : "Supabase Realtime Presence"}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          tracking ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/50"
        )}
        aria-hidden
      />
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium text-foreground">{user.displayName}</p>
          <p className="text-[9px] text-muted-foreground">{label}</p>
        </div>
      ) : null}
    </div>
  );

  if (!collapsed) return box;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{box}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        <p className="font-medium">{user.displayName}</p>
        <p className="text-muted-foreground">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
