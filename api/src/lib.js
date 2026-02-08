'use strict';

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing required env var: ${name}`);
    err.code = 'MISSING_ENV';
    throw err;
  }
  return v;
}

function groupNameForSession(sessionId) {
  return `session-${sessionId}`;
}

async function readJson(req) {
  // Azure Functions v4 HttpRequest has .json(); but keep this helper easy to test.
  if (typeof req.json === 'function') return await req.json();
  if (req.body && typeof req.body === 'object') return req.body;
  return null;
}

function validateMotRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Body must be a JSON object' };
  }
  const { sessionId, requestId } = body;
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return { ok: false, message: 'sessionId is required' };
  }
  if (typeof requestId !== 'string' || requestId.trim().length === 0) {
    return { ok: false, message: 'requestId is required' };
  }
  // Keep permissive: allow extra fields.
  return { ok: true, sessionId: sessionId.trim(), requestId: requestId.trim() };
}

module.exports = {
  getRequiredEnv,
  groupNameForSession,
  readJson,
  validateMotRequest
};
