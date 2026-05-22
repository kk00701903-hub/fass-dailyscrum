import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Loader2, Send } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/index";
import { memberAvatarStyle, ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/store/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchScrumReminderPreference,
  isWebPushConfigured,
  registerWebPushSubscription,
  sendManualPushNotification,
  setScrumReminderPreference,
} from "@/lib/web-push-client";
import { useToast } from "@/hooks/use-toast";

export function NotificationSettings() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const pushReady = isWebPushConfigured();
  const supabaseOk = isSupabaseConfigured();

  const [password, setPassword] = useState("");
  const [scrumReminder, setScrumReminder] = useState(true);
  const [prefLoading, setPrefLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);

  const [title, setTitle] = useState("팀 알림");
  const [body, setBody] = useState("");
  const [targetAll, setTargetAll] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const loginId = user?.loginId ?? "";

  const loadPreference = useCallback(async () => {
    if (!loginId || !password || !supabaseOk) return;
    setPrefLoading(true);
    const pref = await fetchScrumReminderPreference(loginId, password);
    setPrefLoading(false);
    if ("error" in pref) return;
    setScrumReminder(pref.scrumReminderEnabled);
  }, [loginId, password, supabaseOk]);

  useEffect(() => {
    if (password.length >= 4) void loadPreference();
  }, [loadPreference, password]);

  const handleRegisterPush = async () => {
    if (!loginId) {
      toast({ title: "로그인이 필요합니다", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "비밀번호를 입력해 주세요", variant: "destructive" });
      return;
    }
    if (!pushReady) {
      toast({
        title: "웹 푸시 미설정",
        description: "VITE_WEB_PUSH_PUBLIC_KEY와 Supabase URL을 확인하세요.",
        variant: "destructive",
      });
      return;
    }
    setRegistering(true);
    const r = await registerWebPushSubscription(loginId, password);
    setRegistering(false);
    if (!r.ok) {
      toast({ title: "구독 실패", description: r.error, variant: "destructive" });
      return;
    }
    setPushRegistered(true);
    toast({ title: "이 기기에서 알림을 받도록 등록했습니다" });
    void loadPreference();
  };

  const handleScrumReminderToggle = async () => {
    if (!loginId || !password) {
      toast({ title: "비밀번호를 입력해 주세요", variant: "destructive" });
      return;
    }
    const next = !scrumReminder;
    const r = await setScrumReminderPreference(loginId, password, next);
    if (!r.ok) {
      toast({ title: "저장 실패", description: r.error, variant: "destructive" });
      return;
    }
    setScrumReminder(next);
    toast({ title: next ? "스크럼 미입력 알림을 켰습니다" : "스크럼 미입력 알림을 껐습니다" });
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSendManual = async () => {
    if (!loginId) {
      toast({ title: "로그인이 필요합니다", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "비밀번호를 입력해 주세요", variant: "destructive" });
      return;
    }
    if (!body.trim()) {
      toast({ title: "알림 내용을 입력해 주세요", variant: "destructive" });
      return;
    }
    if (!targetAll && selectedMemberIds.length === 0) {
      toast({ title: "수신 대상을 선택해 주세요", variant: "destructive" });
      return;
    }

    setSending(true);
    const r = await sendManualPushNotification(loginId, password, {
      title: title.trim() || "팀 알림",
      body: body.trim(),
      memberIds: targetAll ? undefined : selectedMemberIds,
    });
    setSending(false);

    if (!r.ok) {
      toast({ title: "발송 실패", description: r.error, variant: "destructive" });
      return;
    }

    if (r.targets === 0) {
      toast({
        title: "발송 대상 없음",
        description: r.message ?? "푸시 구독이 등록된 팀원이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const desc =
      r.failed > 0
        ? `${r.sent}건 성공 · ${r.failed}건 실패 (대상 ${r.targets}명)`
        : `${r.sent}건 발송 완료 (대상 ${r.targets}명)`;
    toast({ title: "알림을 보냈습니다", description: desc });
    if (r.failed > 0 && r.errors?.length) {
      console.warn("manual push errors", r.errors);
    }
  };

  if (!supabaseOk) {
    return (
      <p className="text-[10px] text-muted-foreground">
        Supabase가 연결되어 있어야 알림·푸시 기능을 사용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          인증 (구독·발송·설정 저장)
        </p>
        <div>
          <label className={ui.label}>로그인 ID</label>
          <input
            type="text"
            readOnly
            value={loginId || "—"}
            className={cn(ui.input, "mt-1.5 cursor-default bg-muted/40 text-muted-foreground")}
          />
        </div>
        <div>
          <label className={ui.label}>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="구독·발송 시 본인 확인"
            autoComplete="current-password"
            className={cn(ui.input, "mt-1.5")}
          />
        </div>
      </div>

      <div className={cn("flex items-center justify-between py-2", ui.divider)}>
        <div>
          <p className="text-xs font-medium">이 브라우저 푸시 구독</p>
          <p className="text-[10px] text-muted-foreground">
            알림 권한 허용 후 이 기기로 푸시를 받습니다.
            {pushRegistered ? " · 등록됨" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={registering || !pushReady}
          onClick={() => void handleRegisterPush()}
        >
          {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
          구독 등록
        </Button>
      </div>

      <div className={cn("flex items-center justify-between py-2", ui.divider)}>
        <div>
          <p className="text-xs font-medium">스크럼 미입력 알림</p>
          <p className="text-[10px] text-muted-foreground">매일 오전 10시(KST) 미작성 시 리마인더</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={scrumReminder}
          disabled={prefLoading || !password}
          onClick={() => void handleScrumReminderToggle()}
          className={cn(ui.toggle, scrumReminder ? ui.toggleOn : ui.toggleOff)}
        >
          <div
            className={ui.toggleKnob}
            style={{ transform: scrumReminder ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          <p className="text-xs font-semibold text-foreground">수동 알림 보내기</p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          제목·내용을 입력한 뒤 발송하면, 푸시 구독이 등록된 팀원에게 브라우저 알림이 갑니다.
        </p>

        <div>
          <label className={ui.label}>알림 제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="팀 알림"
            className={cn(ui.input, "mt-1.5")}
          />
        </div>

        <div>
          <label className={ui.label}>알림 내용</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="예: 오늘 15시 전체 회의실에서 스탠드업 진행합니다."
            className={cn(ui.textarea, "mt-1.5")}
          />
          <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">{body.length}/500</p>
        </div>

        <div className="space-y-2">
          <label className={ui.label}>수신 대상</label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={targetAll} onCheckedChange={(v) => setTargetAll(v === true)} />
            구독한 전체 팀원
          </label>
          {!targetAll && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEAM_MEMBERS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 px-2 py-1.5 text-xs",
                    selectedMemberIds.includes(m.id) && "border-primary/40 bg-primary/5"
                  )}
                >
                  <Checkbox
                    checked={selectedMemberIds.includes(m.id)}
                    onCheckedChange={() => toggleMember(m.id)}
                  />
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={memberAvatarStyle(m.color)}
                  >
                    {m.avatar}
                  </span>
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={sending || !pushReady || !password}
          onClick={() => void handleSendManual()}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          알림 발송
        </Button>
      </div>

      {!pushReady && (
        <p className="text-[10px] text-amber-700">
          VITE_WEB_PUSH_PUBLIC_KEY가 없으면 구독·발송이 동작하지 않습니다. Supabase Edge에 VAPID 키도
          등록해야 합니다. (docs/WEB_PUSH.md)
        </p>
      )}
    </div>
  );
}
