import { create } from "zustand";
import { getLastScheduledRunDayKey } from "@/lib/jira-sync-schedule";
import { pullJiraSyncData } from "@/lib/jira-sync-pull";
import { parseExporterCsvToJiraTasks } from "@/lib/jira-exporter-csv";
import {
  clearExporterSnapshot,
  loadExporterSnapshot,
  saveExporterSnapshot,
  type ExporterSnapshot,
} from "@/lib/jira-exporter-storage";
import type { JiraTask, Sprint } from "@/lib/index";
import { setJiraDataCache, clearJiraDataCache } from "@/lib/jira-data-registry";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchSprintsFromDb,
  fetchTasksFromDb,
  invokeJiraSync,
} from "@/lib/supabase/jira-repository";
import { fetchJiraSprintsFromDb } from "@/lib/jira-sprints-dashboard";
import { jiraSprintRowToSprint } from "@/lib/sprint-status";
import { isJiraLiveFetchAvailable } from "@/lib/jira-client";
import { hydrateScrumHistoryFromSupabase } from "@/lib/scrum-storage";

export type JiraSyncSource = "manual" | "schedule";
export type JiraDataSource = "none" | "rest" | "exporter" | "supabase";

interface JiraSyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  lastSyncSource: JiraSyncSource | null;
  scheduledRunDayKey: string | null;
  /** 표시 데이터 출처 */
  dataSource: JiraDataSource;
  liveTasks: JiraTask[] | null;
  liveSprint: Sprint | null;
  liveSprints: Sprint[] | null;
  lastJiraError: string | null;
  exporterMeta: Pick<ExporterSnapshot, "fileName" | "importedAt"> | null;
  exporterWarnings: string[];
  /** REST API 또는 Supabase Edge Function 동기화 */
  startSync: (source: JiraSyncSource) => boolean;
  /** DB에 쌓인 JIRA 데이터만 읽기 (동기화 없이) */
  hydrateFromSupabase: () => Promise<boolean>;
  /** Exporter for Jira CSV 파일 가져오기 */
  importExporterFile: (file: File) => Promise<boolean>;
  /** 저장된 Exporter 스냅샷 복원 */
  hydrateExporterFromStorage: () => void;
  clearExporterImport: () => void;
  setDataSource: (source: JiraDataSource) => void;
  clearJiraError: () => void;
}

function simpleRowsToSprints(
  rows: Awaited<ReturnType<typeof fetchJiraSprintsFromDb>>
): Sprint[] {
  return rows.map(jiraSprintRowToSprint);
}

function applyExporterResult(
  set: (partial: Partial<JiraSyncState>) => void,
  fileName: string,
  tasks: JiraTask[],
  sprint: Sprint,
  warnings: string[]
) {
  const importedAt = new Date().toISOString();
  setJiraDataCache(tasks, [sprint]);
  saveExporterSnapshot({ fileName, importedAt, tasks, sprint });
  set({
    dataSource: "exporter",
    liveTasks: tasks,
    liveSprint: sprint,
    liveSprints: [sprint],
    lastSyncAt: Date.now(),
    lastSyncSource: "manual",
    lastJiraError: null,
    exporterMeta: { fileName, importedAt },
    exporterWarnings: warnings,
    syncing: false,
  });
}

export const useJiraSyncStore = create<JiraSyncState>((set, get) => ({
  syncing: false,
  lastSyncAt: null,
  lastSyncSource: null,
  scheduledRunDayKey: typeof localStorage !== "undefined" ? getLastScheduledRunDayKey() : null,
  dataSource: "none",
  liveTasks: null,
  liveSprint: null,
  liveSprints: null,
  lastJiraError: null,
  exporterMeta: null,
  exporterWarnings: [],

  hydrateExporterFromStorage: () => {
    const snap = loadExporterSnapshot();
    if (!snap || snap.tasks.length === 0) return;
    setJiraDataCache(snap.tasks, [snap.sprint]);
    set({
      dataSource: "exporter",
      liveTasks: snap.tasks,
      liveSprint: snap.sprint,
      liveSprints: [snap.sprint],
      exporterMeta: { fileName: snap.fileName, importedAt: snap.importedAt },
      lastSyncAt: Date.parse(snap.importedAt) || Date.now(),
    });
  },

  setDataSource: (source) => set({ dataSource: source }),

  clearJiraError: () => set({ lastJiraError: null }),

  hydrateFromSupabase: async () => {
    if (!isSupabaseConfigured()) return false;
    try {
      let tasks: JiraTask[] = [];
      let sprints: Sprint[] = [];
      try {
        tasks = await fetchTasksFromDb();
      } catch {
        tasks = [];
      }
      const simple = await fetchJiraSprintsFromDb().catch(() => []);
      if (simple.length > 0) {
        sprints = simpleRowsToSprints(simple);
      } else {
        try {
          sprints = await fetchSprintsFromDb();
        } catch {
          sprints = [];
        }
      }
      if (tasks.length === 0 && sprints.length === 0) return false;
      const active = sprints.find((s) => s.state === "active") ?? sprints[0] ?? null;
      setJiraDataCache(tasks, sprints.length > 0 ? sprints : active ? [active] : []);
      await hydrateScrumHistoryFromSupabase();
      set({
        dataSource: "supabase",
        liveTasks: tasks,
        liveSprint: active,
        liveSprints: sprints,
        lastSyncAt: Date.now(),
        lastJiraError: null,
      });
      return true;
    } catch (e) {
      set({ lastJiraError: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  startSync: (source) => {
    if (get().syncing) return false;
    set({ syncing: true, lastSyncSource: source, lastJiraError: null });

    if (isSupabaseConfigured()) {
      const finishWithFallback = async (): Promise<boolean> => {
        if (await get().hydrateFromSupabase()) return true;
        if (!isJiraLiveFetchAvailable()) return false;
        try {
          const r = await pullJiraSyncData();
          if (!r.usedLive || r.error || (r.tasks.length === 0 && !r.sprint)) return false;
          setJiraDataCache(r.tasks, r.sprint ? [r.sprint] : []);
          set({
            dataSource: "rest",
            liveTasks: r.tasks,
            liveSprint: r.sprint,
            liveSprints: r.sprint ? [r.sprint] : [],
            lastSyncAt: Date.now(),
            lastJiraError: null,
            exporterMeta: null,
            exporterWarnings: [],
          });
          return true;
        } catch {
          return false;
        }
      };

      void invokeJiraSync()
        .then(async (r) => {
          if (!r.ok) {
            const edgeMsg = r.error ?? "Supabase JIRA 동기화 실패";
            const recovered = await finishWithFallback();
            if (recovered) {
              set({ syncing: false, lastSyncSource: source, lastJiraError: null });
              return;
            }
            set({
              syncing: false,
              lastSyncAt: Date.now(),
              lastSyncSource: source,
              lastJiraError:
                edgeMsg.includes("Edge Function") && isJiraLiveFetchAvailable()
                  ? `${edgeMsg}\n(스프린트는 GitHub Actions·npm run sync:jira 로 DB에 반영됩니다. 이슈 목록만 개발 REST 프록시로 불러올 수 있습니다.)`
                  : edgeMsg,
            });
            return;
          }
          const [tasks, sprints] = await Promise.all([fetchTasksFromDb(), fetchSprintsFromDb()]);
          const active = sprints.find((s) => s.state === "active") ?? sprints[0] ?? null;
          setJiraDataCache(tasks, sprints);
          await hydrateScrumHistoryFromSupabase();
          set({
            syncing: false,
            dataSource: "supabase",
            lastSyncAt: Date.now(),
            lastSyncSource: source,
            liveTasks: tasks,
            liveSprint: active,
            liveSprints: sprints,
            lastJiraError: null,
            exporterMeta: null,
            exporterWarnings: [],
          });
        })
        .catch((e) => {
          set({
            syncing: false,
            lastSyncAt: Date.now(),
            lastSyncSource: source,
            lastJiraError: e instanceof Error ? e.message : String(e),
          });
        });
      return true;
    }

    void pullJiraSyncData().then((r) => {
      if (r.usedLive && !r.error && r.tasks.length > 0) {
        setJiraDataCache(r.tasks, r.sprint ? [r.sprint] : []);
        set({
          syncing: false,
          dataSource: "rest",
          lastSyncAt: Date.now(),
          lastSyncSource: source,
          liveTasks: r.tasks,
          liveSprint: r.sprint,
          liveSprints: r.sprint ? [r.sprint] : [],
          lastJiraError: null,
          exporterMeta: null,
          exporterWarnings: [],
        });
      } else {
        set({
          syncing: false,
          lastSyncAt: Date.now(),
          lastSyncSource: source,
          lastJiraError: r.error,
          ...(r.error ? {} : { dataSource: "none", liveTasks: null, liveSprint: null }),
        });
      }
    });
    return true;
  },

  importExporterFile: async (file) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      set({ lastJiraError: "CSV 또는 TXT 파일만 지원합니다. (Exporter for Jira에서 CSV로보내기)" });
      return false;
    }
    set({ syncing: true, lastJiraError: null });
    try {
      const text = await file.text();
      const { tasks, sprint, warnings } = parseExporterCsvToJiraTasks(text);
      if (tasks.length === 0) {
        set({
          syncing: false,
          lastJiraError: "가져온 CSV에서 이슈를 찾지 못했습니다. Exporter for Jira 기본 컬럼(Issue key, Summary 등)을 확인하세요.",
        });
        return false;
      }
      applyExporterResult(set, file.name, tasks, sprint, warnings);
      return true;
    } catch (e) {
      set({
        syncing: false,
        lastJiraError: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  },

  clearExporterImport: () => {
    clearExporterSnapshot();
    clearJiraDataCache();
    set({
      dataSource: "none",
      liveTasks: null,
      liveSprint: null,
      liveSprints: null,
      exporterMeta: null,
      exporterWarnings: [],
      lastJiraError: null,
    });
  },
}));
