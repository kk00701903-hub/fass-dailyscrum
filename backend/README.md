# Scrum API (Python / FastAPI)

중앙 집중형 예외 핸들러가 포함된 엔터프라이즈 API 스켈레톤입니다.

## 구조

```
backend/
  app/
    main.py                 # 엔트리 — logging + register_exception_handlers
    core/logging_config.py  # 터미널 + logs/api.log
    exceptions/
      base.py               # BaseAPIException
      custom.py             # InvalidInput, Unauthorized, DatabaseTimeout, …
    schemas/error_response.py
    middleware/exception_handler.py
  requirements.txt
  logs/                     # 실행 시 자동 생성
```

## 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 비즈니스 코드에서 사용

```python
from app.exceptions import InvalidInputException, DatabaseTimeoutException

if not email:
    raise InvalidInputException("이메일은 필수입니다.")

# 또는
raise DatabaseTimeoutException()
```

## 에러 응답 예시

```json
{
  "success": false,
  "error_code": "INVALID_INPUT",
  "message": "email 필드 형식이 올바르지 않습니다.",
  "timestamp": "2026-05-22T00:00:00+00:00"
}
```

5xx 미처리 예외는 클라이언트에 `INTERNAL_SERVER_ERROR` / `서버 내부 오류가 발생했습니다.` 만 반환하고, 스택은 `logs/api.log` 및 터미널에 기록됩니다.

## 기존 앱에 통합

```python
from app.core.logging_config import setup_logging
from app.middleware.exception_handler import register_exception_handlers

setup_logging(log_dir="logs")
app = FastAPI()
register_exception_handlers(app)
# app.include_router(your_existing_router)
```
