import { STATUS_CONFIG, type TaskStatus } from "@/lib/index";
import type { ScrumTaskPickerItem } from "@/lib/scrum-backlog";
import { cn } from "@/lib/utils";

interface ScrumTaskPickerProps {
  tasks: ScrumTaskPickerItem[];
  selectedKeys: string[];
  onToggleTask: (taskKey: string) => void;
  emptyMessage?: string;
}

/** 진행 중 상태 라벨 — 딥블루 (STATUS_CONFIG.IN_PROGRESS.color 와 동일) */
const IN_PROGRESS_TEXT = STATUS_CONFIG.IN_PROGRESS.color;

/** 선택된 진행 중 이슈 — 박스 하이라이트 */
const IN_PROGRESS_SELECTED_UI = {
  row: "border-blue-600 bg-blue-100 ring-1 ring-blue-500/35 dark:border-blue-500 dark:bg-blue-900/50 dark:ring-blue-400/40",
  badge:
    "border border-blue-300/70 bg-blue-50/95 font-bold dark:border-blue-600/50 dark:bg-blue-950/55",
  key: "text-blue-900 dark:text-blue-100",
  summary: "font-medium text-slate-900 dark:text-slate-50",
  checkbox: "border-blue-800 bg-blue-800 text-white dark:border-blue-400 dark:bg-blue-600",
} as const;

function rowClassName(taskStatus: TaskStatus, selected: boolean): string {
  const base = "w-full rounded-md border px-2 py-1.5 text-left transition-colors";

  if (selected && taskStatus === "IN_PROGRESS") {
    return cn(base, IN_PROGRESS_SELECTED_UI.row);
  }

  if (selected) {
    return cn(
      base,
      "border-primary/45 bg-primary/10 dark:border-primary/50 dark:bg-primary/15"
    );
  }

  return cn(base, "border-transparent hover:bg-muted/50");
}

export function ScrumTaskPicker({
  tasks,
  selectedKeys,
  onToggleTask,
  emptyMessage = "진행 중인 담당 이슈가 없습니다. JIRA 동기화·배정을 확인하세요.",
}: ScrumTaskPickerProps) {
  if (tasks.length === 0) {
    return (
      <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
      {tasks.map(({ task, sprintName }) => {
        const selected = selectedKeys.includes(task.key);
        const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
        const inProgress = task.status === "IN_PROGRESS";
        const highlightInProgress = selected && inProgress;

        return (
          <li key={task.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleTask(task.key)}
              className={rowClassName(task.status, selected)}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                    selected
                      ? highlightInProgress
                        ? IN_PROGRESS_SELECTED_UI.checkbox
                        : "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent"
                  )}
                >
                  {selected ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-semibold",
                        highlightInProgress ? IN_PROGRESS_SELECTED_UI.key : "text-primary"
                      )}
                    >
                      {task.key}
                    </span>
                    {highlightInProgress ? (
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] leading-none",
                          IN_PROGRESS_SELECTED_UI.badge
                        )}
                        style={{ color: IN_PROGRESS_TEXT }}
                      >
                        {cfg.label}
                      </span>
                    ) : (
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-semibold leading-none"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    )}
                    <span
                      className="truncate text-[10px] text-muted-foreground"
                      title={sprintName}
                    >
                      {sprintName}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "block line-clamp-2 text-xs leading-snug",
                      highlightInProgress ? IN_PROGRESS_SELECTED_UI.summary : "text-foreground"
                    )}
                  >
                    {task.summary}
                  </span>
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
