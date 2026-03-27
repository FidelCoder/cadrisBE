# Backend Repo Rules

## Repo URLs

- Backend repo: `https://github.com/FidelCoder/cadrisBE.git`
- Frontend repo: `https://github.com/FidelCoder/cadrisFE.git`

## Working rules

- Keep this repo focused on persistence, storage, and API behavior.
- Cap markdown files in this repo at three: `README.md`, `EXECUTION_PLAN.md`, and `REPO_RULES.md`.
- Keep storage modular so local disk can be swapped for S3-compatible object storage later.
- Keep request validation explicit and TypeScript-first.
- Preserve clean separation between route handlers and service logic.
- Avoid adding infrastructure complexity that the MVP does not yet need.
