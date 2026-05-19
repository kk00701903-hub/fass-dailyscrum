import type { JiraTask, Sprint } from "@/lib/index";

const STORAGE_KEY = "scrum_jira_exporter_snapshot";

export type ExporterSnapshot = {
  fileName: string;
  importedAt: string;
  tasks: JiraTask[];
  sprint: Sprint;
};

export function loadExporterSnapshot(): ExporterSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExporterSnapshot;
  } catch {
    return null;
  }
}

export function saveExporterSnapshot(snapshot: ExporterSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function clearExporterSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
