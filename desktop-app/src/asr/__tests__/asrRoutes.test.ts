import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Fastify from 'fastify';

import {
  normalizeAsrLanguage,
  registerAsrRoutes,
  selectLiveEngine,
  shouldFinalizeAsrSegment,
} from '../asrRoutes.js';

let asrModelDir: string;
let whisperModelDir: string;
let previousNodeEnv: string | undefined;

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  asrModelDir = await mkdtemp(join(tmpdir(), 'asr-routes-test-'));
  whisperModelDir = await mkdtemp(join(tmpdir(), 'asr-whisper-test-'));
  process.env.PERSONAL_AI_ASR_MODEL_DIR = asrModelDir;
  process.env.PERSONAL_AI_WHISPER_MODEL_DIR = whisperModelDir;
});

after(async () => {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  delete process.env.PERSONAL_AI_ASR_MODEL_DIR;
  delete process.env.PERSONAL_AI_WHISPER_MODEL_DIR;
  await rm(asrModelDir, { recursive: true, force: true });
  await rm(whisperModelDir, { recursive: true, force: true });
});

async function createApp() {
  const app = Fastify();
  await registerAsrRoutes(app);
  return app;
}

test('normalizeAsrLanguage maps locales to engine language codes', () => {
  assert.equal(normalizeAsrLanguage(undefined), 'auto');
  assert.equal(normalizeAsrLanguage(''), 'auto');
  assert.equal(normalizeAsrLanguage('auto'), 'auto');
  assert.equal(normalizeAsrLanguage('zh-CN'), 'zh');
  assert.equal(normalizeAsrLanguage('en-US'), 'en');
});

test('selectLiveEngine prefers Apple for English and sherpa for Chinese', () => {
  assert.equal(
    selectLiveEngine({
      locale: 'en-US',
      appleReady: true,
      sherpaReady: true,
    }),
    'apple_speech',
  );
  assert.equal(
    selectLiveEngine({
      locale: 'zh-CN',
      appleReady: true,
      sherpaReady: true,
    }),
    'sherpa_streaming',
  );
  assert.equal(
    selectLiveEngine({
      locale: 'zh-CN',
      appleReady: false,
      sherpaReady: true,
    }),
    'sherpa_streaming',
  );
});

test('shouldFinalizeAsrSegment finalizes on endpoint or idle flush once speech exists', () => {
  assert.equal(
    shouldFinalizeAsrSegment({ hasSpeech: false, trailingSilenceMs: 1000 }),
    false,
  );
  assert.equal(
    shouldFinalizeAsrSegment({
      hasSpeech: false,
      trailingSilenceMs: 1000,
      flush: true,
    }),
    false,
  );
  assert.equal(
    shouldFinalizeAsrSegment({ hasSpeech: true, trailingSilenceMs: 200 }),
    false,
  );
  assert.equal(
    shouldFinalizeAsrSegment({ hasSpeech: true, trailingSilenceMs: 900 }),
    true,
  );
  assert.equal(
    shouldFinalizeAsrSegment({
      hasSpeech: true,
      trailingSilenceMs: 0,
      flush: true,
    }),
    true,
  );
});

test('GET /asr/status returns local ASR engine statuses', async () => {
  const app = await createApp();
  const response = await app.inject({ method: 'GET', url: '/asr/status' });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.ready, 'boolean');
  assert.equal(typeof body.engines.sherpaStreaming.modelReady, 'boolean');
  assert.equal(typeof body.engines.funasrFinal.modelReady, 'boolean');
  assert.equal(typeof body.engines.whisperFallback.ready, 'boolean');
  await app.close();
});

test('POST /asr/session/start requires a final engine or fallback final engine', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/asr/session/start',
    payload: { sessionId: 's1', locale: 'en-US' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, 'final_model_not_ready');
  await app.close();
});

test('POST /asr/session/:id/chunk returns 404 for missing session', async () => {
  const app = await createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/asr/session/missing/chunk',
    payload: { pcmBase64: Buffer.from('abc').toString('base64') },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, 'session_not_found');
  await app.close();
});
