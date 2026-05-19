import { useEffect } from "react";
import {
  getLastScheduledRunDayKey,
  getSeoulCalendarDayKey,
  isPastScheduledTime,
  setLastScheduledRunDayKey,
} from "@/lib/jira-sync-schedule";
import { invokeJiraSprintSync } from "@/lib/jira-sprints-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useJiraSyncStore } from "@/store/jiraSyncStore";

const TICK_MS = 30_000;

/**
 * GitHub Actions 09:00 배치 보조: 앱이 09:00 이후 켜져 있으면 그날 1회 동기화.
 * (주 배치는 .github/workflows/jira-sync.yml — npm run sync:jira:all)
 */
export function useJiraDailyScheduleSync(): void {
  useEffect(() => {
    const tick = async () => {
      const now = new Date();
      if (!isPastScheduledTime(now)) return;
      if (!isSupabaseConfigured()) return;

      const dayKey = getSeoulCalendarDayKey(now);
      if (getLastScheduledRunDayKey() === dayKey) return;
      if (useJiraSyncStore.getState().syncing) return;

      useJiraSyncStore.setState({ syncing: true, lastSyncSource: "schedule", lastJiraError: null });

      try {
        const result = await invokeJiraSprintSync();
        if (result.ok) {
          setLastScheduledRunDayKey(dayKey);
          await useJiraSyncStore.getState().hydrateFromSupabase();
          useJiraSyncStore.setState({
            syncing: false,
            scheduledRunDayKey: dayKey,
            lastSyncAt: Date.now(),
            lastSyncSource: "schedule",
            lastJiraError: null,
            dataSource: "supabase",
          });
        } else {
          useJiraSyncStore.setState({
            syncing: false,
            lastSyncAt: Date.now(),
            lastJiraError: result.error ?? "스케줄 동기화 실패",
          });
        }
      } catch (e) {
        useJiraSyncStore.setState({
          syncing: false,
          lastJiraError: e instanceof Error ? e.message : String(e),
        });
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
