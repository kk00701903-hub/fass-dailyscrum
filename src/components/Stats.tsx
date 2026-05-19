/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricCard } from "@/lib/index";

interface StatCardProps extends MetricCard {
  icon?: React.ReactNode;
  iconBg?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaType,
  unit,
  description,
  icon,
  iconBg,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <motion.div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200",
              iconBg ?? "bg-slate-50"
            )}
          >
            {icon}
          </div>
        )}
      </motion.div>
      <div className="flex flex-wrap items-center gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              deltaType === "up"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            )}
          >
            {deltaType === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta}
          </span>
        )}
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </div>
    </motion.div>
  );
}

interface StatusBadgeProps {
  status: string;
  color: string;
  bg: string;
  label: string;
}

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
      {label}
    </span>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {children}
    </motion.div>
  );
}
