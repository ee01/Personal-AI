import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyzePcm16SpeechPresence,
  getWhisperEngineState,
  isWhisperLoaded,
  loadWhisperModel,
  releaseWhisperEngine,
  retainWhisperEngine,
  transcribeWithWhisper,
  unloadWhisperModel,
} from '../whisperEngine.js';

test('isWhisperLoaded returns false before loading', () => {
  assert.equal(isWhisperLoaded(), false);
});

test('loadWhisperModel rejects with model_missing for nonexistent path', async () => {
  await assert.rejects(
    () => loadWhisperModel('/nonexistent/path/model.bin'),
    (err: any) => {
      assert.equal(err.code, 'model_missing');
      assert.ok(typeof err.message === 'string');
      return true;
    },
  );
});

test('isWhisperLoaded still false after failed load', async () => {
  try {
    await loadWhisperModel('/nonexistent/path/model.bin');
  } catch {
    // expected
  }
  assert.equal(isWhisperLoaded(), false);
});

test('unloadWhisperModel resolves without error when not loaded', async () => {
  await assert.doesNotReject(() => unloadWhisperModel());
});

test('analyzePcm16SpeechPresence rejects silence and low noise', () => {
  const silence = Buffer.alloc(16000 * 2 * 3);
  const lowNoise = Buffer.alloc(16000 * 2 * 3);
  for (let i = 0; i < lowNoise.length / 2; i += 1) {
    lowNoise.writeInt16LE(i % 2 === 0 ? 220 : -220, i * 2);
  }

  assert.equal(analyzePcm16SpeechPresence(silence).likelyHasSpeech, false);
  assert.equal(analyzePcm16SpeechPresence(lowNoise).likelyHasSpeech, false);
});

test('analyzePcm16SpeechPresence accepts sustained speech-like signal', () => {
  const pcm = Buffer.alloc(16000 * 2);
  for (let i = 0; i < pcm.length / 2; i += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 220 * i) / 16000) * 1800);
    pcm.writeInt16LE(value, i * 2);
  }

  assert.equal(analyzePcm16SpeechPresence(pcm).likelyHasSpeech, true);
});

test('transcribeWithWhisper skips silent PCM before invoking the CLI', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'whisper-silence-test-'));
  const modelPath = join(dir, 'model.bin');
  await writeFile(modelPath, Buffer.from('test-model'));

  try {
    await unloadWhisperModel();
    await loadWhisperModel(modelPath);
    const result = await transcribeWithWhisper(Buffer.alloc(16000 * 2 * 3), {
      language: 'zh',
    });
    assert.equal(result.text, '');
    assert.deepEqual(result.segments, []);
  } finally {
    await unloadWhisperModel();
    await rm(dir, { recursive: true, force: true });
  }
});

test('whisper engine tracks active sessions and idle unload window', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'whisper-engine-test-'));
  const modelPath = join(dir, 'model.bin');
  await writeFile(modelPath, Buffer.from('test-model'));

  try {
    await unloadWhisperModel();
    await loadWhisperModel(modelPath);
    retainWhisperEngine();

    let state = getWhisperEngineState();
    assert.equal(state.loaded, true);
    assert.equal(state.mode, 'cli_warm');
    assert.equal(state.activeSessionRefs, 1);
    assert.equal(state.idleUnloadAt, undefined);

    releaseWhisperEngine();
    state = getWhisperEngineState();
    assert.equal(state.activeSessionRefs, 0);
    assert.equal(typeof state.idleUnloadAt, 'number');
    assert.ok(state.idleUnloadMs >= 5000);
  } finally {
    await unloadWhisperModel();
    await rm(dir, { recursive: true, force: true });
  }
});
