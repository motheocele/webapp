'use strict';

const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');
const { getRequiredEnv, groupNameForSession, readJson, validateMotRequest } = require('../lib');

function nowIso() {
  return new Date().toISOString();
}

function toResponseEvent({ requestId, sessionId, replyText, commands = [], edits = [] }) {
  return {
    v: 1,
    requestId,
    sessionId,
    createdAt: nowIso(),
    replyText,
    commands,
    edits
  };
}

async function bestEffortSendAckToPubSub(context, { requestId, sessionId }) {
  // Temporary safety net:
  // If the async worker/consumer isn't running, the UI will stay on "…" forever.
  // So we publish an immediate ack reply to the session group.
  //
  // This is intentionally best-effort: if Web PubSub env vars aren't present,
  // we just skip without failing the request.

  const enabled = String(process.env.MOT_ACK_REPLY_ENABLED ?? 'true').toLowerCase();
  if (enabled === 'false' || enabled === '0' || enabled === 'no') return;

  const connStr = process.env.WEBPUBSUB_CONNECTION_STRING;
  const hub = process.env.WEBPUBSUB_HUB;
  if (!connStr || !hub) return;

  try {
    const group = groupNameForSession(sessionId);
    const client = new WebPubSubServiceClient(connStr, hub);

    const evt = toResponseEvent({
      requestId,
      sessionId,
      replyText: 'Received — processing…',
      commands: [],
      edits: []
    });

    await client.group(group).sendToAll(evt, { contentType: 'application/json' });
  } catch (err) {
    context.warn('mot/requests: failed to send ack via WebPubSub (ignored)', String(err));
  }
}

app.http('motRequests', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mot/requests',
  handler: async (req, context) => {
    try {
      const body = await readJson(req);
      const validation = validateMotRequest(body);
      if (!validation.ok) {
        return {
          status: 400,
          jsonBody: { error: validation.message }
        };
      }

      const connectionString = getRequiredEnv('SERVICEBUS_CONNECTION_STRING');
      const queueName = getRequiredEnv('SERVICEBUS_QUEUE_NAME');

      const sb = new ServiceBusClient(connectionString);
      const sender = sb.createSender(queueName);

      const messageBody = {
        ...body,
        sessionId: validation.sessionId,
        requestId: validation.requestId,
        receivedAt: nowIso()
      };

      await sender.sendMessages({
        body: messageBody,
        contentType: 'application/json'
      });

      await sender.close();
      await sb.close();

      // Fire-and-forget ack reply to avoid UI hanging if no consumer is running.
      await bestEffortSendAckToPubSub(context, {
        requestId: validation.requestId,
        sessionId: validation.sessionId
      });

      return {
        status: 202,
        jsonBody: { requestId: validation.requestId, ok: true }
      };
    } catch (err) {
      context.error('mot/requests failed', err);
      return {
        status: 500,
        jsonBody: { error: 'Internal Server Error' }
      };
    }
  }
});
