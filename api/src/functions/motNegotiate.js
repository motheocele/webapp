'use strict';

const { app } = require('@azure/functions');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');
const { getRequiredEnv, groupNameForSession } = require('../lib');

app.http('motNegotiate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mot/negotiate',
  handler: async (req, context) => {
    try {
      const sessionId = req.query.get('sessionId');
      if (!sessionId || !sessionId.trim()) {
        return { status: 400, jsonBody: { error: 'sessionId is required' } };
      }

      const connectionString = getRequiredEnv('WEBPUBSUB_CONNECTION_STRING');
      const hub = getRequiredEnv('WEBPUBSUB_HUB');

      const group = groupNameForSession(sessionId.trim());

      const serviceClient = new WebPubSubServiceClient(connectionString, hub);

      // Role format: webpubsub.joinLeaveGroup.<group>
      const token = await serviceClient.getClientAccessToken({
        roles: [`webpubsub.joinLeaveGroup.${group}`]
      });

      return {
        status: 200,
        jsonBody: {
          url: token.url,
          hub,
          group
        }
      };
    } catch (err) {
      context.error('mot/negotiate failed', err);
      return {
        status: 500,
        jsonBody: { error: 'Internal Server Error' }
      };
    }
  }
});
