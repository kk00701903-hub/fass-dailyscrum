import { supabase } from "@/lib/supabaseClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function yesterdayFromRow(data: Record<string, unknown>): string {
  const v = data.yesterday_achievement;
  return v != null ? String(v) : "";
}

function isUpsertConstraintError(message: string): boolean {
  return /ON CONFLICT|unique or exclusion constraint/i.test(message);
}

export interface DailyReportRow {
  id?: string;
  member_id: string;
  report_date: string;
  yesterday_achievement: string;
  today_plan: string;
  bottleneck: string;
  is_completed: boolean;
}

/** 특정 일자의 팀 전체 daily_reports 조회 */
export async function fetchDailyReportsByDate(reportDate: string): Promise<DailyReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .order("member_id", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string | undefined,
      member_id: String(r.member_id ?? ""),
      report_date: String(r.report_date ?? reportDate),
      yesterday_achievement: yesterdayFromRow(r),
      today_plan: String(r.today_plan ?? ""),
      bottleneck: String(r.bottleneck ?? ""),
      is_completed: Boolean(r.is_completed),
    };
  });
}

export async function fetchDailyReport(
  memberId: string,
  reportDate: string
): Promise<DailyReportRow | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("member_id", memberId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string | undefined,
    member_id: String(data.member_id ?? memberId),
    report_date: String(data.report_date ?? reportDate),
    yesterday_achievement: yesterdayFromRow(data as Record<string, unknown>),
    today_plan: String(data.today_plan ?? ""),
    bottleneck: String(data.bottleneck ?? ""),
    is_completed: Boolean(data.is_completed),
  };
}

/** 데일리 스크럼 저장 시 daily_reports upsert */
export async function upsertDailyReport(payload: {
  memberId: string;
  reportDate: string;
  yesterday: string;
  today: string;
  blockers: string;
  isCompleted: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const row = {
    member_id: payload.memberId,
    report_date: payload.reportDate,
    yesterday_achievement: payload.yesterday,
    today_plan: payload.today,
    bottleneck: payload.blockers || "없음",
    is_completed: payload.isCompleted,
  };

  const { error } = await supabase.from("daily_reports").upsert(row, {
    onConflict: "member_id,report_date",
  });

  // #region agent log
  fetch('http://127.0.0.1:7436/ingest/f57db699-ba2a-4440-aed0-464c4fb46b81',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c89cc5'},body:JSON.stringify({sessionId:'c89cc5',location:'daily-reports-repository.ts:upsertDailyReport',message:'upsert result',data:{memberId:payload.memberId,hasError:!!error,errorMsg:error?.message??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!error) return;

  if (isUpsertConstraintError(error.message)) {
    const existing = await fetchDailyReport(payload.memberId, payload.reportDate);
    if (existing?.id) {
      const { error: updateErr } = await supabase.from("daily_reports").update(row).eq("id", existing.id);
      if (updateErr) throw new Error(updateErr.message);
      return;
    }
    const { error: insertErr } = await supabase.from("daily_reports").insert(row);
    if (insertErr) throw new Error(insertErr.message);
    return;
  }

  throw new Error(error.message);
}
