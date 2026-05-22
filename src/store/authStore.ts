import { create } from "zustand";
import { loginAppUser, normalizeLoginId, registerAppUser } from "@/lib/auth/auth-api";
import type { AppUser, AuthSession } from "@/lib/auth/types";

/** localStorage 세션 — 로그아웃 전까지 무제한 유지 */
const SESSION_KEY = "scrum-auth-session";

function readSession(): AuthSession | null {
  try {
    let raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      const fromTab = sessionStorage.getItem(SESSION_KEY);
      if (fromTab) {
        localStorage.setItem(SESSION_KEY, fromTab);
        sessionStorage.removeItem(SESSION_KEY);
        raw = fromTab;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(user: AppUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const session: AuthSession = { user, savedAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: AppUser | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => void;
  login: (loginId: string, password: string) => Promise<void>;
  register: (loginId: string, password: string, memberId: string, displayName?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const initialSession = readSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialSession?.user ?? null,
  hydrated: true,
  loading: false,
  error: null,

  hydrate: () => {
    const session = readSession();
    set({ user: session?.user ?? null, hydrated: true });
  },

  clearError: () => set({ error: null }),

  login: async (loginId, password) => {
    set({ loading: true, error: null });
    try {
      const user = await loginAppUser(normalizeLoginId(loginId), password);
      writeSession(user);
      set({ user, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },

  register: async (loginId, password, memberId, displayName) => {
    set({ loading: true, error: null });
    try {
      const user = await registerAppUser(normalizeLoginId(loginId), password, memberId, displayName);
      writeSession(user);
      set({ user, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },

  logout: () => {
    writeSession(null);
    set({ user: null, error: null });
  },
}));
