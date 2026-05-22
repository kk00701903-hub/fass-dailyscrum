import { useMemo, useSyncExternalStore } from "react";
import {
  analyticsBlockerCounts,
  blockersFromJiraTasksForAnalytics,
  blockersFromScrumEntries,
  mergeAnalyticsBlockers,
  type AnalyticsBlockerItem,
} from "@/lib/analytics-blockers";
import {
  getAllScrumHistory,
  getScrumEntriesRevision,
  subscribeScrumEntries,
} from "@/lib/scrum-storage";
import { useActiveJiraTasks } from "@/hooks/use-active-jira-tasks";

export function useAnalyticsBlockers(): {
  items: AnalyticsBlockerItem[];
  counts: ReturnType<typeof analyticsBlockerCounts>;
} {
  const tasks = useActiveJiraTasks();
  const revision = useSyncExternalStore(
    subscribeScrumEntries,
    getScrumEntriesRevision,
    () => 0
  );

  const entries = useMemo(() => getAllScrumHistory(), [revision]);

  const items = useMemo(() => {
    const scrum = blockersFromScrumEntries(entries);
    const jira = blockersFromJiraTasksForAnalytics(tasks);
    return mergeAnalyticsBlockers(scrum, jira);
  }, [entries, tasks, revision]);

  return { items, counts: analyticsBlockerCounts(items) };
}
