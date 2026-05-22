import { ApiError } from "@/lib/errors/api-error";
import { handleApiError, type HandleApiErrorOptions } from "@/lib/errors/handle-api-error";

export type ApiFetchOptions = RequestInit & {
  /** 실패 시 handleApiError 호출 (기본 false — 호출부에서 명시) */
  notifyOnError?: boolean;
  handleErrorOptions?: Omit<HandleApiErrorOptions, "notify">;
};

/**
 * fetch 래퍼 — non-2xx 시 ApiError throw, 선택적으로 토스트·401 처리
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<T> {
  const { notifyOnError = false, handleErrorOptions, ...requestInit } = init ?? {};
  const method = (requestInit.method ?? "GET").toUpperCase();

  let res: Response;
  try {
    res = await fetch(input, requestInit);
  } catch (e) {
    if (notifyOnError) {
      handleApiError(e, { source: "apiFetch:network", ...handleErrorOptions });
    }
    throw e;
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) {
    const err = await ApiError.fromResponse(res, {
      method,
      parsedBody: parsed,
    });
    if (notifyOnError) {
      handleApiError(err, { source: "apiFetch", ...handleErrorOptions });
    }
    throw err;
  }

  if (parsed === null || parsed === "") return undefined as T;
  return parsed as T;
}
