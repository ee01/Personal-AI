import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';
import {
  normalizeMeetingTranscribeLanguage,
  type MeetingTranscribeLanguage,
} from '../../utils';

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
  lang?: string;
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

function getPreferredSpeechLangs(language: MeetingTranscribeLanguage): string[] {
  const values =
    language === 'en-US'
      ? ['en-US', 'en', 'zh-CN']
      : language === 'zh-CN'
        ? ['zh-CN', 'zh', 'en-US']
        : [
            'zh-CN',
            typeof navigator !== 'undefined' ? navigator.language : '',
            'en-US',
          ];
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean)),
  );
}

function isAvailableResult(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value === 'available';
  if (Array.isArray(value)) return value.includes('available');
  return false;
}

function formatAvailabilityResult(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
  private language: MeetingTranscribeLanguage;
  private lang = 'zh-CN';
  private stopped = false;

  constructor(language: MeetingTranscribeLanguage | string = 'auto') {
    this.language = normalizeMeetingTranscribeLanguage(language);
    if (this.language === 'en-US') {
      this.lang = 'en-US';
    }
  }

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
        const availabilityResults: string[] = [];
        for (const lang of getPreferredSpeechLangs(this.language)) {
          const result = await SR.available({
            langs: [lang],
            processLocally: true,
          });
          availabilityResults.push(
            `${lang}: ${formatAvailabilityResult(result)}`,
          );
          if (isAvailableResult(result)) {
            this.lang = lang;
            return { ok: true };
          }
        }
        return {
          ok: false,
          reason: `on-device language pack unavailable (${availabilityResults.join('; ')})`,
        };
      } catch (error) {
        return {
          ok: false,
          reason: `SpeechRecognition.available() threw: ${String(
            (error as Error)?.message || error,
          )}`,
        };
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
    recognition.lang = this.lang;
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
