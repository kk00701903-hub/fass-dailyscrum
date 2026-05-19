/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */

/** Shared Tailwind class strings (Untitled UI Lite — Gray/Slate scale) */
export const ui = {
  page: "bg-slate-50 text-slate-900",
  card: "rounded-xl border border-gray-200 bg-white shadow-sm",
  cardHeader: "border-b border-gray-200 bg-white px-6 py-5",
  cardBody: "px-6 py-5",
  cardFooter: "border-t border-gray-200 bg-slate-50/50 px-6 py-3 text-xs text-slate-500",
  title: "text-lg font-semibold tracking-tight text-slate-900",
  subtitle: "text-sm text-slate-600",
  label: "text-xs font-medium text-slate-600",
  muted: "text-sm text-slate-500",
  input:
    "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-50",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:opacity-50",
  badgeSuccess: "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700",
  badgeError: "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700",
  badgeNeutral: "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600",
  tableHead: "bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
  tableRow: "border-b border-gray-100 transition-colors hover:bg-slate-50/50",
  iconBox: "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-slate-700",
  iconBoxSm: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
  iconCyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  iconViolet: "border-violet-200 bg-violet-50 text-violet-700",
  iconOrange: "border-orange-200 bg-orange-50 text-orange-700",
  iconEmerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  iconAmber: "border-amber-200 bg-amber-50 text-amber-700",
  link: "flex items-center gap-1 text-xs font-semibold text-slate-700 transition-colors hover:text-slate-900",
  memberCard: "flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-xs",
  textarea: "w-full min-h-[4.5rem] resize-y rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100",
  toggle: "relative h-5 w-10 cursor-pointer rounded-full transition-colors",
  toggleOn: "bg-slate-900",
  toggleOff: "bg-gray-200",
  toggleKnob: "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
  divider: "border-b border-gray-100",
} as const;

export function memberAvatarStyle(color: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `${color}20`, color };
}

export const sprintStatusBadge: Record<string, string> = {
  active: "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700",
  closed: "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600",
  future: "inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700",
  other: "inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-slate-600",
};
