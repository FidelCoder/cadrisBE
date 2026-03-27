# Backend Execution Plan

## Current target

Provide a small, practical backend that supports the frontend prototype without introducing unnecessary services.

## Build order

1. Define Prisma models for projects, recordings, and shot events.
2. Add a storage adapter for local development media files.
3. Implement project CRUD and recording upload endpoints.
4. Persist shot timeline metadata alongside original recordings.
5. Expose an export-preview endpoint based on saved shot events.
6. Keep the backend ready for future auth and object-storage upgrades.

## Backend guidance

- Keep the API thin and the service layer typed.
- Do not overbuild job systems for the MVP.
- Preserve the original recording and timeline metadata for every session.
- Design storage and export code so it can move to cloud infrastructure later with minimal churn.
