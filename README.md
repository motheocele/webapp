# webapp

Azure Static Web Apps-ready repository:

- `frontend/` React + Vite + TypeScript
- `docs/` Notes / decisions

## Prereqs

- Node.js (>= 20)

## Local development

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

## Repo conventions

- No secrets in git.
- No direct pushes to `main`.
