'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateMotRequest, groupNameForSession } = require('../src/lib');

test('validateMotRequest rejects non-object', () => {
  assert.deepEqual(validateMotRequest(null), { ok: false, message: 'Body must be a JSON object' });
});

test('validateMotRequest requires sessionId', () => {
  assert.equal(validateMotRequest({}).ok, false);
  assert.equal(validateMotRequest({ sessionId: '' }).ok, false);
});

test('validateMotRequest accepts sessionId and trims', () => {
  const r = validateMotRequest({ sessionId: '  abc  ', foo: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.sessionId, 'abc');
});

test('groupNameForSession prefixes session-', () => {
  assert.equal(groupNameForSession('xyz'), 'session-xyz');
});
