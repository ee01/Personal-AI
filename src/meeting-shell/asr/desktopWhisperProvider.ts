import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';
import { createPcmStreamer } from './pcmStreamer';

const MAX_CHUNK_BYTES = 900 * 1024;

interface WhisperStatusResponse {
  ok: boolean;
  modelReady?: boolean;
  downloadInProgress?: boolean;
  downloadProgress?: number;
  engineLoaded?: boolean;
  activeSessionId?: string | null;
}

interface WhisperChunkResponse {
  ok?: boolean;
  interim?: string | null;
  final?: string | null;
  error?: string;
}

interface BackgroundWhisperRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

export class DesktopWhisperProvider implements ASRProvider {
  readonly tier: MeetingPilotASRTier = 'desktop_whisper';

  private emitter = createASREventEmitter();
  private sessionId: string | undefined;
  private pcmStreamer: ReturnType<typeof createPcmStreamer> | undefined;
  private stopped = false;
  private unsubPcm: (() => void) | undefined;

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
      if (!status.modelReady) {
        void this._triggerModelDownload();
        return { ok: false, reason: 'model_downloading' };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'desktop_app_not_running' };
    }
  }

  async start(audio: MediaStreamTrack | MediaStream): Promise<void> {
    this.stopped = false;
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

    this.sessionId = `session-${Date.now()}`;
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'starting',
      ts: Date.now(),
    });

    try {
      await this._sendToBackground({
        method: 'POST',
        path: '/whisper/session/start',
        body: { sessionId: this.sessionId },
      });
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
    this.unsubPcm = this.pcmStreamer.onChunk((buffer) => {
      void this._sendChunk(buffer);
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
        if (result?.final) {
          this.emitter.emit('transcript', {
            kind: 'final',
            text: result.final,
            tier: 'desktop_whisper',
            ts: Date.now(),
          });
        }
      } catch {
        // ignore stop errors
      }
      this.sessionId = undefined;
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

  private async _sendChunk(buffer: ArrayBuffer): Promise<void> {
    if (this.stopped || !this.sessionId) return;

    if (buffer.byteLength > MAX_CHUNK_BYTES) {
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

      if (result?.interim) {
        this.emitter.emit('transcript', {
          kind: 'interim',
          text: result.interim,
          tier: 'desktop_whisper',
          ts: Date.now(),
        });
      }
    } catch {
      // chunk errors are non-fatal
    }
  }

  private async _fetchStatus(): Promise<WhisperStatusResponse | null> {
    const response = await this._sendToBackground<WhisperStatusResponse>({
      method: 'GET',
      path: '/whisper/status',
    }).catch(() => null);
    if (!response || response.ok === false) return null;
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
    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'WHISPER_NM_REQUEST', ...message },
        (response: T) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        },
      );
    });
  }
}
