import { normalizeError } from "@/lib/errors/log-error";

export type ApiErrorBody = {
  message?: string;
  error?: string;
  errorMessages?: string[];
  raw?: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly method: string;
  readonly body: ApiErrorBody | null;

  constructor(params: {
    message: string;
    status: number;
    statusText?: string;
    url?: string;
    method?: string;
    body?: ApiErrorBody | null;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText ?? "";
    this.url = params.url ?? "";
    this.method = params.method ?? "GET";
    this.body = params.body ?? null;
    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }

  static async fromResponse(
    res: Response,
    init?: { method?: string; parsedBody?: unknown; fallbackMessage?: string }
  ): Promise<ApiError> {
    const method = init?.method ?? "GET";
    let body: ApiErrorBody | null = null;
    let text = "";

    if (init?.parsedBody !== undefined) {
      body =
        typeof init.parsedBody === "object" && init.parsedBody !== null
          ? (init.parsedBody as ApiErrorBody)
          : { raw: String(init.parsedBody) };
    } else {
      try {
        text = await res.text();
        body = text ? (JSON.parse(text) as ApiErrorBody) : null;
      } catch {
        body = text ? { raw: text.slice(0, 400) } : null;
      }
    }

    const message =
      init?.fallbackMessage ??
      extractMessageFromBody(body) ??
      (res.statusText || `HTTP ${res.status}`);

    return new ApiError({
      message,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      method,
      body,
    });
  }
}

export function extractMessageFromBody(body: ApiErrorBody | null): string | null {
  if (!body) return null;
  if (Array.isArray(body.errorMessages) && body.errorMessages.length > 0) {
    return body.errorMessages.map(String).join(" · ");
  }
  if (body.message) return String(body.message);
  if (body.error) return String(body.error);
  if (body.raw) return String(body.raw);
  return null;
}

export function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  const ax = error as { response?: { status?: number }; status?: number };
  if (typeof ax.response?.status === "number") return ax.response.status;
  if (typeof ax.status === "number") return ax.status;
  const match = normalizeError(error).message.match(/HTTP\s+(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
