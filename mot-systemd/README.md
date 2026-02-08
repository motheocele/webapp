# mot-systemd-messagereceiver

Systemd-managed message receiver for Mot: **Azure Service Bus queue → Mot (via OpenClaw Gateway) → Azure Web PubSub**.

## What’s included

- `mot-worker/worker.js` — Service Bus consumer + PubSub publisher.
- `mot-worker/mot-worker.service` — systemd unit file (template).
- `mot-worker/mot-worker.env.example` — env var template.

## Install (host)

1. Copy the unit file:

```bash
sudo cp mot-worker/mot-worker.service /etc/systemd/system/mot-worker.service
```

2. Create the env file:

```bash
sudo cp mot-worker/mot-worker.env.example /etc/mot-worker.env
sudo nano /etc/mot-worker.env
```

Set `OPENCLAW_GATEWAY_TOKEN` to your local gateway token.

3. Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mot-worker
sudo systemctl status mot-worker --no-pager
```

## Notes

- The worker calls `POST /v1/responses` on the local OpenClaw gateway.
- Replies published to Web PubSub include `replyText`, `commands`, and `edits`.
