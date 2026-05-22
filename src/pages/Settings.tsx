import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Save, Server, Key, Bell, Users, Database, CheckCircle2, XCircle, Loader2, GitBranch, Sun, Moon, Monitor } from "lucide-react";
import { Card, SectionHeader } from "@/components/Stats";
import { JiraSyncDashboard } from "@/components/JiraSyncDashboard";
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
import { TeamCompositionSettings } from "@/components/settings/TeamCompositionSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ui } from "@/lib/design-system";
import {
  getThemePreference,
  setThemePreference,
  THEME_CHANGED_EVENT,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

type SupabaseProbe = "idle" | "checking" | "ok" | "error";

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: React.ElementType }[] = [
  { id: "dark", label: "다크", icon: Moon },
  { id: "light", label: "라이트", icon: Sun },
  { id: "system", label: "시스템", icon: Monitor },
];

export default function Settings() {
  const themePref = useSyncExternalStore(
    (cb) => {
      window.addEventListener(THEME_CHANGED_EVENT, cb);
      return () => window.removeEventListener(THEME_CHANGED_EVENT, cb);
    },
    getThemePreference,
    () => "light" as ThemePreference
  );
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
        className={cn(ui.input, "mt-2", readOnly && "cursor-default bg-muted/50 text-muted-foreground")}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Card className="p-4">
        <SectionHeader dense title="화면 테마" subtitle="기본 라이트 · 다크는 아래에서 선택" />
        <div className="mt-3 flex flex-wrap gap-2">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setThemePreference(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors",
                themePref === id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:bg-muted/30"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={cn(ui.iconBoxSm, ui.iconCyan)}>
              <GitBranch className="h-4 w-4" />
            </div>
            <SectionHeader
              title="JIRA 동기화"
              subtitle="마지막 인터페이스 일시만 표시합니다. 동기화는 상단 헤더의 JIRA 동기화 버튼을 사용하세요."
            />
          </div>
        </div>
        <JiraSyncDashboard embedded />
      </Card>

      <Card>
        <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn(ui.iconBoxSm, ui.iconCyan)}>
            <Key className="h-4 w-4" />
          </div>
          <SectionHeader dense title="JIRA Cloud 연동 설정" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="JIRA 도메인" value={jiraUrl} onChange={setJiraUrl} placeholder="https://org.atlassian.net" />
          <Field label="이메일" value={jiraEmail} onChange={setJiraEmail} type="email" />
          <div className="col-span-2">
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
          </div>
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
          {`${String(JIRA_SYNC_SCHEDULE_HOUR).padStart(2, "0")}:00 (${tzLabel})`}, 수동은 위 동기화 패널 또는 상단 헤더 버튼입니다.
        </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(ui.iconBoxSm, ui.iconViolet)}>
              <Database className="h-4 w-4" />
            </div>
            <SectionHeader dense title="Supabase 연결" subtitle="PostgreSQL 호스팅 · 앱 데이터 저장" />
          </div>
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
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Field
            label="Project URL"
            value={supabaseUrl || "—"}
            readOnly
            placeholder="https://xxxx.supabase.co"
          />
          <Field label="Anon Key" value={supabaseAnonMasked || "—"} readOnly type="password" />
        </div>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void probeSupabase()}
          disabled={supabaseProbe === "checking"}
        >
          연결 다시 확인
        </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn(ui.iconBoxSm, ui.iconOrange)}>
            <Server className="h-4 w-4" />
          </div>
          <SectionHeader dense title="Grafana 연동" />
        </div>
        <Field label="Grafana URL" value={grafanaUrl} onChange={setGrafanaUrl} placeholder="http://localhost:3000" />
        <div className="mt-3">
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
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn(ui.iconBoxSm, ui.iconEmerald)}>
            <Users className="h-4 w-4" />
          </div>
          <SectionHeader
            dense
            title="팀 구성"
            subtitle="담당자 표시 · 로그인 상태 · 비밀번호 초기화"
          />
        </div>
        <TeamCompositionSettings />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn(ui.iconBoxSm, ui.iconAmber)}>
            <Bell className="h-4 w-4" />
          </div>
          <SectionHeader
            dense
            title="알림 설정"
            subtitle="푸시 구독 · 스크럼 리마인더 · 수동 알림 발송"
          />
        </div>
        <NotificationSettings />
        </CardContent>
      </Card>

      <Button type="button" className="w-full" onClick={handleSave}>
        {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "저장 완료" : "설정 저장"}
      </Button>
    </div>
  );
}
