import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  Table2,
  BarChart3,
  CalendarRange,
  Network,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { APP_LOGO_URL } from "@/lib/assets";
import { AppErrorBoundary } from "@/components/ErrorFallback";
import { InterfaceNotificationsPopover } from "@/components/layout/InterfaceNotificationsPopover";
import { ROUTES } from "@/lib/index";
import { useAuthStore } from "@/store/authStore";
import { formatSeoulDateTime } from "@/lib/jira-sync-schedule";
import { cn } from "@/lib/utils";
import { useJiraDailyScheduleSync } from "@/hooks/use-jira-daily-schedule-sync";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import {
  connectionBadgeStyle,
  navActiveStyle,
  navInactiveStyle,
  primaryGradientStyle,
  surfaceBorderStyle,
} from "@/lib/design-system";
import { hydrateTeamMemberPrefsFromSupabase } from "@/lib/team-member-preferences";
import { SprintSidebarCard } from "@/components/layout/SprintSidebarCard";
import { TeamMembersPopover } from "@/components/layout/TeamMembersPopover";
import { SidebarSelfPresence } from "@/components/layout/SidebarSelfPresence";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { TeamPresenceProvider } from "@/context/TeamPresenceContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS: { path: string; icon: React.ElementType; label: string; badge: string | null }[] = [
  { path: ROUTES.DAILY_SCRUM, icon: ClipboardList, label: "데일리 스크럼", badge: null },
  { path: ROUTES.SCRUM_HISTORY, icon: Table2, label: "스크럼 일지", badge: null },
  { path: ROUTES.JIRA_WBS, icon: CalendarRange, label: "JIRA WBS", badge: null },
  { path: ROUTES.JIRA_DEPENDENCIES, icon: Network, label: "JIRA 의존성", badge: null },
  { path: ROUTES.ANALYTICS, icon: BarChart3, label: "애널리틱스", badge: null },
  { path: ROUTES.SETTINGS, icon: Settings, label: "설정", badge: null },
];

function navLinkUseEnd(path: string): boolean {
  if (path === "/") return true;
  return NAV_ITEMS.some((item) => item.path !== path && item.path.startsWith(`${path}/`));
}

function AppShellInner() {
  useJiraDailyScheduleSync();
  const { collapsed, toggle } = useSidebar();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  useEffect(() => {
    hydrateAuth();
    void hydrateTeamMemberPrefsFromSupabase();
  }, [hydrateAuth]);

  const syncing = useJiraSyncStore((s) => s.syncing);
  const lastSyncAt = useJiraSyncStore((s) => s.lastSyncAt);
  const lastSyncSource = useJiraSyncStore((s) => s.lastSyncSource);
  const lastJiraError = useJiraSyncStore((s) => s.lastJiraError);
  const startSync = useJiraSyncStore((s) => s.startSync);
  const [connected, setConnected] = useState(true);
  const location = useLocation();

  const lastSyncLabel =
    lastSyncAt != null
      ? `${formatSeoulDateTime(lastSyncAt)}${
          lastSyncSource === "schedule" ? " · 자동" : lastSyncSource === "manual" ? " · 수동" : ""
        }`
      : "—";

  const pageTitle =
    [...NAV_ITEMS]
      .sort((a, b) => b.path.length - a.path.length)
      .find((n) => location.pathname === n.path || location.pathname.startsWith(`${n.path}/`))
      ?.label ?? "데일리 스크럼";

  const borderSubtle = surfaceBorderStyle();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--background)" }}>
      <aside
        className={cn(
          "relative flex flex-shrink-0 flex-col border-r transition-[width] duration-200 ease-out",
          collapsed ? "w-[3.75rem]" : "w-60"
        )}
        style={{ background: "var(--sidebar)", borderColor: borderSubtle }}
      >
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "absolute -right-3 top-[4.25rem] z-30 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          )}
          style={{ borderColor: borderSubtle }}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5 text-foreground" />
          )}
        </button>

        <div
          className={cn(
            "flex items-center border-b",
            collapsed ? "justify-center px-2 py-4" : "gap-3 px-5 py-5"
          )}
          style={{ borderColor: borderSubtle }}
        >
          <img
            src={APP_LOGO_URL}
            alt="ScrumRadar"
            className={cn(
              "shrink-0 rounded-xl border border-border/60 bg-card object-contain p-0.5",
              collapsed ? "h-9 w-9" : "h-[54px] w-[54px]"
            )}
          />
          {!collapsed ? (
            <div className="min-w-0">
              <div
                className="truncate text-xs font-bold tracking-tight"
                style={{ color: "var(--foreground)" }}
              >
                ScrumRadar
              </div>
              <div className="truncate text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                데일리 스크럼 · 스프린트
              </div>
            </div>
          ) : null}
        </div>

        <SprintSidebarCard />

        <nav
          className={cn(
            "flex-1 space-y-0.5 overflow-y-auto py-2",
            collapsed ? "px-1.5" : "px-2"
          )}
        >
          {NAV_ITEMS.map(({ path, icon: Icon, label, badge }) => (
            <NavLink key={path} to={path} end={navLinkUseEnd(path)}>
              {({ isActive }) => {
                const link = (
                  <motion.div
                    whileHover={collapsed ? { scale: 1.04 } : { x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "flex cursor-pointer items-center rounded-lg text-xs font-medium transition-colors",
                      collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
                    )}
                    style={isActive ? navActiveStyle() : navInactiveStyle()}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="flex-1">{label}</span>
                        {badge ? (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: "rgba(34,211,238,0.2)", color: "var(--primary)" }}
                          >
                            {badge}
                          </span>
                        ) : null}
                        {isActive ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
                      </>
                    ) : null}
                  </motion.div>
                );

                if (!collapsed) return link;

                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              }}
            </NavLink>
          ))}
        </nav>

        <TeamMembersPopover />

        {authUser ? (
          <div className="border-t" style={{ borderColor: borderSubtle }}>
            <SidebarSelfPresence />
            <div className={cn("pb-3", collapsed ? "px-1.5" : "px-3")}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center rounded-lg border p-2 transition-colors hover:bg-muted/30"
                      style={{ borderColor: borderSubtle, color: "var(--foreground)" }}
                      onClick={() => {
                        logout();
                        navigate(ROUTES.LOGIN);
                      }}
                      aria-label="로그아웃"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    로그아웃
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/30"
                  )}
                  style={{ borderColor: borderSubtle, color: "var(--foreground)" }}
                  onClick={() => {
                    logout();
                    navigate(ROUTES.LOGIN);
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  로그아웃
                </button>
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 md:px-6"
          style={{ borderColor: borderSubtle, background: "var(--background)" }}
        >
          <div className="min-w-0">
            <h1 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              {pageTitle}
            </h1>
            <p className="flex flex-wrap items-center gap-x-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span>마지막 동기화: {lastSyncLabel}</span>
              {lastJiraError ? (
                <span className="font-medium text-red-600 dark:text-red-400">· 동기화 오류</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConnected((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
              style={connectionBadgeStyle(connected)}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? "JIRA 연결됨" : "연결 끊김"}
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={syncing}
              onClick={() => startSync("manual")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              style={primaryGradientStyle()}
            >
              <motion.span
                animate={{ rotate: syncing ? 360 : 0 }}
                transition={{ duration: 0.8, repeat: syncing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </motion.span>
              {syncing ? "동기화 중…" : "JIRA 동기화"}
            </motion.button>
            <InterfaceNotificationsPopover />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full min-h-0"
            >
              <AppErrorBoundary compact>
                <Outlet />
              </AppErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      </div>
    </TooltipProvider>
  );
}

export function AppShell() {
  return (
    <TeamPresenceProvider>
      <SidebarProvider>
        <AppShellInner />
      </SidebarProvider>
    </TeamPresenceProvider>
  );
}
