export { logError, normalizeError, type ErrorLogContext } from "@/lib/errors/log-error";
export {
  ApiError,
  extractMessageFromBody,
  getHttpStatus,
  isApiError,
  type ApiErrorBody,
} from "@/lib/errors/api-error";
export {
  handleApiError,
  withApiErrorHandling,
  type HandleApiErrorOptions,
} from "@/lib/errors/handle-api-error";
export { initGlobalErrorHandlers } from "@/lib/errors/init-global-handlers";
