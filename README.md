# Cadris Backend

Backend API for Cadris. This repo owns project persistence, recording metadata, shot-event storage, media storage, and export-preview preparation.

## What is in this repo

- Express + TypeScript API
- Local MongoDB-backed project persistence
- Modular storage adapter for local disk or S3-compatible object storage
- Project, recording, directed-preview, and shot-event service layer
- Export-preview endpoint derived from saved timeline metadata
- Beta-oriented health, request logging, and write-rate limiting

## Local setup

1. Copy `.env.example` to `.env`.
2. Start local MongoDB or point `MONGODB_URI` at a reachable instance.
3. Optionally set `MONGODB_DB_NAME`.
4. Install dependencies with `npm install`.
5. Choose `STORAGE_PROVIDER=local` for dev or `STORAGE_PROVIDER=s3` for hosted beta.
6. If using `s3`, set `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
7. Optionally set `S3_PUBLIC_BASE_URL` if your bucket is publicly served.
8. Optionally set `LOCAL_LLM_BASE_URL` and `LOCAL_LLM_MODEL` for local AI review.
9. Set `ENABLE_LOCAL_LLM=false` for public beta if you do not want the deployment depending on Ollama.
10. Start the API with `npm run dev`.

Default local URL:

- Backend API: `http://localhost:4000`
- MongoDB: `mongodb://127.0.0.1:27017`

## Local Ollama

The backend is configured for an Ollama-compatible runtime at `http://127.0.0.1:11434` and a default model of `llama3.2:1b`.

Typical local flow:

1. Start the server with `/home/core/.local/bin/ollama serve`
2. Pull the configured model with `/home/core/.local/bin/ollama pull llama3.2:1b`
3. Verify backend connectivity with `GET /api/ai/health`

The health route should report `reachable: true` and list `llama3.2:1b` in `availableModels`.

## Beta deployment notes

- `GET /api/health` now reports environment, version, storage mode, CORS allowlist, and write-rate limits.
- Every request receives an `X-Request-Id` response header and is logged in a structured JSON line format.
- Write endpoints are protected with a lightweight in-memory rate limit for beta traffic shaping.
- Hosted beta should use explicit `CORS_ORIGIN` values rather than `*`.
- Object storage can stay private and be proxied through `GET /api/storage/*`, or you can provide `S3_PUBLIC_BASE_URL` for direct asset URLs.
- Local Ollama is optional for beta and can be disabled entirely with `ENABLE_LOCAL_LLM=false`.
- The S3-compatible storage path is intended for a modern hosted runtime. For beta deploys, run the backend on Node 20+ even though local development can stay on the lighter local-storage path.

## Core endpoints

- `GET /api/health`
- `GET /api/ai/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `POST /api/projects/:projectId/recordings`
- `POST /api/projects/:projectId/export`
- `POST /api/projects/:projectId/insights`
- `GET /api/storage/*`

## MVP notes

- Storage is local-first for development and can switch to S3-compatible storage for hosted beta.
- MongoDB stores project documents with embedded recordings and shot events for a lightweight local prototype path.
- Recording persistence now keeps the untouched source clip and can also store a lightweight directed preview clip captured during recording.
- Export generation stays lightweight in v1 and surfaces the latest directed preview plus timeline-derived segments.
- Authentication is not enforced yet.
- Local AI review is wired for an Ollama-compatible runtime so you can generate session notes without cloud tokens.
