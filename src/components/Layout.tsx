/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  GitBranch,
  ClipboardList,
  Table2,
  BarChart3,
  Settings,
  RefreshCw,
  Bell,
  ChevronRight,
  Wifi,
  WifiOff,
  Palette,
} from "lucide-react";
import { ROUTES, TEAM_MEMBERS } from "@/lib/index";
import { formatSeoulDateTime } from "@/lib/jira-sync-schedule";
import { cn } from "@/lib/utils";
import { useJiraDailyScheduleSync } from "@/hooks/use-jira-daily-schedule-sync";
import { useJiraSyncStore } from "@/store/jiraSyncStore";
import { ui } from "@/lib/untitled-ui";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

const SIDEBAR_MEMBER_ONLINE: Record<string, boolean> = {
  seo: true,
  ki: true,
  kim: true,
  song: true,
  shim: true,
  oh: true,
  lee: false,
};

const NAV_ITEMS: { path: string; icon: React.ElementType; label: string; badge: string | null }[] = [
  { path: ROUTES.DASHBOARD, icon: LayoutDashboard, label: "대시보드", badge: null },
  { path: ROUTES.JIRA_SYNC, icon: GitBranch, label: "JIRA 동기화", badge: "Live" },
  { path: ROUTES.DAILY_SCRUM, icon: ClipboardList, label: "데일리 스크럼", badge: null },
  { path: ROUTES.SCRUM_HISTORY, icon: Table2, label: "스크럼 일지", badge: null },
  { path: ROUTES.ANALYTICS, icon: BarChart3, label: "애널리틱스", badge: null },
  { path: ROUTES.UI_PREVIEW, icon: Palette, label: "UI 미리보기", badge: "Lab" },
  { path: ROUTES.SETTINGS, icon: Settings, label: "설정", badge: null },
];

function navLinkUseEnd(path: string): boolean {
  if (path === "/") return true;
  return NAV_ITEMS.some((item) => item.path !== path && item.path.startsWith(`${path}/`));
}

export default function Layout() {
  useJiraDailyScheduleSync();

  const syncing = useJiraSyncStore((s) => s.syncing);
  const lastSyncAt = useJiraSyncStore((s) => s.lastSyncAt);
  const lastSyncSource = useJiraSyncStore((s) => s.lastSyncSource);
  const startSync = useJiraSyncStore((s) => s.startSync);
  const [connected, setConnected] = useState(true);
  const location = useLocation();

  const handleSync = () => {
    startSync("manual");
  };

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
      ?.label ?? "대시보드";

  const isJiraSyncPage = location.pathname === ROUTES.JIRA_SYNC;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <aside className="relative flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-gray-200 px-4 py-4">
          <img
            src={LOGO_SRC}
            alt="ScrumRadar"
            className="h-12 w-12 shrink-0 rounded-lg object-contain"
            width={48}
            height={48}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">ScrumRadar</p>
            <p className="truncate text-xs text-slate-500">데일리 스크럼 · 스프린트</p>
          </div>
        </div>

        <nav className="shrink-0 space-y-0.5 px-3 py-3">
          {NAV_ITEMS.map(({ path, icon: Icon, label, badge }) => (
            <NavLink key={path} to={path} end={navLinkUseEnd(path)}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className="rounded-full border border-gray-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-200 px-3 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            팀원
          </p>
          {TEAM_MEMBERS.map((m) => {
            const online = SIDEBAR_MEMBER_ONLINE[m.id] ?? true;
            const roleShort =
              m.role === "TFT 팀장" ? "TFT팀장" : m.role === "Backend" ? "BE" : m.role === "Frontend" ? "FE" : m.role;
            return (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1">
                <div className="relative">
                  <motion.div
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-slate-50 text-[10px] font-semibold text-slate-700"
                  >
                    {m.avatar}
                  </motion.div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white",
                      online ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  />
                </div>
                <span className="text-xs text-slate-700">{m.name}</span>
                <span className="ml-auto text-[10px] text-slate-400">{roleShort}</span>
              </div>
            );
          })}
        </div>
        <div className="min-h-0 flex-1" aria-hidden />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
            <p className="text-xs text-slate-500">마지막 동기화: {lastSyncLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConnected((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                connected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? "JIRA 연결됨" : "연결 끊김"}
            </button>

            {!isJiraSyncPage && (
              <button
                type="button"
                onClick={handleSync}
                className={cn(ui.btnPrimary, "h-9 px-3.5 text-xs")}
              >
                <motion.span
                  className="inline-flex items-center gap-1.5"
                  animate={{ rotate: syncing ? 360 : 0 }}
                  transition={{ duration: 0.8, repeat: syncing ? Infinity : 0, ease: "linear" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  JIRA 동기화
                </motion.span>
              </button>
            )}

            <button
              type="button"
              className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full min-h-0"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
