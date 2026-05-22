import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { AuthFormLayout } from "@/components/AuthFormLayout";
import { findAppLoginId } from "@/lib/auth/auth-api";
import { AUTH_UI } from "@/lib/auth/ui-text";
import { ROUTES, TEAM_MEMBERS } from "@/lib/index";
import { ui } from "@/lib/design-system";

const T = AUTH_UI.findId;

export default function FindId() {
  const [memberId, setMemberId] = useState(TEAM_MEMBERS[0]!.id);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundLoginId, setFoundLoginId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundLoginId(null);
    setLoading(true);
    try {
      const result = await findAppLoginId(memberId, password);
      setFoundLoginId(result.login_id);
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
          <label htmlFor="find-id-member" className={ui.label}>
            {T.assignee}
          </label>
          <select
            id="find-id-member"
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
          <label htmlFor="find-id-password" className={ui.label}>
            {T.password}
          </label>
          <input
            id="find-id-password"
            type="password"
            autoComplete="current-password"
            className={`mt-1.5 ${ui.input}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={T.password}
            required
          />
        </div>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {foundLoginId ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">{T.result}</p>
            <p className="mt-1 text-lg font-semibold tracking-wide">{foundLoginId}</p>
          </div>
        ) : null}
        <button type="submit" disabled={loading} className={`${ui.btnPrimary} w-full`}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4" />
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
