import { STATUS_CONFIG, type TaskStatus } from "@/lib/index";
import {
  SCRUM_TASK_STATUS_FILTER_DEFAULT,
  SCRUM_TASK_STATUS_FILTER_ORDER,
} from "@/lib/scrum-backlog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface ScrumTaskStatusFilterProps {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  className?: string;
}

export function ScrumTaskStatusFilter({ value, onChange, className }: ScrumTaskStatusFilterProps) {
  const handleChange = (next: string) => {
    if (!next) return;
    onChange(next as TaskStatus);
  };

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={handleChange}
      variant="outline"
      size="sm"
      className={cn("flex flex-wrap justify-start gap-1", className)}
    >
      {SCRUM_TASK_STATUS_FILTER_ORDER.map((status) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <ToggleGroupItem
            key={status}
            value={status}
            aria-label={cfg.label}
            className="h-6 px-2 text-[10px] data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10"
          >
            {cfg.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
