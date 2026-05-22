from app.exceptions.base import BaseAPIException


class InvalidInputException(BaseAPIException):
    status_code = 400
    error_code = "INVALID_INPUT"
    default_message = "입력 값이 올바르지 않습니다."


class UnauthorizedException(BaseAPIException):
    status_code = 401
    error_code = "UNAUTHORIZED"
    default_message = "인증이 필요합니다."


class ForbiddenException(BaseAPIException):
    status_code = 403
    error_code = "FORBIDDEN"
    default_message = "이 작업을 수행할 권한이 없습니다."


class NotFoundException(BaseAPIException):
    status_code = 404
    error_code = "NOT_FOUND"
    default_message = "요청한 리소스를 찾을 수 없습니다."


class DatabaseTimeoutException(BaseAPIException):
    status_code = 504
    error_code = "DATABASE_TIMEOUT"
    default_message = "데이터베이스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
