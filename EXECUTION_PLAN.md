# Backend Execution Plan

## Beta target

Move Cadris from local prototype mode into a small hosted beta stack that real testers can access reliably over HTTPS.

## Phase 1: Public beta blockers

1. Replace local-only persistence assumptions with hosted beta infrastructure.
2. Make recording uploads and playback URLs reliable for external users.
3. Add the minimum safety rails for abuse, logging, and failure visibility.
4. Keep optional AI review from blocking the core recording product.

## Backend task list

### 1. Hosting and environment

- Deploy the API to a stable hosted runtime with HTTPS.
- Move MongoDB to a reachable hosted instance for beta use.
- Replace local filesystem recording storage with an S3-compatible object store.
- Keep the storage adapter modular so beta storage and local dev storage can coexist.
- Configure environment variables for frontend origin, storage base URL, and database access per environment.

### 2. Upload and media reliability

- Confirm large mobile upload handling works under realistic network conditions.
- Add clear size limits and useful error messages for failed uploads.
- Validate stored content type, duration metadata, and playback URL correctness.
- Ensure saved raw recordings and directed preview assets can be reopened and streamed by real testers.
- Add retry-safe behavior where possible around recording persistence.

### 3. API tightening

- Add request validation for all externally reachable write routes.
- Add rate limiting on project creation, upload, export, and AI routes.
- Tighten CORS to expected beta frontend origins.
- Add consistent structured error responses so beta support is easier.
- Keep health endpoints simple and production-friendly.

### 4. Observability and support

- Add basic request logging with request IDs.
- Capture upload failures, export failures, and AI failures in logs with enough context to debug.
- Surface app version/build info so frontend and backend logs can be correlated.
- Prepare a small support playbook for “recording saved but missing audio,” “upload failed,” and “model unavailable.”

### 5. Storage and retention

- Decide the beta retention policy for recordings and previews.
- Add backup expectations for project metadata and stored media.
- Ensure object keys are stable and safe for public beta traffic.
- Make sure deletion and cleanup can be added later without a storage refactor.

### 6. AI review strategy

- Keep Ollama-based review optional for beta.
- Do not make local Ollama a blocker for public users, because it is not a realistic external-user dependency.
- If AI review is exposed in beta, gate it behind a feature flag or graceful fallback.
- Preserve the core beta promise around recording, directing, review, and export even if AI review is unavailable.

## Phase 2: Beta rollout sequence

1. Deploy backend staging environment.
2. Deploy hosted database and object storage.
3. Point frontend staging at the hosted backend.
4. Run end-to-end upload, reopen, review, and export checks.
5. Invite a very small tester group first.
6. Watch logs and tighten limits before widening access.

## Go / no-go checklist

- External users can create projects and save recordings without local developer services.
- Saved recordings and directed previews remain accessible after page reload and on a second device.
- Upload failures, oversized files, and missing assets fail with clear API responses.
- The backend no longer depends on local disk and local-only networking assumptions for beta traffic.
- Optional AI review does not break the core recording workflow when unavailable.

## Backend guidance

- Keep the API thin and the service layer typed.
- Preserve the original recording and timeline metadata for every session.
- Favor reliable beta operations over clever architecture.
- Avoid adding extra markdown docs beyond the repo cap.
