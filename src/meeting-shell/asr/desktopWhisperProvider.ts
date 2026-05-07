import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';
import { createPcmStreamer } from './pcmStreamer';
import { sanitizeASRTranscriptText } from './transcriptFilter';
import {
  normalizeMeetingTranscribeLanguage,
  type MeetingTranscribeLanguage,
} from '../../utils';

const MAX_CHUNK_BYTES = 900 * 1024;
const DESKTOP_WHISPER_BASE_URL = 'http://127.0.0.1:46321';
const IDLE_FLUSH_DELAY_MS = 900;

function hasLikelySpeechPcm16(buffer: ArrayBuffer): boolean {
  const samples = new Int16Array(buffer);
  if (!samples.length) return false;
  let sumSquares = 0;
  let peak = 0;
  let activeFrames = 0;
  let totalFrames = 0;
  const frameSize = Math.max(1, Math.round(16000 * 0.02));
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = Math.abs(samples[i] || 0) / 32768;
    sumSquares += normalized * normalized;
    if (normalized > peak) peak = normalized;
  }
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let frameSumSquares = 0;
    let framePeak = 0;
    for (let i = start; i < end; i += 1) {
      const normalized = Math.abs(samples[i] || 0) / 32768;
      frameSumSquares += normalized * normalized;
      if (normalized > framePeak) framePeak = normalized;
    }
    const frameRms = Math.sqrt(frameSumSquares / Math.max(1, end - start));
    if (frameRms >= 0.006 || framePeak >= 0.025) {
      activeFrames += 1;
    }
    totalFrames += 1;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  const activeFrameRatio = totalFrames > 0 ? activeFrames / totalFrames : 0;
  return (
    rms >= 0.008 ||
    (rms >= 0.003 && peak >= 0.025 && activeFrameRatio >= 0.08) ||
    (rms >= 0.005 && peak >= 0.018 && activeFrameRatio >= 0.18)
  );
}

interface WhisperStatusResponse {
  ok: boolean;
  error?: string;
  modelReady?: boolean;
  whisperBinaryAvailable?: boolean;
  whisperBinaryInstallInProgress?: boolean;
  downloadInProgress?: boolean;
  downloadProgress?: number;
  engineLoaded?: boolean;
  activeSessionId?: string | null;
}

interface WhisperChunkResponse {
  ok?: boolean;
  interim?: string | null;
  final?: string | null;
  flushed?: boolean;
  error?: string;
}

interface WhisperSessionStartResponse {
  ok?: boolean;
  sessionId?: string;
  error?: string;
}

interface BackgroundWhisperRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

export class DesktopWhisperProvider implements ASRProvider {
  readonly tier: MeetingPilotASRTier = 'desktop_whisper';

  private language: MeetingTranscribeLanguage;
  private emitter = createASREventEmitter();
  private sessionId: string | undefined;
  private sessionStartedAt = 0;
  private pcmStreamer: ReturnType<typeof createPcmStreamer> | undefined;
  private stopped = false;
  private unsubPcm: (() => void) | undefined;
  private directBridgeToken: string | undefined;
  private idleFlushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(language: MeetingTranscribeLanguage | string = 'auto') {
    this.language = normalizeMeetingTranscribeLanguage(language);
  }

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    if (
      typeof navigator !== 'undefined' &&
      !navigator.platform?.toLowerCase().includes('mac')
    ) {
      return { ok: false, reason: 'platform_unsupported' };
    }

    try {
      const status = await this._fetchStatus();
      if (!status) {
        return { ok: false, reason: 'desktop_app_not_running' };
      }
      if (status.ok === false) {
        return { ok: false, reason: status.error || 'desktop_app_unavailable' };
      }
      if (!status.modelReady) {
        void this._triggerModelDownload();
        return { ok: false, reason: 'model_downloading' };
      }
      if (!status.whisperBinaryAvailable) {
        return {
          ok: false,
          reason: status.whisperBinaryInstallInProgress
            ? 'whisper_binary_installing'
            : 'whisper_binary_missing',
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'desktop_app_not_running' };
    }
  }

  async start(audio: MediaStreamTrack | MediaStream): Promise<void> {
    this.stopped = false;
    this._clearIdleFlushTimer();
    const track =
      audio instanceof MediaStreamTrack ? audio : audio.getAudioTracks()[0];
    if (!track) {
      this.emitter.emit('error', {
        tier: 'desktop_whisper',
        code: 'audio',
        message: 'No audio track',
        ts: Date.now(),
        fatal: true,
      });
      return;
    }

    this.sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    this.sessionStartedAt = Date.now();
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'starting',
      ts: Date.now(),
    });

    try {
      const result = await this._sendToBackground<WhisperSessionStartResponse>({
        method: 'POST',
        path: '/whisper/session/start',
        body: { sessionId: this.sessionId, language: this.language },
      });
      if (result?.ok === false) {
        throw new Error(result.error || 'session_start_failed');
      }
    } catch (e) {
      this.emitter.emit('error', {
        tier: 'desktop_whisper',
        code: 'network',
        message: `Failed to start session: ${String((e as Error)?.message || e)}`,
        ts: Date.now(),
        fatal: true,
      });
      return;
    }

    this.pcmStreamer = createPcmStreamer(track);
    this.unsubPcm = this.pcmStreamer.onChunk((buffer, timing) => {
      void this._sendChunk(buffer, timing);
    });

    await this.pcmStreamer.start();
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'running',
      ts: Date.now(),
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this._clearIdleFlushTimer();

    if (this.unsubPcm) {
      this.unsubPcm();
      this.unsubPcm = undefined;
    }

    if (this.pcmStreamer) {
      this.pcmStreamer.stop();
      this.pcmStreamer = undefined;
    }

    if (this.sessionId) {
      try {
        const result = await this._sendToBackground<WhisperChunkResponse>({
          method: 'POST',
          path: `/whisper/session/${this.sessionId}/stop`,
          body: {},
        });
        const finalText = sanitizeASRTranscriptText(result?.final);
        if (finalText) {
          this.emitter.emit('transcript', {
            kind: 'final',
            text: finalText,
            tier: 'desktop_whisper',
            ts: this.sessionStartedAt || Date.now(),
          });
        }
      } catch {
        // ignore stop errors
      }
      this.sessionId = undefined;
      this.sessionStartedAt = 0;
    }

    this.emitter.emit('status', {
      tier: 'desktop_whisper',
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

  private async _sendChunk(
    buffer: ArrayBuffer,
    timing: { startedAt: number; endedAt: number },
  ): Promise<void> {
    if (this.stopped || !this.sessionId) return;

    if (buffer.byteLength > MAX_CHUNK_BYTES) {
      return;
    }
    if (!hasLikelySpeechPcm16(buffer)) {
      return;
    }

    try {
      const result = await this._sendToBackground<WhisperChunkResponse>({
        method: 'POST',
        path: `/whisper/session/${this.sessionId}/chunk`,
        body: {
          pcmBase64: btoa(
            String.fromCharCode(...Array.from(new Uint8Array(buffer))),
          ),
        },
      });

      const interimText = sanitizeASRTranscriptText(result?.interim);
      if (interimText) {
        this.emitter.emit('transcript', {
          kind: 'final',
          text: interimText,
          tier: 'desktop_whisper',
          ts: timing.startedAt,
        });
      } else if (result?.interim == null) {
        this._scheduleIdleFlush();
      }
    } catch {
      // chunk errors are non-fatal
    }
  }

  private _scheduleIdleFlush(): void {
    if (!this.sessionId || this.stopped) return;
    const sessionId = this.sessionId;
    this._clearIdleFlushTimer();
    this.idleFlushTimer = setTimeout(() => {
      this.idleFlushTimer = undefined;
      if (this.sessionId !== sessionId || this.stopped) return;
      void this._flushBufferedSpeech(sessionId);
    }, IDLE_FLUSH_DELAY_MS);
  }

  private _clearIdleFlushTimer(): void {
    if (!this.idleFlushTimer) return;
    clearTimeout(this.idleFlushTimer);
    this.idleFlushTimer = undefined;
  }

  private async _flushBufferedSpeech(sessionId: string): Promise<void> {
    try {
      const result = await this._sendToBackground<WhisperChunkResponse>({
        method: 'POST',
        path: `/whisper/session/${sessionId}/chunk`,
        body: { flush: true },
      });
      const interimText = sanitizeASRTranscriptText(result?.interim);
      if (interimText) {
        this.emitter.emit('transcript', {
          kind: 'final',
          text: interimText,
          tier: 'desktop_whisper',
          ts: Date.now(),
        });
      }
    } catch {
      // idle flush is best-effort
    }
  }

  private async _fetchStatus(): Promise<WhisperStatusResponse | null> {
    const response = await this._sendToBackground<WhisperStatusResponse>({
      method: 'GET',
      path: '/whisper/status',
    }).catch(() => null);
    if (!response) return null;
    return response;
  }

  private async _triggerModelDownload(): Promise<void> {
    try {
      await this._sendToBackground<WhisperChunkResponse>({
        method: 'POST',
        path: '/whisper/model/ensure',
        body: {},
      });
    } catch {
      // ignore
    }
  }

  private async _sendToBackground<T>(
    message: BackgroundWhisperRequest,
  ): Promise<T> {
    try {
      const response = await new Promise<T | undefined>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'WHISPER_NM_REQUEST', ...message },
          (response: T | undefined) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          },
        );
      });

      if (response) return response;
    } catch {
      // The background bridge can be disrupted by other MV3 message listeners.
      // Fall back to the desktop app's localhost bridge from this extension view.
    }

    return this._sendDirectly<T>(message);
  }

  private async _pairDirectly(): Promise<string> {
    const response = await fetch(`${DESKTOP_WHISPER_BASE_URL}/pair`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = (await response.json().catch(() => null)) as {
      token?: string;
      error?: string;
    } | null;
    if (!response.ok || !payload?.token) {
      throw new Error(payload?.error || 'desktop_pair_failed');
    }
    this.directBridgeToken = payload.token;
    return payload.token;
  }

  private async _sendDirectly<T>(
    message: BackgroundWhisperRequest,
    retry = true,
  ): Promise<T> {
    const token = this.directBridgeToken || (await this._pairDirectly());
    const response = await fetch(`${DESKTOP_WHISPER_BASE_URL}${message.path}`, {
      method: message.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-bridge-token': token,
      },
      body:
        message.body && message.method !== 'GET'
          ? JSON.stringify(message.body)
          : undefined,
    });

    if (response.status === 401 && retry) {
      this.directBridgeToken = undefined;
      await this._pairDirectly();
      return this._sendDirectly<T>(message, false);
    }

    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null;
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    if (!payload) {
      throw new Error('desktop_empty_response');
    }
    return payload;
  }
}
