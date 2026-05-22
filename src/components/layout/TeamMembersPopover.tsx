import { Users } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/index";
import { surfaceBorderStyle } from "@/lib/design-system";
import { useSidebar } from "@/context/SidebarContext";
import { useTeamPresenceContext } from "@/context/TeamPresenceContext";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function roleShort(role: string): string {
  if (role === "TFT 팀장") return "TFT";
  if (role === "Backend") return "BE";
  if (role === "Frontend") return "FE";
  return role;
}

export function TeamMembersPopover() {
  const { collapsed } = useSidebar();
  const { isMemberOnline, onlineMemberIds, channelReady } = useTeamPresenceContext();
  const borderSubtle = surfaceBorderStyle();
  const onlineCount = TEAM_MEMBERS.filter((m) => isMemberOnline(m.id)).length;

  const trigger = (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-lg border text-xs font-medium transition-colors",
        "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        collapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
      )}
      style={{ borderColor: borderSubtle, color: "var(--foreground)" }}
      aria-label={`팀원 ${TEAM_MEMBERS.length}명 · 접속 ${onlineCount}`}
    >
      <Users className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
      {!collapsed ? (
        <>
          <span className="flex-1 text-left">팀원 {TEAM_MEMBERS.length}명</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(34,211,238,0.15)", color: "var(--primary)" }}
          >
            {channelReady ? `접속 ${onlineCount}` : "연결 중…"}
          </span>
        </>
      ) : null}
    </button>
  );

  return (
    <div
      className={cn("border-t py-2", collapsed ? "px-1.5" : "px-3")}
      style={{ borderColor: borderSubtle }}
    >
      <Popover>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              팀원 {TEAM_MEMBERS.length}명 · {channelReady ? `접속 ${onlineCount}` : "연결 중…"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        )}
        <PopoverContent
          side="top"
          align="start"
          className="w-56 max-h-64 overflow-y-auto p-2"
          style={{ borderColor: borderSubtle }}
        >
          <p
            className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            팀원 · 실시간 접속
          </p>
          <div className="space-y-0.5">
            {TEAM_MEMBERS.map((m) => {
              const online = isMemberOnline(m.id);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1 py-1.5 transition-opacity",
                    online ? "opacity-100" : "opacity-45",
                    !online && "hover:opacity-60"
                  )}
                >
                  <div className="relative shrink-0">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        background: `${m.color}25`,
                        color: m.color,
                        border: `1px solid ${m.color}40`,
                      }}
                    >
                      {m.avatar}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2",
                        online ? "bg-emerald-500 border-popover" : "bg-slate-500 border-popover"
                      )}
                      title={online ? "접속 중" : "오프라인"}
                      aria-hidden
                    />
                  </div>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[11px]",
                      online ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{roleShort(m.role)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 border-t border-border px-1 pt-2 text-[9px] text-muted-foreground">
            로그인 후 이 탭에서만 접속으로 표시됩니다. ({onlineMemberIds.size}명 온라인)
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
