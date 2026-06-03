import test from 'node:test';
import assert from 'node:assert/strict';

import { DesktopLocalAsrProvider } from '../desktopLocalAsrProvider.js';

function setMacNavigator(): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: { platform: 'MacIntel' } as unknown as Navigator,
    configurable: true,
    writable: true,
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installDesktopAsrFetchStub(statusPayload: Record<string, unknown>): void {
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/pair') {
        return jsonResponse({ token: 'test-token' });
      }
      if (url.pathname === '/asr/status') {
        return jsonResponse(statusPayload);
      }
      if (url.pathname === '/asr/model/ensure') {
        return jsonResponse({ ok: true, downloading: true });
      }
      return jsonResponse({ ok: false, error: 'not_found' }, 404);
    },
    configurable: true,
    writable: true,
  });
}

test('DesktopLocalAsrProvider.isAvailable accepts final-only Whisper fallback', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  });

  setMacNavigator();
  installDesktopAsrFetchStub({
    ok: true,
    liveReady: false,
    finalReady: true,
    engines: {
      appleSpeech: { ready: false, reason: 'not_authorized' },
      sherpaStreaming: { modelReady: false, reason: 'missing_model' },
      funasrFinal: { modelReady: false, reason: 'missing_model' },
      whisperFallback: {
        ready: true,
        modelReady: true,
        whisperBinaryAvailable: true,
      },
    },
  });

  const provider = new DesktopLocalAsrProvider('en-US');
  const result = await provider.isAvailable();

  assert.equal(result.ok, true);
});

test('DesktopLocalAsrProvider.isAvailable still rejects when no final engine is ready', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  });

  setMacNavigator();
  installDesktopAsrFetchStub({
    ok: true,
    liveReady: true,
    finalReady: false,
    engines: {
      appleSpeech: { ready: true },
      sherpaStreaming: { modelReady: false, reason: 'missing_model' },
      funasrFinal: { modelReady: false, reason: 'missing_model' },
      whisperFallback: {
        ready: false,
        modelReady: false,
        whisperBinaryAvailable: false,
      },
    },
  });

  const provider = new DesktopLocalAsrProvider('en-US');
  const result = await provider.isAvailable();

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'final_model_not_ready');
});

test('DesktopLocalAsrProvider emits a fatal error after repeated chunk response failures', async () => {
  setMacNavigator();
  const provider = new DesktopLocalAsrProvider('en-US');
  const errors: Array<{ fatal?: boolean; message: string }> = [];
  provider.on('error', (event) => errors.push(event));

  const providerInternals = provider as unknown as {
    sessionId: string;
    stopped: boolean;
    _sendToBackground: () => Promise<unknown>;
    _sendChunk: (
      buffer: ArrayBuffer,
      timing: { startedAt: number; endedAt: number },
    ) => Promise<void>;
  };
  providerInternals.sessionId = 'test-session';
  providerInternals.stopped = false;
  providerInternals._sendToBackground = async () => ({
    ok: true,
    partial: null,
    final: null,
    utteranceId: 'utt-1',
    liveEngine: 'none',
    finalEngine: 'none',
    error: 'desktop ASR stream lost',
  });

  const chunk = new Int16Array(320).buffer;
  await providerInternals._sendChunk(chunk, { startedAt: 1, endedAt: 21 });
  await providerInternals._sendChunk(chunk, { startedAt: 22, endedAt: 42 });
  assert.equal(errors.length, 0);

  await providerInternals._sendChunk(chunk, { startedAt: 43, endedAt: 63 });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fatal, true);
  assert.match(
    errors[0].message,
    /Local ASR stream failed after 3 chunk attempts/,
  );

  await providerInternals._sendChunk(chunk, { startedAt: 64, endedAt: 84 });
  assert.equal(errors.length, 1, 'fatal chunk failure is emitted once');
});

test('DesktopLocalAsrProvider resets chunk failure count after a successful chunk', async () => {
  setMacNavigator();
  const provider = new DesktopLocalAsrProvider('en-US');
  const errors: Array<{ fatal?: boolean; message: string }> = [];
  provider.on('error', (event) => errors.push(event));

  const providerInternals = provider as unknown as {
    sessionId: string;
    stopped: boolean;
    _sendToBackground: () => Promise<unknown>;
    _sendChunk: (
      buffer: ArrayBuffer,
      timing: { startedAt: number; endedAt: number },
    ) => Promise<void>;
  };
  providerInternals.sessionId = 'test-session';
  providerInternals.stopped = false;
  let callCount = 0;
  providerInternals._sendToBackground = async () => {
    callCount += 1;
    if (callCount === 3) {
      return {
        ok: true,
        partial: null,
        final: 'fallback transcript',
        utteranceId: 'utt-1',
        liveEngine: 'none',
        finalEngine: 'whisper_cpp',
        fallbackFinalEngine: 'whisper_cpp',
      };
    }
    throw new Error('bridge unavailable');
  };

  const chunk = new Int16Array(320).buffer;
  await providerInternals._sendChunk(chunk, { startedAt: 1, endedAt: 21 });
  await providerInternals._sendChunk(chunk, { startedAt: 22, endedAt: 42 });
  await providerInternals._sendChunk(chunk, { startedAt: 43, endedAt: 63 });
  await providerInternals._sendChunk(chunk, { startedAt: 64, endedAt: 84 });
  await providerInternals._sendChunk(chunk, { startedAt: 85, endedAt: 105 });

  assert.equal(errors.length, 0);
});
