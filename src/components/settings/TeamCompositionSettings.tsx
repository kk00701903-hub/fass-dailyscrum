import { useEffect, useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/index";
import { memberAvatarStyle, ui } from "@/lib/design-system";
import {
  getTeamMemberPrefs,
  hydrateTeamMemberPrefsFromSupabase,
  setMemberAnalyticsIncluded,
  setMemberScrumHistoryIncluded,
  TEAM_MEMBER_PREFS_EVENT,
} from "@/lib/team-member-preferences";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { useAuthStore } from "@/store/authStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TeamMemberPasswordResetDialog } from "@/components/settings/TeamMemberPasswordResetDialog";
import { cn } from "@/lib/utils";

const T = AUTH_UI.teamSettings;

export function TeamCompositionSettings() {
  const supabaseOk = isSupabaseConfigured();
  const adminLoginId = useAuthStore((s) => s.user?.loginId ?? "");

  const [resetTarget, setResetTarget] = useState<{
    memberId: string;
    memberName: string;
    loginId: string;
  } | null>(null);

  useEffect(() => {
    void hydrateTeamMemberPrefsFromSupabase();
  }, []);

  const prefs = useSyncExternalStore(
    (cb) => {
      window.addEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
      return () => window.removeEventListener(TEAM_MEMBER_PREFS_EVENT, cb);
    },
    getTeamMemberPrefs,
    getTeamMemberPrefs
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        담당자 ID는 JIRA 배정·스크럼 저장 시 멤버 식별자로 사용됩니다. 체크한 담당자만 해당 화면에
        표시됩니다.
        {supabaseOk
          ? " 변경 시 Supabase에 저장되어 팀 전체에 공유됩니다. 가입된 계정은 비밀번호를 초기화할 수 있습니다."
          : " Supabase 미연동 시 이 브라우저에만 저장됩니다."}
      </p>

      {!supabaseOk ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-400">{T.supabaseRequired}</p>
      ) : null}

      <div className="grid grid-cols-[1fr_minmax(5rem,auto)_auto_auto_auto] items-center gap-x-2 gap-y-1 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>담당자</span>
        <span className="text-center">{T.login}</span>
        <span className="text-center w-16">스크럼 일지</span>
        <span className="text-center w-16">애널리틱스</span>
        <span className="text-center w-[4.5rem]">비밀번호</span>
      </div>

      <div className="space-y-2">
        {TEAM_MEMBERS.map((m) => {
          const scrumOn = prefs.scrumHistory[m.id] !== false;
          const analyticsOn = prefs.analytics[m.id] !== false;

          return (
            <div
              key={m.id}
              className={cn(
                ui.memberCard,
                "grid grid-cols-[1fr_minmax(5rem,auto)_auto_auto_auto] items-center gap-x-2 gap-y-0"
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={memberAvatarStyle(m.color)}
                >
                  {m.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{m.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground" title="담당자 ID">
                    {m.id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{m.role}</p>
                </div>
              </div>

              <div className="min-w-0 text-center text-[10px] text-muted-foreground">
                <p className="truncate font-mono text-foreground" title={m.id}>
                  {m.id}
                </p>
              </div>

              <label className="flex w-16 cursor-pointer items-center justify-center">
                <Checkbox
                  checked={scrumOn}
                  onCheckedChange={(v) => setMemberScrumHistoryIncluded(m.id, v === true)}
                  aria-label={`${m.name} 스크럼 일지 조회`}
                />
              </label>

              <label className="flex w-16 cursor-pointer items-center justify-center">
                <Checkbox
                  checked={analyticsOn}
                  onCheckedChange={(v) => setMemberAnalyticsIncluded(m.id, v === true)}
                  aria-label={`${m.name} 애널리틱스 조회`}
                />
              </label>

              <div className="flex w-[4.5rem] justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  disabled={!supabaseOk || !adminLoginId}
                  title={
                    !adminLoginId
                      ? "로그인 후 사용할 수 있습니다"
                      : T.resetPassword
                  }
                  onClick={() =>
                    setResetTarget({
                      memberId: m.id,
                      memberName: m.name,
                      loginId: m.id,
                    })
                  }
                >
                  <KeyRound className="h-3 w-3" />
                  초기화
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {resetTarget && adminLoginId ? (
        <TeamMemberPasswordResetDialog
          open={!!resetTarget}
          onOpenChange={(open) => {
            if (!open) setResetTarget(null);
          }}
          memberName={resetTarget.memberName}
          memberId={resetTarget.memberId}
          loginId={resetTarget.loginId}
          adminLoginId={adminLoginId}
        />
      ) : null}
    </div>
  );
}
