import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { ApiError } from "@/lib/errors/api-error";
import { handleApiError } from "@/lib/errors/handle-api-error";
import { logError } from "@/lib/errors/log-error";

export type CreateAxiosOptions = {
  baseURL?: string;
  /** 응답 에러 시 자동 토스트·401 처리 (기본 true) */
  notifyOnError?: boolean;
};

function toApiError(error: AxiosError<unknown>): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;
  const body =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : { raw: String(data ?? "") };

  let message = error.message;
  if (body.errorMessages && Array.isArray(body.errorMessages)) {
    message = body.errorMessages.map(String).join(" · ");
  } else if (body.message) message = String(body.message);
  else if (body.error) message = String(body.error);

  return new ApiError({
    message,
    status: status || 500,
    statusText: error.response?.statusText ?? "",
    url: error.config?.url ?? "",
    method: (error.config?.method ?? "get").toUpperCase(),
    body,
    cause: error,
  });
}

/**
 * Axios 인스턴스 + 응답 인터셉터 (상태 코드별 토스트·401 리다이렉트)
 */
export function createAxiosClient(options: CreateAxiosOptions = {}): AxiosInstance {
  const { baseURL, notifyOnError = true } = options;

  const client = axios.create({
    baseURL,
    timeout: 60_000,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (axios.isCancel(error)) return Promise.reject(error);

      const apiErr = axios.isAxiosError(error) ? toApiError(error) : error;

      logError(apiErr, {
        source: "axios",
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        url: error.config?.url,
        method: error.config?.method,
      });

      if (notifyOnError) {
        handleApiError(apiErr, { source: "axios" });
      }

      return Promise.reject(apiErr);
    }
  );

  return client;
}

/** 기본 공유 인스턴스 (데모·신규 API용) */
export const http = createAxiosClient({ notifyOnError: true });

export type AxiosRequestConfigWithNotify = InternalAxiosRequestConfig & {
  skipErrorNotify?: boolean;
};
