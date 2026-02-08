# Architecture (v0 scaffold)

This repo targets **Azure Static Web Apps (SWA)**.

- **Frontend**: React + Vite + TypeScript
- **Backend**: ASP.NET Core Web API (.NET 8 LTS)

SWA hosts the static frontend and can route `/api/*` to the backend API.

## Decisions

- **Backend style**: Minimal APIs (simple, fast to iterate)
- **Auth**: deferred for scaffold PR; v0 auth target is **Entra ID**
- **UI library**: none for scaffold (keep minimal)
- **Environments**: dev-only for now

## Notes

CI workflow changes are intentionally avoided in this PR unless explicitly requested.
There is an existing SWA deployment workflow in `.github/workflows/`.
