# Product Requirements Document (PRD)
## AniMatch — AI-Powered Anime Recommendation App

**Version:** 1.0
**Prepared for:** Vibe Coding Masterclass — Building & Deploying an AI Web Application on AWS
**Author:** [Your Name / Team Names]
**Date:** [Insert Date]

---

## 1. Overview

**AniMatch** is a full-stack AI web application that recommends anime titles to users based on **age**, **preferred genre**, and **current mood**. It also includes a **"Surprise Me" random recommendation button** for users who want a spontaneous pick. The app uses an LLM (Google Gemini as the primary model, with an OpenRouter.ai fallback chain) to generate personalized, explained recommendations rather than a static database lookup — the LLM reasons about tone, themes, and age-appropriateness and returns a short, human-like rationale with each suggestion.

---

## 2. Problem Statement

Anime catalogs (Crunchyroll, Netflix, MyAnimeList, etc.) are enormous, and generic "top 10" lists don't account for a viewer's age-appropriateness needs, emotional state, or specific genre cravings on a given day. Parents looking for age-safe content, casual viewers who don't know what they're in the mood for, and long-time fans wanting a "next watch" often bounce between review sites and forums. There is no lightweight, conversational tool that combines **age filtering + genre + mood** into a single AI-generated recommendation with an explanation.

---

## 3. Objective

Build and deploy a publicly accessible AI web app that:
- Takes structured user input (age, genre, mood) and returns 1–3 tailored anime recommendations with a short "why this fits you" explanation.
- Offers a one-click **Random Anime** button for instant, low-effort discovery.
- Streams the AI's response progressively in the UI.
- Runs on a secure backend that never exposes API keys, with automatic failover between AI providers.
- Is containerized and deployed live on AWS.

---

## 4. Target Users & Use Cases

| User | Use Case |
|---|---|
| Casual viewer | "I'm 22, want something shonen but I'm feeling emotional today — what should I watch?" |
| Parent / guardian | Wants age-appropriate filtering (e.g., nothing above a "16+" tier) before letting a younger viewer pick a title. |
| Long-time otaku | Wants a fast, no-thinking-required pick — hits **Random Anime**. |
| Someone in a specific mood | Sad, hyped, relaxed, nostalgic, romantic, scared — wants a genre+mood combo (e.g., "comedy + need cheering up"). |

---

## 5. Key Features

### 5.1 Core Recommendation Flow
- **Age input** — numeric field or age-band selector (Kids, Teen, Young Adult, Adult). Drives content-rating filtering instructions sent to the LLM (e.g., excluding excessive violence/sexual content for younger bands).
- **Genre selector** — multi-select chips (Action, Romance, Comedy, Isekai, Horror, Slice of Life, Sports, Sci-Fi, Fantasy, Psychological, Mecha, etc.).
- **Mood selector** — single-select chips (Happy, Sad, Stressed, Bored, Nostalgic, Excited, Heartbroken, Relaxed, Curious).
- **Generate Recommendation button** — sends the structured input to the backend, which prompts the LLM and streams back 1–3 recommendations, each with: title, short synopsis, why-it-fits rationale, genre tags, and an approximate age suitability note.

### 5.2 Random Anime Button
- Independent of the form — one click returns a single surprise pick (still age-safety-checked if an age has been set in the session).

### 5.3 Streaming Response
- Recommendations render token-by-token (SSE or chunked fetch) rather than appearing all at once.

### 5.4 Resilient AI Layer
- Primary call goes to **Gemini API**.
- If Gemini fails (timeout, quota, 5xx, safety block), the backend automatically retries the same prompt against a **fallback chain of OpenRouter.ai models**, in order, until one succeeds.
- Failures and which model ultimately served the response are logged server-side.

### 5.5 Session Memory (lightweight)
- Store the user's last-used age/genre/mood in browser local state so returning users don't have to re-enter it (no account system required for MVP).

### 5.6 Responsive UI
- Mobile-first layout; chip selectors and buttons are touch-friendly; recommendation cards reflow to single column on small screens.

---

## 6. Non-Functional Requirements

- **Security:** All API keys (Gemini + OpenRouter) live only in backend environment variables; never sent to or bundled into frontend code.
- **Performance:** First streamed token should appear in under ~3 seconds under normal conditions.
- **Reliability:** The fallback chain should make the app "always answer" even if one provider is down or rate-limited.
- **Cost control:** Stay within Gemini and OpenRouter free-tier limits; AWS budget alert configured; use AWS free-tier-eligible compute.
- **Content safety:** System prompt must instruct the model to respect the stated age band and avoid recommending inappropriate titles for younger users.

---

## 7. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + plain CSS or Tailwind — responsive, single-page app |
| Backend | Python **FastAPI** (async, native streaming support via `StreamingResponse`) |
| Primary LLM | Google **Gemini API** (e.g., `gemini-2.5-flash` or current equivalent — verify latest model name at request time) |
| Fallback LLM Provider | **OpenRouter.ai** (OpenAI-compatible endpoint) with a chain of 4–5 models |
| Containerization | Docker (single container serving API; static frontend build served by FastAPI or a lightweight Nginx stage) |
| Deployment | AWS App Runner (recommended for simplicity) or Elastic Beanstalk |
| Secrets | Environment variables via AWS App Runner service config / `.env` locally (never committed to git) |

### 7.1 Suggested Fallback Chain (OpenRouter)
Configure as an ordered list the backend walks through on failure. Exact model IDs drift over time — confirm current availability and pricing at `openrouter.ai/models` before finalizing, but a reasonable "prominent, stable" chain looks like:

1. `openai/gpt-4o-mini` — fast, cheap, reliable general-purpose fallback
2. `anthropic/claude-3.5-haiku` (or current Haiku-tier Claude model) — strong instruction-following, good backup
3. `meta-llama/llama-3.1-70b-instruct` — solid open-weight option, good cost/performance
4. `mistralai/mistral-large` — European alternative, good creative/explanatory writing
5. `qwen/qwen-2.5-72b-instruct` — final fallback, strong multilingual + general reasoning

> Document in your Project Report the exact final model IDs you used, since OpenRouter's catalog changes — this is also good "prompt engineering documentation" for the grading rubric.

---

## 8. System Architecture

```
[ React Frontend (Vite build) ]
            |
            |  HTTPS (fetch / SSE)
            v
[ FastAPI Backend Container ]
   ├── /api/recommend   (age, genres, mood) -> streams response
   ├── /api/random      -> streams single random pick
   └── AI Router Layer:
         1. Try Gemini API
         2. On failure -> OpenRouter model #1
         3. On failure -> OpenRouter model #2
         4. On failure -> OpenRouter model #3
         5. On failure -> OpenRouter model #4/#5
            |
            v
   [ Docker Image ] -> [ AWS App Runner / Elastic Beanstalk ]
            |
            v
   Public HTTPS URL
```

---

## 9. API Contract (Backend)

**POST `/api/recommend`**
```json
Request:
{
  "age": 22,
  "genres": ["Isekai", "Comedy"],
  "mood": "Bored"
}

Response (streamed text/event-stream):
{
  "title": "...",
  "why": "...",
  "synopsis": "...",
  "age_rating_note": "...",
  "model_used": "gemini-2.5-flash"
}
```

**GET `/api/random?age=22`**
- Returns one streamed recommendation object, same shape as above, with `"random": true`.

---

## 10. Prompting Strategy (for Project Report documentation)

- **System prompt** sets the persona ("You are an expert anime curator..."), enforces JSON-shaped or clearly delimited output, and enforces the age-safety rule.
- **User prompt** is templated from the form inputs: age, genre list, mood, plus an instruction like "avoid recommending anything already suggested in this session" (optional stretch feature).
- Same system + user prompt template is reused across the fallback chain so behavior stays consistent regardless of which model answers.

---

## 11. Milestones / Phase Plan

| Phase | Deliverable |
|---|---|
| 1 | Concept note, wireframe, API contract finalized |
| 2 | FastAPI backend with Gemini integration + streaming |
| 3 | OpenRouter fallback chain implemented and tested (simulate Gemini failure) |
| 4 | React frontend: form, chips, random button, streaming render |
| 5 | Dockerfile + local container test |
| 6 | AWS deployment (App Runner/Elastic Beanstalk) + budget alert setup |
| 7 | Project Report + Concept Note write-up |

---

## 12. Success Metrics (for grading rubric alignment)

- Live public URL returns a working recommendation within the demo.
- Fallback chain demonstrably works (can be shown by disabling the Gemini key live).
- Streaming is visibly progressive, not a single blocking response.
- No API keys present in any frontend bundle or git history.
- Report clearly documents prompts used and phase-by-phase process.

---

## 13. Out of Scope (MVP)

- User accounts / login
- Persistent recommendation history in a database
- Real anime database integration (MyAnimeList/Jikan API) — noted as a future enhancement
- Multi-language UI
