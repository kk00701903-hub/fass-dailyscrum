const isProd = import.meta.env.PROD;

export type ErrorLogContext = {
  source?: string;
  status?: number;
  url?: string;
  method?: string;
  extra?: Record<string, unknown>;
};

/**
 * 개발 환경에서만 구조화된 에러 로그 출력.
 * 프로덕션에서는 민감 스택 노출 없이 짧은 메시지만 남깁니다.
 */
export function logError(error: unknown, context?: ErrorLogContext): void {
  const err = normalizeError(error);
  const payload = {
    message: err.message,
    name: err.name,
    ...context,
    ...(isProd ? {} : { stack: err.stack }),
  };

  if (isProd) {
    console.error("[error]", payload.message, context?.source ?? "");
    return;
  }

  console.groupCollapsed(
    `%c[${context?.source ?? "Error"}]%c ${err.name}: ${err.message}`,
    "color:#dc2626;font-weight:bold",
    "color:inherit;font-weight:normal"
  );
  console.error("context:", payload);
  if (err.stack) console.error(err.stack);
  if (err.cause) console.error("cause:", err.cause);
  console.groupEnd();
}

export function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}
