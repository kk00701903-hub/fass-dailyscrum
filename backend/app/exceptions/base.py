from typing import Any


class BaseAPIException(Exception):
    """
    모든 비즈니스·API 예외의 기반 클래스.
    HTTP status, error_code, 클라이언트 노출 메시지를 표준화합니다.
    """

    status_code: int = 400
    error_code: str = "API_ERROR"
    default_message: str = "요청을 처리할 수 없습니다."

    def __init__(
        self,
        message: str | None = None,
        *,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.default_message)
        self.message = message or self.default_message
        if error_code is not None:
            self.error_code = error_code
        self.details = details or {}

    def to_log_context(self) -> dict[str, Any]:
        return {
            "error_code": self.error_code,
            "status_code": self.status_code,
            "message": self.message,
            "details": self.details,
        }
