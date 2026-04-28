import test from 'node:test';
import assert from 'node:assert/strict';

import { WebSpeechProvider } from '../webSpeechProvider';

class FakeSpeechRecognition {
  static availableResult: unknown = true;
  static available = async () => FakeSpeechRecognition.availableResult;

  continuous = false;
  interimResults = false;
  processLocally?: boolean;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  startCalls = 0;
  abortCalls = 0;

  start(): void {
    this.startCalls += 1;
  }

  abort(): void {
    this.abortCalls += 1;
  }
}

class FakeMediaStream {
  getAudioTracks(): MediaStreamTrack[] {
    return [];
  }
}

class FakeMediaStreamTrack {}

function installSpeechRecognition(): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      SpeechRecognition: FakeSpeechRecognition,
    } as unknown as Window,
    configurable: true,
    writable: true,
  });
}

function clearSpeechRecognition(): void {
  Object.defineProperty(globalThis, 'window', {
    value: {} as unknown as Window,
    configurable: true,
    writable: true,
  });
}

test('WebSpeechProvider.isAvailable returns false when SpeechRecognition is missing', async () => {
  clearSpeechRecognition();
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'MediaStreamTrack', {
    value: FakeMediaStreamTrack,
    configurable: true,
    writable: true,
  });
  const provider = new WebSpeechProvider();
  const result = await provider.isAvailable();
  assert.equal(result.ok, false);
});

test('WebSpeechProvider.isAvailable returns true when available() succeeds', async () => {
  installSpeechRecognition();
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'MediaStreamTrack', {
    value: FakeMediaStreamTrack,
    configurable: true,
    writable: true,
  });
  FakeSpeechRecognition.availableResult = true;
  const provider = new WebSpeechProvider();
  const result = await provider.isAvailable();
  assert.equal(result.ok, true);
});

test('WebSpeechProvider emits fatal audio error when no track provided', async () => {
  installSpeechRecognition();
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'MediaStreamTrack', {
    value: FakeMediaStreamTrack,
    configurable: true,
    writable: true,
  });
  const provider = new WebSpeechProvider();
  const errors: Array<{ code: string; fatal: boolean }> = [];
  provider.on('error', (event) => {
    errors.push({ code: event.code, fatal: event.fatal });
  });
  await provider.start(new FakeMediaStream() as unknown as MediaStream);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.code, 'audio');
  assert.equal(errors[0]?.fatal, true);
});

test('WebSpeechProvider.stop emits stopped status', async () => {
  installSpeechRecognition();
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'MediaStreamTrack', {
    value: FakeMediaStreamTrack,
    configurable: true,
    writable: true,
  });
  const provider = new WebSpeechProvider();
  const statuses: string[] = [];
  provider.on('status', (event) => {
    statuses.push(event.state);
  });
  await provider.stop();
  assert.equal(statuses.includes('stopped'), true);
});
