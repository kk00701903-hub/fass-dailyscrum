import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, KeyRound } from "lucide-react";
import { AuthFormLayout } from "@/components/AuthFormLayout";
import { normalizeLoginId, resetAppUserPassword } from "@/lib/auth/auth-api";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { ROUTES, TEAM_MEMBERS } from "@/lib/index";
import { ui } from "@/lib/design-system";

const T = AUTH_UI.findPassword;

export default function FindPassword() {
  const [loginId, setLoginId] = useState("");
  const [memberId, setMemberId] = useState(TEAM_MEMBERS[0]!.id);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword !== newPasswordConfirm) {
      setError(T.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await resetAppUserPassword(normalizeLoginId(loginId), memberId, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormLayout title={T.title} subtitle={T.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-login-id" className={ui.label}>
            {T.loginId}
          </label>
          <input
            id="reset-login-id"
            type="text"
            autoComplete="username"
            className={`mt-1.5 ${ui.input}`}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder={T.loginId}
            required
          />
        </div>
        <div>
          <label htmlFor="reset-member" className={ui.label}>
            {T.assignee}
          </label>
          <select
            id="reset-member"
            className={`mt-1.5 ${ui.input}`}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            required
          >
            {TEAM_MEMBERS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reset-password" className={ui.label}>
            {T.newPassword}
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            className={`mt-1.5 ${ui.input}`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={T.newPassword}
            required
          />
        </div>
        <div>
          <label htmlFor="reset-password-confirm" className={ui.label}>
            {T.newPasswordConfirm}
          </label>
          <input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            className={`mt-1.5 ${ui.input}`}
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder={T.newPasswordConfirm}
            required
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
        <button type="submit" disabled={loading || done} className={`${ui.btnPrimary} w-full`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              {T.submit}
            </>
          )}
        </button>
        <p className="text-center text-sm text-slate-600">
          <Link to={ROUTES.LOGIN} className="font-semibold text-slate-900 hover:underline">
            {T.goLogin}
          </Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}
