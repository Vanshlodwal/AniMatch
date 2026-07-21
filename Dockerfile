# ============================================================
# AniMatch — Multi-stage Dockerfile
# Stage 1: Build the React/Vite frontend
# Stage 2: Run FastAPI, serving static frontend via StaticFiles
# ============================================================

# ---- Stage 1: Frontend build ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (layer cache)
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ .
RUN npm run build
# Output: /app/frontend/dist/


# ---- Stage 2: FastAPI backend ----
FROM python:3.11-slim AS backend

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy compiled frontend into static directory
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
