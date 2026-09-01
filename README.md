# Resolvent Billing Software

Commercial billing and inventory application built with React, Vite, Material UI, FastAPI, SQLAlchemy, and PostgreSQL.

## Local development

See `.env.example` in both `frontend/` and `backend/`.

## Staging deployment

Follow [`STAGING-DEPLOYMENT.md`](./STAGING-DEPLOYMENT.md).

## Git hooks

A `pre-push` hook in `.githooks/` blocks a push if `backend/requirements.txt` can't be
installed cleanly (bad version pin, conflicting packages, a typo'd package name, etc.).

One-time setup per clone:

```bash
git config core.hooksPath .githooks
```

On Windows, run this from Git Bash (the same shell `git push` already uses to run hooks).

The check builds a throwaway virtual environment and runs `pip install -r backend/requirements.txt`
in it, so it takes a few seconds on each push. To skip it once (not recommended):

```bash
SKIP_REQUIREMENTS_CHECK=1 git push
```

## Important

Do not commit `.env`, `.venv`, `node_modules`, local databases, or generated build output.
