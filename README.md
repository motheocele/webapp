# webapp

Scaffolded Azure Static Web Apps-ready repository:

- `frontend/` React + Vite + TypeScript
- `backend/` ASP.NET Core Web API (.NET 8 LTS) using Minimal APIs
- `docs/` Architecture notes / decisions

## Prereqs

- Node.js (>= 20)
- .NET SDK 8.x

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Quality gates:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

### Backend API

```bash
cd backend/WebApp.Api
dotnet run
```

Endpoints:

- `GET /health` → `{ "status": "ok" }`
- `GET /api/version` → assembly name + version

Tests:

```bash
cd backend/WebApp.Api.Tests
dotnet test
```

## Repo conventions

- No secrets in git. All secrets come from Azure Key Vault at runtime.
- No direct pushes to `main`.

