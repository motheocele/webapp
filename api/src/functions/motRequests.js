'use strict';

const { app } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const { getRequiredEnv, readJson, validateMotRequest } = require('../lib');

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

      const messageBody = { ...body, sessionId: validation.sessionId, receivedAt: new Date().toISOString() };

      await sender.sendMessages({
        body: messageBody,
        contentType: 'application/json'
      });

      await sender.close();
      await sb.close();

      return {
        status: 202,
        jsonBody: { ok: true }
      };
    } catch (err) {
      context.error('mot/requests failed', err);
      const status = err && err.code === 'MISSING_ENV' ? 500 : 500;
      return {
        status,
        jsonBody: { error: 'Internal Server Error' }
      };
    }
  }
});
