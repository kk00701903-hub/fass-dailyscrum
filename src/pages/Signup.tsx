import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import { AuthFormLayout } from "@/components/AuthFormLayout";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { ROUTES, TEAM_MEMBERS } from "@/lib/index";
import { ui } from "@/lib/design-system";
import { useAuthStore } from "@/store/authStore";

const T = AUTH_UI.signup;

export default function Signup() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const hydrate = useAuthStore((s) => s.hydrate);
  const register = useAuthStore((s) => s.register);
  const clearError = useAuthStore((s) => s.clearError);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [memberId, setMemberId] = useState(TEAM_MEMBERS[0]!.id);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && user) {
      navigate(ROUTES.DAILY_SCRUM, { replace: true });
    }
  }, [hydrated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (password !== passwordConfirm) {
      setLocalError(T.passwordMismatch);
      return;
    }

    const member = TEAM_MEMBERS.find((m) => m.id === memberId);
    try {
      await register(loginId.trim(), password, memberId, member?.name);
      navigate(ROUTES.DAILY_SCRUM, { replace: true });
    } catch {
      /* error in store */
    }
  };

  const displayError = localError ?? error;

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthFormLayout title={T.title} subtitle={T.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-id" className={ui.label}>
            {T.loginId}
          </label>
          <input
            id="signup-id"
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
          <label htmlFor="signup-password" className={ui.label}>
            {T.password}
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className={`mt-1.5 ${ui.input}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={T.password}
            required
          />
        </div>
        <div>
          <label htmlFor="signup-password-confirm" className={ui.label}>
            {T.passwordConfirm}
          </label>
          <input
            id="signup-password-confirm"
            type="password"
            autoComplete="new-password"
            className={`mt-1.5 ${ui.input}`}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder={T.passwordConfirmPlaceholder}
            required
          />
        </div>
        <div>
          <label htmlFor="signup-member" className={ui.label}>
            {T.assignee}
          </label>
          <select
            id="signup-member"
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
        {displayError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {displayError}
          </p>
        ) : null}
        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              {T.submit}
            </>
          )}
        </button>
        <p className="text-center text-sm text-slate-600">
          {T.hasAccount}{" "}
          <Link to={ROUTES.LOGIN} className="font-semibold text-slate-900 hover:underline">
            {T.goLogin}
          </Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}
