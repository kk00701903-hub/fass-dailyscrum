import { STATUS_CONFIG, type TaskStatus } from "@/lib/index";
import type { JiraTaskRow } from "@/lib/jira-sprints-dashboard";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

function TaskStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as TaskStatus] ?? STATUS_CONFIG.TODO;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

export function JiraSprintTaskPanel({ tasks }: { tasks: JiraTaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-slate-50/80 px-6 py-8 text-center text-xs text-slate-500">
        ? ????? ??? ???? ????. <strong className="font-medium">Jira ???</strong>? ????
        ?????.
      </div>
    );
  }

  const parents = tasks.filter((t) => !t.is_subtask);
  const subtasksByParent = new Map<string, JiraTaskRow[]>();
  for (const t of tasks.filter((x) => x.is_subtask && x.parent_issue_key)) {
    const key = t.parent_issue_key!;
    const list = subtasksByParent.get(key) ?? [];
    list.push(t);
    subtasksByParent.set(key, list);
  }
  const ordered = [...parents, ...tasks.filter((t) => t.is_subtask && !t.parent_issue_key)];

  return (
    <div className="border-t border-gray-100 bg-slate-50/50 px-4 py-3 sm:px-6">
      <p className="mb-2 text-xs font-medium text-slate-500">
        ??? {tasks.length}?
        {parents.length < tasks.length
          ? ` (?? ${parents.length} ? ????? ${tasks.length - parents.length})`
          : ""}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">?</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">??</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">???</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">??</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">??</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">SP</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((task) => (
              <TaskRow key={task.id} task={task} subtasks={subtasksByParent.get(task.issue_key) ?? []} depth={0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  subtasks,
  depth,
}: {
  task: JiraTaskRow;
  subtasks: JiraTaskRow[];
  depth: number;
}) {
  return (
    <>
      <tr className={cn(ui.tableRow, depth > 0 && "bg-slate-50/40")}>
        <td className="px-3 py-2.5 font-mono text-xs font-medium text-slate-700">
          <span style={{ paddingLeft: depth * 12 }}>{task.issue_key}</span>
        </td>
        <td className="max-w-md px-3 py-2.5 text-slate-900">
          <span className={cn(depth > 0 && "text-slate-600")}>{task.summary}</span>
        </td>
        <td className="px-3 py-2.5 text-slate-700">{task.assignee_name}</td>
        <td className="px-3 py-2.5">
          <TaskStatusBadge status={task.status} />
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{task.due_date ?? "?"}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
          {task.story_points > 0 ? task.story_points : "?"}
        </td>
      </tr>
      {subtasks.map((st) => (
        <TaskRow key={st.id} task={st} subtasks={[]} depth={depth + 1} />
      ))}
    </>
  );
}
