"""
AniMatch — FastAPI Backend
Entry point: main.py

Run locally:
  uvicorn main:app --reload --port 8000

In production (Docker):
  uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1

The compiled React/Vite frontend is expected at ./static/
FastAPI serves it directly — no separate Nginx needed for the Docker image.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Load .env before anything else
load_dotenv()

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AniMatch API",
    description=(
        "AI-powered anime recommendation service. "
        "Uses Gemini as the primary LLM with an OpenRouter fallback chain."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow local dev frontend + production domain
# ---------------------------------------------------------------------------
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from routers.recommend import router as recommend_router  # noqa: E402
from routers.random_anime import router as random_router  # noqa: E402

app.include_router(recommend_router, prefix="/api", tags=["recommendations"])
app.include_router(random_router, prefix="/api", tags=["recommendations"])

# ---------------------------------------------------------------------------
# Health-check & root
# ---------------------------------------------------------------------------




@app.get("/health", tags=["health"])
async def health():
    gemini_configured = bool(
        os.getenv("GEMINI_API_KEY")
        and os.getenv("GEMINI_API_KEY") != "your_gemini_api_key_here"
    )
    openrouter_configured = bool(
        os.getenv("OPENROUTER_API_KEY")
        and os.getenv("OPENROUTER_API_KEY") != "your_openrouter_api_key_here"
    )
    return JSONResponse(
        {
            "status": "ok",
            "gemini_configured": gemini_configured,
            "openrouter_configured": openrouter_configured,
        }
    )


# ---------------------------------------------------------------------------
# Serve static frontend (production — React build)
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Catch-all: return index.html for client-side routing."""
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"error": "Frontend not built yet"}, status_code=404)

    logger.info("Serving static frontend from: %s", STATIC_DIR)
else:
    logger.info("No static/ directory found — running API-only mode.")

logger.info("AniMatch API started. Docs available at /docs")
