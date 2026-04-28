import test from 'node:test';
import assert from 'node:assert/strict';

import { createPcmStreamer } from '../pcmStreamer';

class FakePort {
  onmessage: ((event: { data?: unknown }) => void) | null = null;
}

class FakeAudioWorkletNode {
  port = new FakePort();
  disconnect(): void {}
}

class FakeAudioContext {
  audioWorklet = {
    addModule: async (_url: string): Promise<void> => undefined,
  };

  createMediaStreamSource(_stream: MediaStream): {
    connect: (_node: unknown) => void;
    disconnect: () => void;
  } {
    return {
      connect: (_node: unknown): void => undefined,
      disconnect: (): void => undefined,
    };
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeMediaStream {
  constructor(_tracks: MediaStreamTrack[] = []) {}
}

class FakeTrack {
  stopped = false;

  clone(): MediaStreamTrack {
    return this as unknown as MediaStreamTrack;
  }

  stop(): void {
    this.stopped = true;
  }
}

test('PcmStreamer registers and unregisters chunk handlers', async () => {
  const globalWithAudio = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    AudioWorkletNode?: typeof AudioWorkletNode;
    chrome?: typeof chrome;
  };

  globalWithAudio.AudioContext =
    FakeAudioContext as unknown as typeof AudioContext;
  globalWithAudio.AudioWorkletNode =
    FakeAudioWorkletNode as unknown as typeof AudioWorkletNode;
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  globalWithAudio.chrome = {
    runtime: {
      getURL: (path: string): string => path,
    } as unknown as typeof chrome.runtime,
  } as unknown as typeof chrome;

  const fakeTrack = new FakeTrack();

  const streamer = createPcmStreamer(fakeTrack as unknown as MediaStreamTrack);
  let count = 0;
  const off = streamer.onChunk(() => {
    count += 1;
  });
  off();
  await streamer.start();
  streamer.stop();
  assert.equal(count, 0);
});

test('PcmStreamer.stop releases cloned track', async () => {
  const globalWithAudio = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    AudioWorkletNode?: typeof AudioWorkletNode;
    chrome?: typeof chrome;
  };

  globalWithAudio.AudioContext =
    FakeAudioContext as unknown as typeof AudioContext;
  globalWithAudio.AudioWorkletNode =
    FakeAudioWorkletNode as unknown as typeof AudioWorkletNode;
  Object.defineProperty(globalThis, 'MediaStream', {
    value: FakeMediaStream,
    configurable: true,
    writable: true,
  });
  globalWithAudio.chrome = {
    runtime: {
      getURL: (path: string): string => path,
    } as unknown as typeof chrome.runtime,
  } as unknown as typeof chrome;

  const fakeTrack = new FakeTrack();
  const streamer = createPcmStreamer(fakeTrack as unknown as MediaStreamTrack);
  await streamer.start();
  streamer.stop();
  assert.equal(fakeTrack.stopped, true);
});
