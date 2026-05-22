/** 로그인 화면 «아이디·비밀번호 저장» (localStorage, 이 기기에만) */
const STORAGE_KEY = "scrum-remember-login";

export interface SavedLoginCredentials {
  loginId: string;
  password: string;
}

export function loadSavedLogin(): SavedLoginCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLoginCredentials;
    if (!parsed?.loginId) return null;
    return {
      loginId: parsed.loginId,
      password: parsed.password ?? "",
    };
  } catch {
    return null;
  }
}

export function saveSavedLogin(loginId: string, password: string): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ loginId: loginId.trim(), password })
    );
  } catch {
    /* ignore */
  }
}

export function clearSavedLogin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
