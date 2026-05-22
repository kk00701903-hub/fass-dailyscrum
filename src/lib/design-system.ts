/**
 * Smart Scrum Monitoring design tokens (cyan primary, Grafana-style dark/light).
 */
import type { CSSProperties } from "react";

const transitionBase = "transition-colors duration-200 ease-in-out";

export const CHART_COLORS = {
  primary: "#22d3ee",
  purple: "#a78bfa",
  green: "#34d399",
  orange: "#fb923c",
  red: "#f87171",
  ideal: "#a78bfa",
} as const;

export function isDarkThemeActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Subtle surface border — light vs dark */
export function surfaceBorderStyle(): string {
  return isDarkThemeActive() ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)";
}

export function cardSurfaceStyle(): CSSProperties {
  const dark = isDarkThemeActive();
  return {
    background: "var(--card)",
    border: `1px solid ${surfaceBorderStyle()}`,
    boxShadow: dark
      ? "0 4px 24px -4px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)"
      : "0 1px 3px rgba(15,23,42,0.06)",
  };
}

export function navActiveStyle(): CSSProperties {
  return {
    background: "linear-gradient(90deg, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.04) 100%)",
    color: "var(--primary)",
    borderLeft: "2px solid var(--primary)",
  };
}

export function navInactiveStyle(): CSSProperties {
  return {
    background: "transparent",
    color: "var(--muted-foreground)",
    borderLeft: "2px solid transparent",
  };
}

export function primaryGradientStyle(): CSSProperties {
  return {
    background:
      "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, black) 100%)",
    color: "var(--primary-foreground)",
    boxShadow: "0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)",
  };
}

/** 데일리 스크럼 저장 — JIRA 동기화(primary)와 구분되는 에메랄드 톤 */
export function saveButtonStyle(): CSSProperties {
  return {
    background: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
    color: "#ffffff",
    boxShadow: "0 4px 12px rgba(52, 211, 153, 0.28)",
  };
}

export function connectionBadgeStyle(connected: boolean): CSSProperties {
  return connected
    ? {
        background: "rgba(34,211,238,0.1)",
        color: "var(--primary)",
        border: "1px solid rgba(34,211,238,0.25)",
      }
    : {
        background: "rgba(248,113,113,0.1)",
        color: "#f87171",
        border: "1px solid rgba(248,113,113,0.25)",
      };
}

export function getChartTooltipStyle(): CSSProperties {
  return isDarkThemeActive()
    ? {
        background: "#1e293b",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        color: "#e2e8f0",
        fontSize: "12px",
      }
    : {
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        color: "#0f172a",
        fontSize: "12px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
      };
}

export function chartGridStroke(): string {
  return isDarkThemeActive() ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
}

export function chartAxisTickFill(): string {
  return isDarkThemeActive() ? "#64748b" : "#94a3b8";
}

/** 업무 화면 밀도 (12px 기준, 표·그리드는 10–11px) */
export const ui = {
  page: "bg-background text-foreground text-xs leading-snug",
  card: `rounded-xl ${transitionBase}`,
  cardHeader: "border-b px-4 py-2.5",
  cardBody: "px-4 py-2.5",
  cardFooter: "border-t px-4 py-2 text-[10px] text-muted-foreground",
  kpiCard: `rounded-xl flex flex-col ${transitionBase}`,
  panel: "rounded-xl",
  panelDense: "rounded-xl p-3",
  pageHeader: "mb-2.5 flex flex-wrap items-center justify-between gap-2",
  title: "text-sm font-semibold tracking-tight text-foreground",
  subtitle: "text-[11px] text-muted-foreground",
  label: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
  muted: "text-[11px] text-muted-foreground",
  input: `h-8 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground shadow-xs placeholder:text-muted-foreground/60 ${transitionBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`,
  btnPrimary: `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${transitionBase} disabled:pointer-events-none disabled:opacity-50`,
  btnSecondary: `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground ${transitionBase} hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50`,
  badgeSuccess:
    "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400",
  badgeError:
    "inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400",
  badgeNeutral:
    "inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
  tableHead: "bg-muted/50 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
  tableRow: `border-b border-border ${transitionBase} hover:bg-muted/30`,
  dataTable: "w-full border-collapse text-xs",
  iconBox:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30",
  iconBoxSm: "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
  iconCyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  iconViolet: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  iconOrange: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  iconEmerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  iconAmber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  link: `inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 ${transitionBase} hover:underline`,
  memberCard: `flex items-center gap-2 rounded-lg border border-border bg-card/50 p-2.5 ${transitionBase} hover:bg-muted/20`,
  textarea: `min-h-[2.75rem] w-full resize-y rounded-lg border border-input bg-card px-3 py-2 font-sans text-xs leading-snug text-foreground placeholder:text-muted-foreground/60 ${transitionBase} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`,
  toggle: `relative h-5 w-9 cursor-pointer rounded-full ${transitionBase}`,
  toggleOn: "bg-primary",
  toggleOff: "bg-muted",
  toggleKnob: `absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm ${transitionBase}`,
  divider: "border-b border-border",
  sidebarDivider: "border-t",
} as const;

export function memberAvatarStyle(color: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `${color}25`, color };
}

export function deltaBadgeStyle(deltaType: "up" | "down"): CSSProperties {
  return deltaType === "up"
    ? { background: "rgba(52,211,153,0.12)", color: "#34d399" }
    : { background: "rgba(248,113,113,0.12)", color: "#f87171" };
}

export const sprintStatusBadge: Record<string, string> = {
  active: "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
  closed: "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
  future: "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
  other: "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
};
