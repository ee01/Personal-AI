import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWhisperLoaded,
  loadWhisperModel,
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
