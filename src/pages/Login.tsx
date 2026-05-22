import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import { AuthFormLayout } from "@/components/AuthFormLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { clearSavedLogin, loadSavedLogin, saveSavedLogin } from "@/lib/auth/saved-login";
import { ROUTES } from "@/lib/index";
import { ui } from "@/lib/design-system";
import { useAuthStore } from "@/store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const hydrate = useAuthStore((s) => s.hydrate);
  const login = useAuthStore((s) => s.login);
  const clearError = useAuthStore((s) => s.clearError);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);

  const redirectFrom = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const saved = loadSavedLogin();
    if (!saved) return;
    setLoginId(saved.loginId);
    setPassword(saved.password);
    setRememberLogin(true);
  }, []);

  /** 세션이 있으면 로그인 화면 없이 메인(데일리 스크럼)으로 */
  useEffect(() => {
    if (!hydrated || !user) return;
    navigate(redirectFrom ?? ROUTES.DAILY_SCRUM, { replace: true });
  }, [hydrated, user, navigate, redirectFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(loginId, password);
      if (rememberLogin) {
        saveSavedLogin(loginId, password);
      } else {
        clearSavedLogin();
      }
      navigate(redirectFrom ?? ROUTES.DAILY_SCRUM, { replace: true });
    } catch {
      /* error in store */
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthFormLayout title="로그인" subtitle="아이디와 비밀번호로 ScrumRadar에 접속합니다">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-id" className={ui.label}>
            아이디
          </label>
          <input
            id="login-id"
            type="text"
            autoComplete="username"
            className={`mt-1.5 ${ui.input}`}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="아이디"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className={ui.label}>
            비밀번호
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className={`mt-1.5 ${ui.input}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
          />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2">
          <Checkbox
            id="remember-login"
            checked={rememberLogin}
            onCheckedChange={(v) => setRememberLogin(v === true)}
          />
          <span className="text-sm text-muted-foreground">{AUTH_UI.login.remember}</span>
        </label>
        {error ? (
          <p className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-2.5 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              로그인
            </>
          )}
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link to={ROUTES.FIND_ID} className="font-medium text-foreground/80 transition-all duration-300 hover:text-primary hover:underline">
            {AUTH_UI.login.findId}
          </Link>
          <span className="text-border">|</span>
          <Link
            to={ROUTES.FIND_PASSWORD}
            className="font-medium text-foreground/80 transition-all duration-300 hover:text-primary hover:underline"
          >
            {AUTH_UI.login.findPassword}
          </Link>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link to={ROUTES.SIGNUP} className="font-semibold text-primary transition-colors duration-300 hover:underline">
            회원가입
          </Link>
        </p>
      </form>
    </AuthFormLayout>
  );
}
