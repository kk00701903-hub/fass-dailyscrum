import { useMemo } from "react";
import type { JiraTask } from "@/lib/index";
import { getActiveJiraTasks } from "@/lib/jira-data-registry";
import { useJiraSyncStore } from "@/store/jiraSyncStore";

/** JIRA 동기화·hydrate 후 애널리틱스 등이 다시 그리도록 store와 캐시를 함께 구독 */
export function useActiveJiraTasks(): JiraTask[] {
  const liveTasks = useJiraSyncStore((s) => s.liveTasks);
  const lastSyncAt = useJiraSyncStore((s) => s.lastSyncAt);

  return useMemo(() => {
    if (liveTasks !== null) return liveTasks;
    return getActiveJiraTasks();
  }, [liveTasks, lastSyncAt]);
}
