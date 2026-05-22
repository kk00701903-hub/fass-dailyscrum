import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function EmptyState({
  message,
  className,
  skeleton = false,
}: {
  message: string
  className?: string
  skeleton?: boolean
}) {
  if (skeleton) {
    return (
      <div className={cn("space-y-2 py-2", className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    )
  }
  return (
    <p className={cn("py-6 text-center text-xs text-muted-foreground", className)}>{message}</p>
  )
}
