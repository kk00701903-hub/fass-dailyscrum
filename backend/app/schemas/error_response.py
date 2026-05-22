from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class ErrorResponse(BaseModel):
    """클라이언트 공통 에러 응답 포맷."""

    success: bool = Field(default=False, description="항상 false")
    error_code: str = Field(..., description="기계 판독용 에러 코드")
    message: str = Field(..., description="사용자 친화 메시지")
    timestamp: str = Field(default_factory=utc_timestamp)

    @classmethod
    def from_exception(
        cls,
        *,
        error_code: str,
        message: str,
        timestamp: str | None = None,
    ) -> "ErrorResponse":
        return cls(
            success=False,
            error_code=error_code,
            message=message,
            timestamp=timestamp or utc_timestamp(),
        )
