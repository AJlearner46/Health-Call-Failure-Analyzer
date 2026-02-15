"""Application configuration from environment variables."""

import os
from pathlib import Path
from functools import lru_cache

# Load .env from backend directory so GOOGLE_API_KEY is set before reading
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except Exception:
        pass


def _strip_key(value: str) -> str:
    """Strip whitespace and optional surrounding quotes (e.g. from .env)."""
    if not value:
        return ""
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1]
    return value.strip()


@lru_cache
def get_settings():
    return Settings()


class Settings:
    """Settings loaded from environment."""

    def __init__(self):
        self._google_api_key = _strip_key(os.getenv("GOOGLE_API_KEY", ""))
        single_model = _strip_key(os.getenv("GEMINI_MODEL", ""))
        default_models = "gemini-2.0-flash-lite,gemini-2.0-flash,gemini-2.5-flash-lite,gemini-flash-lite-latest"
        if single_model:
            models_raw = single_model
        else:
            models_raw = _strip_key(os.getenv("GEMINI_MODELS", default_models)) or default_models
        self.gemini_models = [m.strip() for m in models_raw.split(",") if m.strip()]
        self.gemini_model = self.gemini_models[0] if self.gemini_models else "gemini-2.0-flash-lite"
        self.gemini_timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "25"))
        self.gemini_max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "1"))
        # Bind host: 127.0.0.1 for local-only, 0.0.0.0 for all interfaces
        self.host = os.getenv("HOST", "127.0.0.1")
        self.port = int(os.getenv("PORT", "8000"))

    @property
    def google_api_key(self) -> str:
        return self._google_api_key

    @property
    def is_configured(self) -> bool:
        return bool(self._google_api_key)
