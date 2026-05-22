"""
중앙 집중형 예외 핸들러 — FastAPI exception_handler 등록 인터페이스.

main.py:
    from app.middleware.exception_handler import register_exception_handlers
    register_exception_handlers(app)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions.base import BaseAPIException
from app.schemas.error_response import ErrorResponse

if TYPE_CHECKING:
    pass

logger = logging.getLogger("app.exception")

# 클라이언트에 노출하지 않는 5xx 기본 메시지
INTERNAL_ERROR_MESSAGE = "서버 내부 오류가 발생했습니다."
INTERNAL_ERROR_CODE = "INTERNAL_SERVER_ERROR"


def _json_error(
    *,
    status_code: int,
    error_code: str,
    message: str,
) -> JSONResponse:
    body = ErrorResponse.from_exception(error_code=error_code, message=message)
    return JSONResponse(status_code=status_code, content=body.model_dump())


async def handle_base_api_exception(_request: Request, exc: BaseAPIException) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error(
            "BaseAPIException (5xx): %s",
            exc.error_code,
            extra=exc.to_log_context(),
            exc_info=exc,
        )
    else:
        logger.warning("BaseAPIException: %s", exc.error_code, extra=exc.to_log_context())

    return _json_error(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
    )


async def handle_http_exception(_request: Request, exc: HTTPException) -> JSONResponse:
    code = f"HTTP_{exc.status_code}"
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("message") or detail.get("detail") or exc.detail)
        code = str(detail.get("error_code") or code)
    elif isinstance(detail, list):
        message = "; ".join(str(d) for d in detail)
    else:
        message = str(detail) if detail else "요청을 처리할 수 없습니다."

    if exc.status_code >= 500:
        logger.error("HTTPException %s: %s", exc.status_code, message, exc_info=exc)
        message = INTERNAL_ERROR_MESSAGE
        code = INTERNAL_ERROR_CODE

    return _json_error(status_code=exc.status_code, error_code=code, message=message)


async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    fields = ", ".join(
        f"{'.'.join(str(loc) for loc in e.get('loc', []))}: {e.get('msg', '')}"
        for e in errors[:5]
    )
    message = f"요청 형식이 올바르지 않습니다. ({fields})" if fields else "요청 형식이 올바르지 않습니다."
    logger.info("Validation error: %s", fields or exc)

    return _json_error(
        status_code=422,
        error_code="VALIDATION_ERROR",
        message=message,
    )


async def handle_unhandled_exception(_request: Request, exc: Exception) -> JSONResponse:
    """미처리 예외 — 스택 트레이스는 로그만, 클라이언트에는 마스킹 메시지."""

    # DB 드라이버 타임아웃 등 운영체제/라이브러리 예외 패턴 (선택적 매핑)
    exc_name = type(exc).__name__.lower()
    if "timeout" in exc_name or "timed out" in str(exc).lower():
        logger.exception("Database/IO timeout", extra={"path": _request.url.path})
        return _json_error(
            status_code=504,
            error_code="DATABASE_TIMEOUT",
            message="데이터베이스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
        )

    logger.exception(
        "Unhandled exception on %s %s",
        _request.method,
        _request.url.path,
        extra={"client": _request.client.host if _request.client else None},
    )

    return _json_error(
        status_code=500,
        error_code=INTERNAL_ERROR_CODE,
        message=INTERNAL_ERROR_MESSAGE,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """
    FastAPI 앱에 전역 예외 핸들러를 등록합니다.
    라우터·DB 세션 등록 후, listen 전에 1회 호출하세요.
    """
    app.add_exception_handler(BaseAPIException, handle_base_api_exception)
    app.add_exception_handler(HTTPException, handle_http_exception)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unhandled_exception)

    logger.debug("Global exception handlers registered")
