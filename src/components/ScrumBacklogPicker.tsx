import { STATUS_CONFIG, type JiraTask } from "@/lib/index";

interface ScrumBacklogPickerProps {
  tasks: JiraTask[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}

export function ScrumBacklogPicker({ tasks, selectedKeys, onChange }: ScrumBacklogPickerProps) {
  const toggle = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  if (tasks.length === 0) {
    return (
      <p className="text-[10px] px-1 py-2" style={{ color: "var(--muted-foreground)" }}>
        이 스프린트에 배정된 백로그가 없습니다. JIRA 동기화 후 다시 확인하세요.
      </p>
    );
  }

  return (
    <ul className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
      {tasks.map((task) => {
        const on = selectedKeys.includes(task.key);
        const cfg = STATUS_CONFIG[task.status];
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => toggle(task.key)}
              className="w-full text-left rounded px-1.5 py-1 border transition-colors"
              style={{
                background: on ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)",
                borderColor: on ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start gap-1.5">
                <span
                  className="mt-0.5 w-3 h-3 rounded border shrink-0 flex items-center justify-center text-[8px]"
                  style={{
                    borderColor: on ? "var(--primary)" : "rgba(255,255,255,0.2)",
                    background: on ? "var(--primary)" : "transparent",
                    color: on ? "var(--primary-foreground)" : "transparent",
                  }}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-mono" style={{ color: "var(--primary)" }}>
                      {task.key}
                    </span>
                    <span
                      className="text-[8px] px-1 rounded"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[8px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      {task.storyPoints}sp
                    </span>
                  </span>
                  <span className="block text-[10px] leading-tight line-clamp-2" style={{ color: "var(--foreground)" }}>
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
