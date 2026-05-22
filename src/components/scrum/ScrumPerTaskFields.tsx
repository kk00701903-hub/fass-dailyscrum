import type { JiraTask } from "@/lib/index";
import type { ScrumTaskTextMap } from "@/lib/scrum-task-fields";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

const scrumFieldDisabledClass =
  "cursor-not-allowed opacity-50 bg-muted/30 pointer-events-none";

export function ScrumPerTaskFields({
  icon,
  title,
  hint,
  taskKeys,
  tasksByKey,
  values,
  onChange,
  action,
  disabled = false,
  emptyMessage = "좌측에서 담당 이슈를 먼저 선택하세요",
}: {
  icon: string;
  title: string;
  hint?: string;
  taskKeys: string[];
  tasksByKey: Map<string, JiraTask>;
  values: ScrumTaskTextMap;
  onChange: (issueKey: string, value: string) => void;
  action?: React.ReactNode;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex shrink-0 items-center justify-between gap-1.5">
        <label className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <span>{icon}</span>
          {title}
          {hint && <span className="truncate font-normal text-muted-foreground">{hint}</span>}
        </label>
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-0.5",
          "[scrollbar-width:thin]"
        )}
      >
        {taskKeys.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-2 py-3 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          taskKeys.map((issueKey) => {
            const task = tasksByKey.get(issueKey);
            return (
              <div
                key={issueKey}
                className="rounded-lg border border-border/50 bg-background/80 p-2 shadow-sm"
              >
                <p className="mb-1.5 text-[11px] font-semibold leading-snug text-foreground">
                  <span className="font-mono text-primary">{issueKey}</span>
                  {task?.summary ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {task.summary}
                    </span>
                  ) : null}
                </p>
                <textarea
                  value={values[issueKey] ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(issueKey, e.target.value)}
                  placeholder={disabled ? emptyMessage : `${issueKey} 내용 입력`}
                  className={cn(
                    ui.textarea,
                    "min-h-[3.5rem] w-full resize-y font-sans text-xs leading-snug",
                    disabled && scrumFieldDisabledClass
                  )}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
