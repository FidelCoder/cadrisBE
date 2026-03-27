# Cadris Backend

Backend API for Cadris. This repo owns project persistence, recording metadata, shot-event storage, local development media storage, and export-preview preparation.

## What is in this repo

- Express + TypeScript API
- Local MongoDB-backed project persistence
- Local storage adapter for saved recordings
- Project, recording, and shot-event service layer
- Export-preview endpoint derived from saved timeline metadata

## Local setup

1. Copy `.env.example` to `.env`.
2. Start local MongoDB or point `MONGODB_URI` at a reachable instance.
3. Optionally set `MONGODB_DB_NAME`.
4. Install dependencies with `npm install`.
5. Optionally set `LOCAL_LLM_BASE_URL` and `LOCAL_LLM_MODEL` for local AI review.
6. Start the API with `npm run dev`.

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

- Storage is local-first for development and intentionally abstracted for future S3-compatible storage.
- MongoDB stores project documents with embedded recordings and shot events for a lightweight local prototype path.
- Export generation is metadata-first and lightweight in v1.
- Authentication is not enforced yet.
- Local AI review is wired for an Ollama-compatible runtime so you can generate session notes without cloud tokens.
