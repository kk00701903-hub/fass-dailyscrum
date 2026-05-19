/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Server, Key, Bell, Users, Database, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, SectionHeader } from "@/components/Stats";
import {
  getStoredGrafanaDashboardEmbedUrl,
  setStoredGrafanaDashboardEmbedUrl,
} from "@/lib/grafana-embed-url";
import {
  getJiraBaseUrlFromEnv,
  getJiraBoardIdFromEnv,
  getJiraEmailFromEnv,
  hasJiraApiTokenFromEnv,
} from "@/lib/jira-env";
import { JIRA_SYNC_SCHEDULE_HOUR, JIRA_SYNC_TIMEZONE } from "@/lib/jira-sync-schedule";
import {
  getSupabaseAnonKeyFromEnv,
  getSupabaseUrlFromEnv,
  isSupabaseConfigured,
  maskSupabaseAnonKey,
} from "@/lib/supabase/client";
import { supabase } from "@/lib/supabaseClient";
import { TEAM_MEMBERS } from "@/lib/index";
import { memberAvatarStyle, ui } from "@/lib/untitled-ui";
import { cn } from "@/lib/utils";

type SupabaseProbe = "idle" | "checking" | "ok" | "error";

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [jiraUrl, setJiraUrl] = useState(() => getJiraBaseUrlFromEnv() || "https://your-org.atlassian.net");
  const [jiraEmail, setJiraEmail] = useState(() => getJiraEmailFromEnv() || "team@your-org.com");
  const [jiraToken, setJiraToken] = useState("");
  const [grafanaUrl, setGrafanaUrl] = useState("http://localhost:3000");
  const [grafanaEmbedUrl, setGrafanaEmbedUrl] = useState(() => getStoredGrafanaDashboardEmbedUrl());
  const [supabaseProbe, setSupabaseProbe] = useState<SupabaseProbe>("idle");
  const [supabaseProbeDetail, setSupabaseProbeDetail] = useState("");

  const supabaseConfigured = isSupabaseConfigured();
  const supabaseUrl = getSupabaseUrlFromEnv();
  const supabaseAnonMasked = maskSupabaseAnonKey(getSupabaseAnonKeyFromEnv());
  const jiraBoardId = getJiraBoardIdFromEnv();
  const tzLabel = JIRA_SYNC_TIMEZONE === "Asia/Seoul" ? "KST" : JIRA_SYNC_TIMEZONE;

  const probeSupabase = useCallback(async () => {
    if (!supabaseConfigured) {
      setSupabaseProbe("error");
      setSupabaseProbeDetail("VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 미설정");
      return;
    }
    setSupabaseProbe("checking");
    setSupabaseProbeDetail("");
    try {
      const { error } = await supabase.from("jira_sprints").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      setSupabaseProbe("ok");
      setSupabaseProbeDetail("PostgreSQL(Supabase) 연결 및 jira_sprints 조회 성공");
    } catch (e) {
      setSupabaseProbe("error");
      setSupabaseProbeDetail(e instanceof Error ? e.message : String(e));
    }
  }, [supabaseConfigured]);

  useEffect(() => {
    void probeSupabase();
  }, [probeSupabase]);

  const handleSave = () => {
    setStoredGrafanaDashboardEmbedUrl(grafanaEmbedUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Field = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder = "",
    readOnly = false,
  }: {
    label: string;
    value: string;
    onChange?: (v: string) => void;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
  }) => (
    <div>
      <label className={ui.label}>{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className={cn(ui.input, readOnly && "cursor-default bg-slate-50 text-slate-600")}
      />
    </div>
  );

  return (
    <motion.div className="mx-auto max-w-3xl space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* JIRA */}
      <Card className="p-6">
        <motion.div className="flex items-center gap-2 mb-4">
          <div className={cn(ui.iconBoxSm, ui.iconCyan)}>
            <Key className="h-4 w-4" />
          </div>
          <SectionHeader title="JIRA Cloud 연동 설정" />
        </motion.div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="JIRA 도메인" value={jiraUrl} onChange={setJiraUrl} placeholder="https://org.atlassian.net" />
          <Field label="이메일" value={jiraEmail} onChange={setJiraEmail} type="email" />
          <motion.div className="col-span-2">
            <Field
              label="API Token"
              value={jiraToken}
              onChange={setJiraToken}
              type="password"
              placeholder={hasJiraApiTokenFromEnv() ? "환경 변수 VITE_JIRA_API_TOKEN 사용 중" : "Atlassian API Token"}
            />
            {hasJiraApiTokenFromEnv() && (
              <p className="mt-1 text-[10px] text-slate-500">
                현재 토큰은 <code className="text-[10px]">.env.local</code>의{" "}
                <code className="text-[10px]">VITE_JIRA_API_TOKEN</code>에서 로드됩니다. 변경 후 개발 서버를 다시
                띄워 주세요.
              </p>
            )}
          </motion.div>
          <Field
            label="스크럼 보드 ID"
            value={jiraBoardId || "—"}
            readOnly
            placeholder="VITE_JIRA_BOARD_ID"
          />
        </div>
        <p className="mt-3 text-[10px] text-slate-500">
          스프린트·이슈 동기화는 <code className="text-[10px]">.env.local</code>의{" "}
          <code className="text-[10px]">VITE_JIRA_BOARD_ID</code>를 사용합니다. 자동 배치는 GitHub Actions 매일{" "}
          {`${String(JIRA_SYNC_SCHEDULE_HOUR).padStart(2, "0")}:00 (${tzLabel})`}, 수동은 JIRA 동기화 화면 버튼입니다.
        </p>
      </Card>

      {/* Supabase */}
      <Card className="p-6">
        <motion.div className="mb-4 flex items-center justify-between gap-2">
          <motion.div className="flex items-center gap-2">
            <div className={cn(ui.iconBoxSm, ui.iconViolet)}>
              <Database className="h-4 w-4" />
            </div>
            <SectionHeader title="Supabase 연결" subtitle="PostgreSQL 호스팅 · 앱 데이터 저장" />
          </motion.div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              supabaseProbe === "ok" && ui.badgeSuccess,
              supabaseProbe === "error" && ui.badgeError,
              supabaseProbe !== "ok" && supabaseProbe !== "error" && ui.badgeNeutral
            )}
          >
            {supabaseProbe === "checking" && <Loader2 className="w-3 h-3 animate-spin" />}
            {supabaseProbe === "ok" && <CheckCircle2 className="w-3 h-3" />}
            {supabaseProbe === "error" && <XCircle className="w-3 h-3" />}
            {supabaseProbe === "checking"
              ? "확인 중"
              : supabaseProbe === "ok"
                ? "연결됨"
                : supabaseProbe === "error"
                  ? "연결 실패"
                  : "대기"}
          </span>
        </motion.div>
        <motion.div className="grid grid-cols-1 gap-4">
          <Field
            label="Project URL"
            value={supabaseUrl || "—"}
            readOnly
            placeholder="https://xxxx.supabase.co"
          />
          <Field label="Anon Key" value={supabaseAnonMasked || "—"} readOnly type="password" />
        </motion.div>
        {supabaseProbeDetail && (
          <p
            className={cn(
              "mt-2 text-[10px]",
              supabaseProbe === "ok" ? "text-emerald-700" : "text-red-700"
            )}
          >
            {supabaseProbeDetail}
          </p>
        )}
        <p className="mt-3 text-[10px] text-slate-500">
          DB 테이블: <code className="text-[10px]">jira_sprints</code>, <code className="text-[10px]">jira_tasks</code>,{" "}
          <code className="text-[10px]">daily_reports</code>, <code className="text-[10px]">scrum_entries</code>. 값은{" "}
          <code className="text-[10px]">.env.local</code>의 <code className="text-[10px]">VITE_SUPABASE_URL</code>,{" "}
          <code className="text-[10px]">VITE_SUPABASE_ANON_KEY</code>에서 읽습니다.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => void probeSupabase()}
          disabled={supabaseProbe === "checking"}
          className={cn(ui.btnSecondary, "mt-3 px-3 py-1.5 text-xs")}
        >
          연결 다시 확인
        </motion.button>
      </Card>

      {/* Grafana */}
      <Card className="p-6">
        <motion.div className="mb-4 flex items-center gap-2">
          <motion.div className={cn(ui.iconBoxSm, ui.iconOrange)}>
            <Server className="h-4 w-4" />
          </motion.div>
          <SectionHeader title="Grafana 연동" />
        </motion.div>
        <Field label="Grafana URL" value={grafanaUrl} onChange={setGrafanaUrl} placeholder="http://localhost:3000" />
        <motion.div className="mt-4">
          <label className={cn(ui.label, "mb-1.5 block")}>대시보드 임베드 URL</label>
          <textarea
            value={grafanaEmbedUrl}
            onChange={(e) => setGrafanaEmbedUrl(e.target.value)}
            placeholder="Grafana → Share → Embed 의 iframe src 전체 (https://...?orgId=1&kiosk=...)"
            rows={3}
            className={ui.textarea}
          />
          <p className="mt-1.5 text-[10px] text-slate-500">
            비우고 저장하면 브라우저 저장값을 지웁니다. 빌드 시{" "}
            <code className="text-[10px]">VITE_GRAFANA_DASHBOARD_EMBED_URL</code>이 있으면 그 값이 우선합니다.
          </p>
        </motion.div>
      </Card>

      {/* Team */}
      <Card className="p-6">
        <motion.div className="flex items-center gap-2 mb-4">
          <motion.div className={cn(ui.iconBoxSm, ui.iconEmerald)}>
            <Users className="h-4 w-4" />
          </motion.div>
          <SectionHeader title="팀 구성" subtitle="역할 및 표시 이름" />
        </motion.div>
        <div className="grid grid-cols-2 gap-3">
          {TEAM_MEMBERS.map((m) => (
            <motion.div
              key={m.id}
              className={ui.memberCard}
            >
              <motion.div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={memberAvatarStyle(m.color)}
              >
                {m.avatar}
              </motion.div>
              <div>
                <p className="text-sm font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">{m.role}</p>
              </div>
              <motion.div className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <motion.div className="flex items-center gap-2 mb-4">
          <div className={cn(ui.iconBoxSm, ui.iconAmber)}>
            <Bell className="h-4 w-4" />
          </div>
          <SectionHeader title="알림 설정" />
        </motion.div>
        <div className="space-y-3">
          {[
            { label: "블로커 발생 시 알림", desc: "Critical 블로커 등록 시 즉시 알림", checked: true },
            { label: "스크럼 미입력 알림", desc: "오전 10시까지 미입력 팀원에게 리마인더", checked: true },
            { label: "스프린트 마감 임박 알림", desc: "D-2 시점 팀 전체 알림", checked: false },
          ].map((n) => (
            <motion.div key={n.label} className={cn("flex items-center justify-between py-2", ui.divider)}>
              <motion.div>
                <p className="text-sm text-slate-900">{n.label}</p>
                <p className="text-xs text-slate-500">{n.desc}</p>
              </motion.div>
              <motion.div className={cn(ui.toggle, n.checked ? ui.toggleOn : ui.toggleOff)} role="presentation">
                <motion.div className={ui.toggleKnob} style={{ transform: n.checked ? "translateX(20px)" : "translateX(0)" }} />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        className={cn(ui.btnPrimary, "w-full py-3")}
      >
        {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
        {saved ? "저장 완료!" : "설정 저장"}
      </motion.button>
    </motion.div>
  );
}
