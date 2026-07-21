"""
POST /api/recommend

Accepts age, genres, and mood; returns a streaming SSE response
with 1–3 AI-generated anime recommendations.
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import RecommendRequest
from services.ai_router import stream_recommendation
from services.prompt_builder import build_recommend_prompt

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/recommend")
async def recommend(body: RecommendRequest):
    """
    Generate 1–3 tailored anime recommendations based on user profile.
    Response is streamed as Server-Sent Events (text/event-stream).
    """
    logger.info(
        "Recommend request: age=%d, genres=%s, mood=%s",
        body.age,
        body.genres,
        body.mood,
    )

    try:
        system_prompt, user_prompt = build_recommend_prompt(
            age=body.age,
            genres=body.genres,
            mood=body.mood,
            count=3,
        )
    except Exception as exc:
        logger.error("Failed to build prompt: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

    return StreamingResponse(
        stream_recommendation(system_prompt, user_prompt, is_random=False),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )
