import type { JiraTask, Sprint } from "@/lib/index";
import { EMPTY_SPRINT } from "@/lib/jira-live-data";

let activeTasks: JiraTask[] | null = null;
let activeSprints: Sprint[] | null = null;

/** Supabase·REST·Exporter 동기화 후 앱 전역 JIRA 캐시 */
export function setJiraDataCache(tasks: JiraTask[], sprints: Sprint[]): void {
  activeTasks = tasks;
  activeSprints = sprints;
}

export function clearJiraDataCache(): void {
  activeTasks = null;
  activeSprints = null;
}

export function getActiveJiraTasks(): JiraTask[] {
  return activeTasks ?? [];
}

export function getActiveJiraSprints(): Sprint[] {
  return activeSprints ?? [];
}

export function getActiveJiraSprintOrEmpty(): Sprint {
  const sprints = getActiveJiraSprints();
  return sprints.find((s) => s.state === "active") ?? sprints[0] ?? EMPTY_SPRINT;
}
