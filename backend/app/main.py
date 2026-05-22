"""
API 엔트리 포인트.

실행:
  cd backend
  pip install -r requirements.txt
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI

from app.core.logging_config import setup_logging
from app.exceptions import InvalidInputException, UnauthorizedException
from app.middleware.exception_handler import register_exception_handlers

# ── 로깅 (앱 생성 전 1회) ─────────────────────────────────────────────
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
setup_logging(level=logging.INFO, log_dir=LOG_DIR)

app = FastAPI(
    title="Scrum API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── 전역 예외 핸들러 (라우터 등록 전/후 모두 가능, 보통 라우터 직후) ──
register_exception_handlers(app)

# ── 기존 라우터는 여기에 include (예시) ───────────────────────────────
api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health")
async def health():
    return {"success": True, "status": "ok"}


@api_router.get("/demo/invalid")
async def demo_invalid():
    raise InvalidInputException("email 필드 형식이 올바르지 않습니다.")


@api_router.get("/demo/unauthorized")
async def demo_unauthorized():
    raise UnauthorizedException()


@api_router.get("/demo/crash")
async def demo_crash():
    """미처리 예외 → 500 + 마스킹 메시지 + 서버 로그 스택"""
    raise RuntimeError("simulated internal failure")


# DB 세션 의존성 예시 (실제 SQLAlchemy 세션으로 교체)
async def get_db():
    """placeholder — 기존 get_db / SessionLocal 과 연결"""
    yield None


@api_router.get("/items")
async def list_items(_db=Depends(get_db)):
    return {"success": True, "items": []}


app.include_router(api_router)


@app.get("/")
async def root():
    return {"service": "scrum-api", "docs": "/docs"}
