import { toast } from "@/hooks/use-toast";
import { ROUTES } from "@/lib/index";
import { ApiError, getHttpStatus } from "@/lib/errors/api-error";
import { logError, normalizeError } from "@/lib/errors/log-error";
import { useAuthStore } from "@/store/authStore";

export type HandleApiErrorOptions = {
  /** 토스트 표시 여부 (기본 true) */
  notify?: boolean;
  /** 401 시 로그인 이동 여부 (기본 true) */
  redirectOn401?: boolean;
  source?: string;
  /** 토스트 제목·설명 덮어쓰기 */
  title?: string;
  description?: string;
};

function redirectToLogin(): void {
  useAuthStore.getState().logout();
  const target = ROUTES.LOGIN;
  if (!window.location.hash.replace(/^#/, "").startsWith(target)) {
    window.location.hash = target;
  }
}

function messageForStatus(status: number, fallback: string): { title: string; description: string } {
  switch (status) {
    case 400:
      return { title: "잘못된 요청", description: fallback || "입력 값을 확인해 주세요." };
    case 401:
      return {
        title: "로그인이 필요합니다",
        description: fallback || "세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    case 403:
      return { title: "접근 권한 없음", description: fallback || "이 작업을 수행할 권한이 없습니다." };
    case 404:
      return { title: "리소스를 찾을 수 없음", description: fallback || "요청한 데이터가 없습니다." };
    case 408:
      return { title: "요청 시간 초과", description: fallback || "잠시 후 다시 시도해 주세요." };
    case 429:
      return { title: "요청이 너무 많습니다", description: fallback || "잠시 후 다시 시도해 주세요." };
    default:
      if (status >= 500) {
        return {
          title: "서버 오류",
          description: fallback || "서버 점검 중이거나 일시적 오류입니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      return { title: "요청 실패", description: fallback || `오류가 발생했습니다. (${status})` };
  }
}

/**
 * API/네트워크 오류 공통 처리 — 개발 로그 + 사용자 토스트 + 401 리다이렉트
 */
export function handleApiError(error: unknown, options: HandleApiErrorOptions = {}): void {
  const {
    notify = true,
    redirectOn401 = true,
    source = "api",
  } = options;

  const err = normalizeError(error);
  const status = getHttpStatus(error);
  const fallback = err.message;

  logError(error, {
    source,
    status,
    ...(error instanceof ApiError
      ? { url: error.url, method: error.method, extra: { body: error.body } }
      : {}),
  });

  if (status === 401 && redirectOn401) {
    redirectToLogin();
  }

  if (!notify) return;

  const { title, description } =
    options.title && options.description
      ? { title: options.title, description: options.description }
      : status != null
        ? messageForStatus(status, fallback)
        : { title: "네트워크 오류", description: fallback || "연결을 확인해 주세요." };

  toast({
    title,
    description,
    variant: "destructive",
  });
}

/** try/catch 블록에서 한 줄로 처리 */
export async function withApiErrorHandling<T>(
  fn: () => Promise<T>,
  options?: HandleApiErrorOptions
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    handleApiError(e, options);
    return undefined;
  }
}
