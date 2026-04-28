import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtorLike;
    webkitSpeechRecognition?: SpeechRecognitionCtorLike;
  }
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  start(track?: MediaStreamTrack): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtorLike {
  new (): SpeechRecognitionInstanceLike;
  available?: (args: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<unknown>;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtorLike | null {
  return (
    (typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
    null
  );
}

export class WebSpeechProvider implements ASRProvider {
  readonly tier: MeetingPilotASRTier = 'web_speech';

  private emitter = createASREventEmitter();
  private recognition: SpeechRecognitionInstanceLike | undefined;
  private audioTrack: MediaStreamTrack | undefined;
  private stopped = false;

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      return {
        ok: false,
        reason: 'SpeechRecognition not available in this context',
      };
    }
    if (typeof SR.available === 'function') {
      try {
        const result = await SR.available({
          langs: ['en-US'],
          processLocally: true,
        });
        if (!result) {
          return { ok: false, reason: 'on-device model not available' };
        }
      } catch {
        return { ok: false, reason: 'SpeechRecognition.available() threw' };
      }
    }
    return { ok: true };
  }

  async start(audio: MediaStreamTrack | MediaStream): Promise<void> {
    this.stopped = false;
    const track =
      audio instanceof MediaStreamTrack ? audio : audio.getAudioTracks()[0];
    if (!track) {
      this.emitter.emit('error', {
        tier: 'web_speech',
        code: 'audio',
        message: 'No audio track provided',
        ts: Date.now(),
        fatal: true,
      });
      return;
    }
    this.audioTrack = track;
    this.emitter.emit('status', {
      tier: 'web_speech',
      state: 'starting',
      ts: Date.now(),
    });
    this._startRecognition(track);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = undefined;
    }
    this.audioTrack = undefined;
    this.emitter.emit('status', {
      tier: 'web_speech',
      state: 'stopped',
      ts: Date.now(),
    });
  }

  on<K extends keyof ASREventMap>(
    event: K,
    handler: (e: ASREventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  private _startRecognition(track: MediaStreamTrack): void {
    if (this.stopped) return;
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      this.emitter.emit('error', {
        tier: 'web_speech',
        code: 'unavailable',
        message: 'SpeechRecognition not available',
        ts: Date.now(),
        fatal: true,
      });
      return;
    }

    const recognition = new SR();
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    if ('processLocally' in recognition) {
      recognition.processLocally = true;
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      this.emitter.emit('transcript', {
        kind: isFinal ? 'final' : 'interim',
        text: transcript,
        tier: 'web_speech',
        ts: Date.now(),
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event.error;
      if (code === 'no-speech') {
        return;
      }
      const fatal =
        code === 'network' ||
        code === 'not-allowed' ||
        code === 'service-not-allowed' ||
        code === 'audio-capture';
      this.emitter.emit('error', {
        tier: 'web_speech',
        code: fatal ? 'network' : 'unknown',
        message: `SpeechRecognition error: ${code}`,
        ts: Date.now(),
        fatal,
      });
      if (fatal) {
        this.stopped = true;
      }
    };

    recognition.onend = () => {
      if (!this.stopped) {
        this._startRecognition(track);
      }
    };

    try {
      recognition.start(track);
      this.emitter.emit('status', {
        tier: 'web_speech',
        state: 'running',
        ts: Date.now(),
      });
    } catch (err) {
      this.emitter.emit('error', {
        tier: 'web_speech',
        code: 'audio',
        message: `start(audioTrack) failed: ${String((err as Error)?.message || err)}`,
        ts: Date.now(),
        fatal: true,
      });
      this.stopped = true;
    }
  }
}
