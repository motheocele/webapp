# Realtime debug notes (Canvas Notepad)

## Current behavior (before fix)

- UI falls back to **Stub** even when `/api/mot/negotiate` returns HTTP 200 with a valid `wss://.../client/hubs/<hub>?access_token=...` URL.
- Root cause in client code: the realtime transport (`MotRealtimeTransport.init`) awaited `client.start()` **and** `client.joinGroup(group)` via `@azure/web-pubsub-client`.
  - If **joinGroup** failed for any reason (timing/protocol/permissions), `init()` threw.
  - `createBestEffortTransport()` caught that throw and instantiated `MotStubTransport`, causing the UI badge to show *Stub fallback*.
- This incorrectly treats “not connected yet / join not complete” as “realtime unavailable”.

## Fix plan / implementation

1. **Mode selection rule**
   - Keep realtime mode whenever negotiate returns HTTP 200.
   - Only fall back to stub when negotiate is **missing/disabled** (HTTP 404/501).

2. **Web PubSub client connect/join logic**
   - Implement a raw `WebSocket` connection using subprotocol `json.webpubsub.azure.v1`.
   - On `ws.onopen`, send a `joinGroup` command with an `ackId` and wait for `ack`.
   - Do **not** treat “no first server message” as failure.
   - On close, reconnect with backoff (1s → 2s → 5s → 10s max).

3. **Debug instrumentation**
   - Expand the Debug panel to show:
     - negotiate status + httpStatus + ws host (no token)
     - group name
     - ws readyState + onopen/onclose timestamps + close code/reason + onerror
     - joinGroup status + ackId + success/failure
     - last server message snippet

## Validation checklist

- `/api/health` returns `{ ok: true }`.
- `/api/mot/negotiate?sessionId=abc` returns 200 with `{ url, group, hub }`.
- Notepad UI shows **Realtime** and status `Connecting…` → `Connected` (or `Disconnected (retrying…)` if WS drops).
- Debug panel shows:
  - ws readyState transitions 0→1
  - joinGroup reaches `ack success` (or shows the server error payload if it fails)
- Chat send uses `/api/mot/requests` and shows a pending Mot bubble until a response arrives.
