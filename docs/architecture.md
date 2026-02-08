# Architecture

This repo targets **Azure Static Web Apps (SWA)**.

- **Frontend**: React + Vite + TypeScript
- **Backend/API**: none (static-only)

## Notes

- Authentication can be handled by SWA (e.g. Entra ID) and accessed via `/.auth/*` routes.
- The workflow in `.github/workflows/` builds and deploys the frontend from `frontend/`.
