"""
GET /api/random?age=<optional_int>

Returns a single surprise anime recommendation, streamed as SSE.
Age is optional — if supplied, content-rating safety is applied.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.ai_router import stream_recommendation
from services.prompt_builder import build_random_prompt

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/random")
async def random_anime(age: Optional[int] = None):
    """
    Return one surprise anime pick, streamed as Server-Sent Events.
    Optionally filters by age rating if `age` query param is provided.
    """
    logger.info("Random request: age=%s", age)

    system_prompt, user_prompt = build_random_prompt(age=age)

    return StreamingResponse(
        stream_recommendation(system_prompt, user_prompt, is_random=True),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
