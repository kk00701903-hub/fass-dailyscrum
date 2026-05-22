import { cn } from "@/lib/utils";

export function AnalyticsEmpty({
  className,
  children = "JIRA 동기화 후 표시됩니다",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 text-center text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
