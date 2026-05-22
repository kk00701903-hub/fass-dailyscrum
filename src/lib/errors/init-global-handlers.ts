import { isApiError } from "@/lib/errors/api-error";
import { handleApiError } from "@/lib/errors/handle-api-error";
import { logError } from "@/lib/errors/log-error";

let initialized = false;

/**
 * 처리되지 않은 Promise rejection · 전역 JS 에러 훅
 * (루트 main.tsx 에서 1회 호출)
 */
export function initGlobalErrorHandlers(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logError(reason, { source: "unhandledrejection" });

    if (isApiError(reason)) {
      handleApiError(reason, { source: "unhandledrejection", notify: true });
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) => {
    if (event.error) {
      logError(event.error, { source: "window.error" });
    }
  });
}
