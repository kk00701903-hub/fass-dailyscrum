import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { MetricCard } from "@/lib/index";
import { cardSurfaceStyle, deltaBadgeStyle } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface StatCardProps extends MetricCard {
  icon?: React.ReactNode;
  iconBg?: string;
  variant?: "default" | "dense";
  /** dense KPI 행 등 세로 높이 ~20% 확대 */
  tall?: boolean;
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
  variant = "default",
  tall = false,
}: StatCardProps) {
  const dense = variant === "dense";
  const denseTall = dense && tall;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "flex flex-col rounded-xl",
        denseTall ? "min-h-[5.5rem] gap-2.5 p-3.5" : dense ? "gap-2 p-3" : "gap-3 p-4"
      )}
      style={cardSurfaceStyle()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "font-medium uppercase tracking-widest",
              dense ? "text-[10px]" : "text-xs"
            )}
            style={{ color: "var(--muted-foreground)" }}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-1 font-bold tabular-nums",
              denseTall ? "text-2xl" : dense ? "text-xl" : "text-2xl"
            )}
            style={{ color: "var(--foreground)" }}
          >
            {value}
            {unit && (
              <span
                className={cn("ml-1 font-normal", dense ? "text-xs" : "text-sm")}
                style={{ color: "var(--muted-foreground)" }}
              >
                {unit}
              </span>
            )}
          </p>
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: iconBg ?? "rgba(34,211,238,0.12)" }}
          >
            {icon}
          </div>
        )}
      </div>
      {(delta || description) && (
        <div className="flex flex-wrap items-center gap-2">
          {delta && deltaType && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={deltaBadgeStyle(deltaType)}
            >
              {deltaType === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {delta}
            </span>
          )}
          {description && (
            <span className={cn("text-xs", dense && "text-[10px]")} style={{ color: "var(--muted-foreground)" }}>
              {description}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

interface StatusBadgeProps {
  status: string;
  color: string;
  bg: string;
  label: string;
}

export function StatusBadge({ color, bg, label }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, background: bg }}
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  dense?: boolean;
}

export function SectionHeader({ title, subtitle, action, dense = false }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", dense ? "mb-2" : "mb-4")}>
      <div className="min-w-0">
        <h2
          className={cn("font-bold", dense ? "text-sm" : "text-base")}
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={cn("mt-0.5", dense ? "text-[10px]" : "text-xs")}
            style={{ color: "var(--muted-foreground)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("rounded-xl", className)} style={{ ...cardSurfaceStyle(), ...style }}>
      {children}
    </div>
  );
}

export { SectionHeader as PageSectionHeader };
