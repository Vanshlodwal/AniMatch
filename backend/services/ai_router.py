"""
AI Router — the resilient LLM layer for AniMatch.

Strategy:
  1. Try Google Gemini (gemini-2.5-flash) via the google-genai SDK.
  2. On any failure (timeout, quota, 5xx, safety block), fall through to
     the OpenRouter.ai fallback chain using the openai-compatible endpoint.
  3. Each fallback model is tried in order; the first successful one wins.
  4. The model that ultimately answered is returned alongside the streamed text.

All streaming is done via Python async generators so FastAPI can use
StreamingResponse without buffering the full LLM output.
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Optional

from google import genai
from google.genai import types as genai_types
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GEMINI_MODEL = "gemini-2.5-flash"

# OpenRouter fallback chain (tried in order)
OPENROUTER_FALLBACK_CHAIN = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "meta-llama/llama-3.1-70b-instruct",
    "mistralai/mistral-large",
    "qwen/qwen-2.5-72b-instruct",
]

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GEMINI_TIMEOUT_SECONDS = 30


def _init_gemini() -> Optional[genai.Client]:
    """Create and return a Gemini async client, or None if key is missing."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        logger.warning("GEMINI_API_KEY not set — Gemini will be skipped.")
        return None
    return genai.Client(api_key=api_key)


def _get_openrouter_client() -> Optional[AsyncOpenAI]:
    """Create an OpenAI-compatible async client pointing at OpenRouter."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key or api_key == "your_openrouter_api_key_here":
        logger.warning("OPENROUTER_API_KEY not set — fallback chain disabled.")
        return None
    return AsyncOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=api_key,
    )


# ---------------------------------------------------------------------------
# Gemini streaming generator
# ---------------------------------------------------------------------------


async def _stream_gemini(
    client: genai.Client,
    system_prompt: str,
    user_prompt: str,
    response_schema: Optional[type] = None,
) -> AsyncGenerator[str, None]:
    """
    Streams text chunks from Gemini using the new google-genai SDK.
    Raises on any error (caller catches and falls through to next model).
    """
    config = genai_types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.9,
        max_output_tokens=2048,
    )
    if response_schema is not None:
        config.response_mime_type = "application/json"
        config.response_schema = response_schema

    async for chunk in await asyncio.wait_for(
        client.aio.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=config,
        ),
        timeout=GEMINI_TIMEOUT_SECONDS,
    ):
        if chunk.text:
            yield chunk.text


# ---------------------------------------------------------------------------
# OpenRouter streaming generator
# ---------------------------------------------------------------------------


async def _stream_openrouter(
    client: AsyncOpenAI,
    model_id: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Streams text chunks from a single OpenRouter model.
    Raises on any error.
    """
    response_format = {"type": "json_object"} if json_mode else None
    
    try:
        stream = await client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
            temperature=0.9,
            max_tokens=2048,
            response_format=response_format,
            extra_headers={
                "HTTP-Referer": "https://animatch.app",
                "X-Title": "AniMatch",
            },
        )
    except Exception as exc:
        # If the model does not support JSON mode response_format, fallback to standard stream
        if "response_format" in str(exc) or "bad request" in str(exc).lower():
            logger.warning("OpenRouter model %s does not support response_format, falling back to standard text mode", model_id)
            stream = await client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                stream=True,
                temperature=0.9,
                max_tokens=2048,
                extra_headers={
                    "HTTP-Referer": "https://animatch.app",
                    "X-Title": "AniMatch",
                },
            )
        else:
            raise exc

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


# ---------------------------------------------------------------------------
# Public API — the main router function
# ---------------------------------------------------------------------------


async def stream_recommendation(
    system_prompt: str,
    user_prompt: str,
    is_random: bool = False,
) -> AsyncGenerator[str, None]:
    """
    The top-level AI routing function.

    Yields Server-Sent Event (SSE) formatted strings:
      data: <json chunk>\n\n

    The final SSE carries the model_used field so the frontend knows
    which model answered.
    """
    from models.schemas import AnimeRecommendationLLM, AnimeRecommendationsList

    gemini_client = _init_gemini()
    openrouter_client = _get_openrouter_client()

    model_used: Optional[str] = None
    accumulated_text = ""
    response_schema = AnimeRecommendationLLM if is_random else AnimeRecommendationsList

    # --- Attempt 1: Gemini ---
    if gemini_client is not None:
        try:
            logger.info("Attempting Gemini (%s)…", GEMINI_MODEL)
            async for chunk in _stream_gemini(
                gemini_client, system_prompt, user_prompt, response_schema=response_schema
            ):
                accumulated_text += chunk
                yield f"data: {json.dumps({'chunk': chunk, 'model_used': GEMINI_MODEL})}\n\n"
            model_used = GEMINI_MODEL
            logger.info("Gemini responded successfully.")
        except Exception as exc:
            logger.warning("Gemini failed (%s): %s", type(exc).__name__, exc)
            accumulated_text = ""
            # Fall through to OpenRouter

    # --- Attempt 2+: OpenRouter fallback chain ---
    if model_used is None:
        if openrouter_client is None:
            error_msg = "All AI providers unavailable. Please configure API keys."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            yield "data: [DONE]\n\n"
            return

        for model_id in OPENROUTER_FALLBACK_CHAIN:
            try:
                logger.info("Attempting OpenRouter model: %s", model_id)
                async for chunk in _stream_openrouter(
                    openrouter_client, model_id, system_prompt, user_prompt, json_mode=True
                ):
                    accumulated_text += chunk
                    yield f"data: {json.dumps({'chunk': chunk, 'model_used': model_id})}\n\n"
                model_used = model_id
                logger.info("OpenRouter model %s responded successfully.", model_id)
                break
            except Exception as exc:
                logger.warning(
                    "OpenRouter model %s failed (%s): %s",
                    model_id,
                    type(exc).__name__,
                    exc,
                )
                accumulated_text = ""
                continue

        if model_used is None:
            error_msg = "All AI providers exhausted. Please try again later."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            yield "data: [DONE]\n\n"
            return

    # Signal completion with the final model info
    yield f"data: {json.dumps({'done': True, 'model_used': model_used, 'random': is_random})}\n\n"
    yield "data: [DONE]\n\n"

