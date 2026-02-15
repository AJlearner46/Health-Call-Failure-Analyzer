"""FastAPI application entrypoint."""

from pathlib import Path
import os
# Load .env from backend directory when running via uvicorn
_env = Path(__file__).resolve().parent.parent / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.constants import PATH_ANALYZE, PATH_ANALYZE_CALL, PATH_HEALTH
from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # cleanup if any


app = FastAPI(
    title="Health Call Agent API",
    description="Analyze call logs to identify purpose and why the purpose was not achieved.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    settings = get_settings()
    base = f"http://127.0.0.1:{settings.port}"
    return {
        "service": "Health Call Agent API",
        "docs": f"{base}/docs",
        "health": f"{base}{PATH_HEALTH}",
        "analyze": f"POST {PATH_ANALYZE} or POST {PATH_ANALYZE_CALL}",
    }
