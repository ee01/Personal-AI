import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import { registerWhisperRoutes } from '../whisperRoutes.js';

async function createApp() {
  const app = Fastify();
  await registerWhisperRoutes(app);
  return app;
}

test('GET /whisper/status returns ok payload', async () => {
  const app = await createApp();
  const response = await app.inject({ method: 'GET', url: '/whisper/status' });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.modelReady, 'boolean');
  assert.equal(typeof body.engineLoaded, 'boolean');
  await app.close();
});

test('POST /whisper/session/start returns 503 when model is not ready', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/whisper/session/start',
    payload: { sessionId: 's1' },
  });
  assert.equal(response.statusCode, 503);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'model_not_ready');
  await app.close();
});

test('POST /whisper/session/:id/chunk returns 404 for missing session', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/whisper/session/missing/chunk',
    payload: { pcmBase64: Buffer.from('abc').toString('base64') },
  });
  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'session_not_found');
  await app.close();
});

test('POST /whisper/session/:id/stop returns 404 for missing session', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/whisper/session/missing/stop',
    payload: {},
  });
  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'session_not_found');
  await app.close();
});

test('DELETE /whisper/model returns ok', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'DELETE',
    url: '/whisper/model',
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  await app.close();
});

test('POST /whisper/native-host/install validates extensionIds', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/whisper/native-host/install',
    payload: {},
  });
  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'extension_ids_required');
  await app.close();
});
