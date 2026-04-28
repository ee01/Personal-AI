import test from 'node:test';
import assert from 'node:assert/strict';

import { DesktopWhisperProvider } from '../desktopWhisperProvider';

class FakeMediaStream {
  getAudioTracks(): MediaStreamTrack[] {
    return [];
  }
}

class FakeMediaStreamTrack {}

test('DesktopWhisperProvider.isAvailable rejects unsupported platform', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { platform: 'Windows' } as unknown as Navigator,
    configurable: true,
    writable: true,
  });
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
  const provider = new DesktopWhisperProvider();
  const result = await provider.isAvailable();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'platform_unsupported');
});

test('DesktopWhisperProvider emits fatal audio error when no track provided', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { platform: 'MacIntel' } as unknown as Navigator,
    configurable: true,
    writable: true,
  });
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
  const provider = new DesktopWhisperProvider();
  const errors: Array<{ code: string; fatal: boolean }> = [];
  provider.on('error', (event) => {
    errors.push({ code: event.code, fatal: event.fatal });
  });
  await provider.start(new FakeMediaStream() as unknown as MediaStream);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.code, 'audio');
  assert.equal(errors[0]?.fatal, true);
});

test('DesktopWhisperProvider.stop emits stopped status', async () => {
  const provider = new DesktopWhisperProvider();
  const statuses: string[] = [];
  provider.on('status', (event) => {
    statuses.push(event.state);
  });
  await provider.stop();
  assert.equal(statuses.includes('stopped'), true);
});
