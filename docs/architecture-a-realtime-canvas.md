# Architecture A — Realtime Canvas Notepad (SWA Functions + Service Bus + Web PubSub + VM worker)

## Part 0 — Repo review (baseline)

Repo: https://github.com/motheocele/webapp

### Current layout

- `.github/workflows/`
  - `ci.yml` — runs `npm ci`, `npm run lint`, `npm test`, `npm run build` in `frontend/`.
  - `azure-static-web-apps-*.yml` — deploys Azure Static Web Apps with:
    - `app_location: frontend`
    - `api_location: ""` (no Functions yet)
    - `output_location: dist`
- `docs/` — documentation folder exists.
- `frontend/` — React + Vite + TypeScript.
- `scripts/` — helper scripts.
- No `/api` folder yet.

### Frontend routing + existing notepad code

- Uses `react-router-dom` (v7).
- There is already a `/notepad` page and core notepad components:
  - `frontend/src/pages/NotepadPage.tsx`
  - `frontend/src/components/notepad/CanvasBoard.tsx`
  - `frontend/src/components/notepad/ChatPanel.tsx`
  - Notepad logic in `frontend/src/notepad/*`.
- Current `/notepad` implementation is **stubbed**: it calls `motRespond()` from `frontend/src/notepad/motStub.ts` and applies validated draw commands locally.
- Existing unit tests already cover:
  - command validation/application: `frontend/src/notepad/commands.test.ts`
  - strokes: `frontend/src/notepad/strokes.test.ts`

### Tooling conventions

- Package manager: npm (lockfile present).
- Build: `npm run build` (runs `tsc -b` then `vite build`).
- Tests: `vitest run`.
- Lint: `eslint .`.
- Formatting: Prettier.

### Baseline verification (local)

From a clean checkout on this VM:

```bash
cd frontend
npm ci
npm run build
npm test
```

- `npm ci` ✅
- `npm test` ✅
- `npm run build` ✅ (after fixing an internal mismatch: notepad commands/strokes are now in **pixel coords** with a required `canvas` meta in state)

## Next changes required for Architecture A

- Add `/api` Azure Functions project (SWA-managed Functions).
- Update SWA deploy workflow `api_location` to `api`.
- Replace `motStub` usage in `/notepad` with:
  - negotiate: `GET /api/mot/negotiate?sessionId=...`
  - request enqueue: `POST /api/mot/requests`
  - realtime events: Web PubSub client connection
- Add shared protocol (schema + validators) and geometry “stroke sharpening” tests.
- Add VM worker (Service Bus receive → PubSub publish) in a non-inbound, outbound-only pattern.
