import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loginAppUser, resetAppUserPassword } from "@/lib/auth/auth-api";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

const T = AUTH_UI.teamSettings;
const FP = AUTH_UI.findPassword;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberId: string;
  loginId: string;
  adminLoginId: string;
};

export function TeamMemberPasswordResetDialog({
  open,
  onOpenChange,
  memberName,
  memberId,
  loginId,
  adminLoginId,
}: Props) {
  const [adminPassword, setAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetForm = () => {
    setAdminPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError(null);
    setDone(false);
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword !== newPasswordConfirm) {
      setError(FP.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await loginAppUser(adminLoginId, adminPassword);
      await resetAppUserPassword(loginId, memberId, newPassword);
      setAdminPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{T.resetTitle}</DialogTitle>
          <DialogDescription>
            {T.resetSubtitle}
            <span className="mt-1 block font-semibold text-foreground">{memberName}</span>
            <span className="font-mono text-xs text-muted-foreground">{loginId}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="team-reset-admin-pw" className={ui.label}>
              {T.adminPassword}
            </label>
            <input
              id="team-reset-admin-pw"
              type="password"
              autoComplete="current-password"
              className={cn(ui.input, "mt-1.5")}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              disabled={loading || done}
            />
          </div>
          <div>
            <label htmlFor="team-reset-new-pw" className={ui.label}>
              {FP.newPassword}
            </label>
            <input
              id="team-reset-new-pw"
              type="password"
              autoComplete="new-password"
              className={cn(ui.input, "mt-1.5")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading || done}
            />
          </div>
          <div>
            <label htmlFor="team-reset-new-pw-confirm" className={ui.label}>
              {FP.newPasswordConfirm}
            </label>
            <input
              id="team-reset-new-pw-confirm"
              type="password"
              autoComplete="new-password"
              className={cn(ui.input, "mt-1.5")}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              disabled={loading || done}
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {T.done}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              닫기
            </Button>
            <Button type="submit" disabled={loading || done}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  {T.submit}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
