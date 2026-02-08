# PR #1 Summary (Scaffold)

Purpose: bootstrap a clean scaffold for an Azure Static Web Apps project.

## What exists now

### Repo structure

- `frontend/` React + Vite + TypeScript
  - TypeScript strict
  - ESLint + Prettier
  - Vitest + Testing Library with a passing sample test (`src/App.test.tsx`)
  - Scripts: `dev`, `build`, `test`, `test:watch`, `lint`, `lint:fix`, `format`, `format:check`
- `backend/` ASP.NET Core Web API (.NET 8 LTS)
  - Minimal API endpoints:
    - `GET /health` -> 200 + JSON `{ status: "ok" }`
    - `GET /api/version` -> assembly name + version
  - Test project `WebApp.Api.Tests` with `Microsoft.AspNetCore.Mvc.Testing`
    - Passing smoke test for `/health`
- `docs/architecture.md` basic architecture/decisions
- Root `README.md` with local run instructions

### Tooling versions (on VM)

- Node: v22.22.0
- npm: 10.9.4
- .NET SDK: 8.0.123

## How to run locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend/WebApp.Api
dotnet run
```

Backend tests:

```bash
cd backend/WebApp.Api.Tests
dotnet test
```

## GitHub App auth status

- GitHub App installation token flow is working.
- Branch `scaffold/initial-webapp` was created via GitHub API.

## Open items / next steps

1. **CI**: A minimal PR workflow (build/lint/test for both frontend+backend) is required by the original brief,
   but there is already an SWA deploy workflow in `.github/workflows/` and we are not modifying workflows unless explicitly requested.
   If you approve, we will add a new minimal workflow (no deploy) triggered on pull_request.
2. **SWA alignment**: confirm desired SWA layout (`app_location: frontend`, `api_location: backend/WebApp.Api`, `output_location: dist`).
3. **Entra ID auth**: implement after scaffold.
