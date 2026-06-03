import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';
import { createPcmStreamer } from './pcmStreamer';
import { sanitizeASRTranscriptText } from './transcriptFilter';
import {
  normalizeMeetingTranscribeLanguage,
  type MeetingTranscribeLanguage,
} from '../../utils';

const MAX_CHUNK_BYTES = 900 * 1024;
const DESKTOP_ASR_BASE_URL = 'http://127.0.0.1:46321';
const IDLE_FLUSH_DELAY_MS = 900;
const MAX_CLIENT_TRAILING_SILENCE_MS = 900;
const MAX_CONSECUTIVE_CHUNK_FAILURES = 3;

type LocalLiveEngine = 'apple_speech' | 'sherpa_streaming' | 'none';
type LocalFinalEngine = 'funasr_nano' | 'whisper_cpp' | 'none';
type LocalAsrChannel = 'tab' | 'mic';

interface AsrStatusResponse {
  ok: boolean;
  error?: string;
  ready?: boolean;
  liveReady?: boolean;
  finalReady?: boolean;
  engines?: {
    appleSpeech?: { ready?: boolean; reason?: string };
    sherpaStreaming?: { modelReady?: boolean; reason?: string };
    funasrFinal?: { modelReady?: boolean; reason?: string };
    whisperFallback?: {
      ready?: boolean;
      modelReady?: boolean;
      whisperBinaryAvailable?: boolean;
      whisperBinaryInstallInProgress?: boolean;
    };
  };
  downloadInProgress?: boolean;
  downloadProgress?: number;
}

interface AsrChunkResponse {
  ok?: boolean;
  partial?: string | null;
  final?: string | null;
  utteranceId?: string;
  liveEngine?: LocalLiveEngine;
  finalEngine?: LocalFinalEngine;
  fallbackFinalEngine?: LocalFinalEngine;
  flushed?: boolean;
  error?: string;
}

interface AsrSessionStartResponse {
  ok?: boolean;
  sessionId?: string;
  liveEngine?: LocalLiveEngine;
  finalEngine?: LocalFinalEngine;
  fallbackFinalEngine?: LocalFinalEngine;
  error?: string;
}

interface BackgroundAsrRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

function getPreferredLocale(language: MeetingTranscribeLanguage): string {
  if (language === 'zh-CN' || language === 'en-US') {
    return language;
  }
  return 'auto';
}

function formatEngineLabel(
  liveEngine: LocalLiveEngine | undefined,
  finalEngine: LocalFinalEngine | undefined,
  fallbackFinalEngine: LocalFinalEngine | undefined,
): string {
  const live =
    liveEngine === 'apple_speech'
      ? 'Apple'
      : liveEngine === 'sherpa_streaming'
        ? 'sherpa'
        : 'no live';
  const final =
    finalEngine === 'funasr_nano'
      ? 'FunASR'
      : finalEngine === 'whisper_cpp'
        ? 'Whisper'
        : fallbackFinalEngine === 'whisper_cpp'
          ? 'Whisper'
          : 'no final';
  return `Local ASR · ${live} → ${final}`;
}

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
    if (frameRms >= 0.006 || framePeak >= 0.025) activeFrames += 1;
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

export class DesktopLocalAsrProvider implements ASRProvider {
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
  private liveEngine: LocalLiveEngine | undefined;
  private finalEngine: LocalFinalEngine | undefined;
  private fallbackFinalEngine: LocalFinalEngine | undefined;
  private lastChainLabel: string | undefined;
  private lastPartialByUtterance = new Map<string, string>();
  private chunkSendQueue: Promise<void> = Promise.resolve();
  private channel: LocalAsrChannel;
  private clientHasSpeech = false;
  private clientTrailingSilenceMs = 0;
  private consecutiveChunkFailures = 0;
  private fatalChunkFailureEmitted = false;

  constructor(
    language: MeetingTranscribeLanguage | string = 'auto',
    channel: LocalAsrChannel = 'tab',
  ) {
    this.language = normalizeMeetingTranscribeLanguage(language);
    this.channel = channel;
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

      const hasFinal =
        status.finalReady ??
        (Boolean(status.engines?.funasrFinal?.modelReady) ||
          Boolean(status.engines?.whisperFallback?.ready));
      if (
        !status.engines?.sherpaStreaming?.modelReady ||
        !status.engines?.funasrFinal?.modelReady
      ) {
        void this._triggerModelDownload();
      }
      if (!hasFinal) {
        return {
          ok: false,
          reason: status.downloadInProgress
            ? 'asr_model_downloading'
            : 'final_model_not_ready',
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
    this.lastPartialByUtterance.clear();
    this.chunkSendQueue = Promise.resolve();
    this.clientHasSpeech = false;
    this.clientTrailingSilenceMs = 0;
    this.consecutiveChunkFailures = 0;
    this.fatalChunkFailureEmitted = false;
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

    this.sessionId = `session-${this.channel}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    this.sessionStartedAt = Date.now();
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'starting',
      ts: Date.now(),
    });

    try {
      const result = await this._sendToBackground<AsrSessionStartResponse>({
        method: 'POST',
        path: '/asr/session/start',
        body: {
          sessionId: this.sessionId,
          locale: getPreferredLocale(this.language),
          language: this.language,
          sourceChannel: this.channel,
          liveEngine: 'auto',
          finalEngine: 'funasr_nano',
          fallbackFinalEngine: 'whisper_cpp',
        },
      });
      if (result?.ok === false) {
        throw new Error(result.error || 'session_start_failed');
      }
      this.liveEngine = result?.liveEngine;
      this.finalEngine = result?.finalEngine;
      this.fallbackFinalEngine = result?.fallbackFinalEngine;
    } catch (e) {
      this.emitter.emit('error', {
        tier: 'desktop_whisper',
        code: 'network',
        message: `Failed to start local ASR session: ${String((e as Error)?.message || e)}`,
        ts: Date.now(),
        fatal: true,
      });
      return;
    }

    this.pcmStreamer = createPcmStreamer(track);
    this.unsubPcm = this.pcmStreamer.onChunk((buffer, timing) => {
      this._handlePcmChunk(buffer, timing);
    });

    await this.pcmStreamer.start();
    this.lastChainLabel = formatEngineLabel(
      this.liveEngine,
      this.finalEngine,
      this.fallbackFinalEngine,
    );
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'running',
      ts: Date.now(),
      detail: this.lastChainLabel,
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
        await this.chunkSendQueue.catch(() => undefined);
        const result = await this._sendToBackground<AsrChunkResponse>({
          method: 'POST',
          path: `/asr/session/${this.sessionId}/stop`,
          body: {},
        });
        this._emitFinal(result, this.sessionStartedAt || Date.now());
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

  private _handlePcmChunk(
    buffer: ArrayBuffer,
    timing: { startedAt: number; endedAt: number },
  ): void {
    const hasSpeech = hasLikelySpeechPcm16(buffer);
    const durationMs = Math.max(0, timing.endedAt - timing.startedAt);
    if (hasSpeech) {
      this.clientHasSpeech = true;
      this.clientTrailingSilenceMs = 0;
    } else if (!this.clientHasSpeech) {
      return;
    } else {
      this.clientTrailingSilenceMs += durationMs;
      if (this.clientTrailingSilenceMs > MAX_CLIENT_TRAILING_SILENCE_MS) {
        this._scheduleIdleFlush();
        return;
      }
    }
    this._enqueueChunk(buffer, timing);
  }

  private _enqueueChunk(
    buffer: ArrayBuffer,
    timing: { startedAt: number; endedAt: number },
  ): void {
    this.chunkSendQueue = this.chunkSendQueue
      .catch(() => undefined)
      .then(() => this._sendChunk(buffer, timing));
  }

  private async _sendChunk(
    buffer: ArrayBuffer,
    timing: { startedAt: number; endedAt: number },
  ): Promise<void> {
    if (this.stopped || !this.sessionId) return;
    if (buffer.byteLength > MAX_CHUNK_BYTES) return;

    try {
      const result = await this._sendToBackground<AsrChunkResponse>({
        method: 'POST',
        path: `/asr/session/${this.sessionId}/chunk`,
        body: {
          pcmBase64: arrayBufferToBase64(buffer),
        },
      });
      if (result?.error && !result.partial && !result.final) {
        this._recordChunkFailure(result.error);
        return;
      }
      this._clearChunkFailures();
      const previousChainLabel = this.lastChainLabel;
      this.liveEngine = result?.liveEngine || this.liveEngine;
      this.finalEngine = result?.finalEngine || this.finalEngine;
      this.fallbackFinalEngine =
        result?.fallbackFinalEngine || this.fallbackFinalEngine;
      this.lastChainLabel = formatEngineLabel(
        this.liveEngine,
        this.finalEngine,
        this.fallbackFinalEngine,
      );
      if (this.lastChainLabel !== previousChainLabel) {
        this.emitter.emit('status', {
          tier: 'desktop_whisper',
          state: 'running',
          ts: Date.now(),
          detail: this.lastChainLabel,
        });
      }
      this._emitPartial(result, timing.startedAt);
      const emittedFinal = this._emitFinal(result, timing.startedAt);
      if (emittedFinal) {
        this._clearIdleFlushTimer();
      } else {
        this._scheduleIdleFlush();
      }
    } catch (error) {
      this._recordChunkFailure(error);
    }
  }

  private _clearChunkFailures(): void {
    this.consecutiveChunkFailures = 0;
  }

  private _recordChunkFailure(error: unknown): void {
    this.consecutiveChunkFailures += 1;
    const message = String((error as Error)?.message || error || 'unknown');
    this.emitter.emit('status', {
      tier: 'desktop_whisper',
      state: 'running',
      ts: Date.now(),
      detail: `Local ASR stream warning (${this.consecutiveChunkFailures}/${MAX_CONSECUTIVE_CHUNK_FAILURES}): ${message}`,
    });
    if (
      this.consecutiveChunkFailures < MAX_CONSECUTIVE_CHUNK_FAILURES ||
      this.fatalChunkFailureEmitted
    ) {
      return;
    }
    this.fatalChunkFailureEmitted = true;
    this.emitter.emit('error', {
      tier: 'desktop_whisper',
      code: 'network',
      message: `Local ASR stream failed after ${MAX_CONSECUTIVE_CHUNK_FAILURES} chunk attempts: ${message}`,
      ts: Date.now(),
      fatal: true,
    });
  }

  private _emitPartial(
    result: AsrChunkResponse | undefined,
    ts: number,
  ): void {
    const partialText = sanitizeASRTranscriptText(result?.partial);
    const utteranceId = result?.utteranceId;
    if (!partialText || !utteranceId) return;
    if (this.lastPartialByUtterance.get(utteranceId) === partialText) return;
    this.lastPartialByUtterance.set(utteranceId, partialText);
    this.emitter.emit('transcript', {
      kind: 'interim',
      text: partialText,
      tier: 'desktop_whisper',
      ts,
      utteranceId,
    });
  }

  private _emitFinal(
    result: AsrChunkResponse | undefined,
    ts: number,
  ): boolean {
    const finalText = sanitizeASRTranscriptText(result?.final);
    if (!finalText || !result?.utteranceId) return false;
    this.clientHasSpeech = false;
    this.clientTrailingSilenceMs = 0;
    this.lastPartialByUtterance.delete(result.utteranceId);
    this.emitter.emit('transcript', {
      kind: 'final',
      text: finalText,
      tier: 'desktop_whisper',
      ts,
      utteranceId: result.utteranceId,
    });
    return true;
  }

  private _scheduleIdleFlush(): void {
    if (!this.sessionId || this.stopped) return;
    const sessionId = this.sessionId;
    this._clearIdleFlushTimer();
    this.idleFlushTimer = setTimeout(() => {
      this.idleFlushTimer = undefined;
      if (this.sessionId !== sessionId || this.stopped) return;
      this.chunkSendQueue = this.chunkSendQueue
        .catch(() => undefined)
        .then(() => this._flushBufferedSpeech(sessionId));
    }, IDLE_FLUSH_DELAY_MS);
  }

  private _clearIdleFlushTimer(): void {
    if (!this.idleFlushTimer) return;
    clearTimeout(this.idleFlushTimer);
    this.idleFlushTimer = undefined;
  }

  private async _flushBufferedSpeech(sessionId: string): Promise<void> {
    try {
      const result = await this._sendToBackground<AsrChunkResponse>({
        method: 'POST',
        path: `/asr/session/${sessionId}/chunk`,
        body: { flush: true },
      });
      this._emitPartial(result, Date.now());
      this._emitFinal(result, Date.now());
    } catch {
      // idle flush is best-effort
    }
  }

  private async _fetchStatus(): Promise<AsrStatusResponse | null> {
    const response = await this._sendToBackground<AsrStatusResponse>({
      method: 'GET',
      path: '/asr/status',
    }).catch(() => null);
    if (!response) return null;
    return response;
  }

  private async _triggerModelDownload(): Promise<void> {
    try {
      await this._sendToBackground<AsrChunkResponse>({
        method: 'POST',
        path: '/asr/model/ensure',
        body: {},
      });
    } catch {
      // ignore
    }
  }

  private async _sendToBackground<T>(
    message: BackgroundAsrRequest,
  ): Promise<T> {
    try {
      return await this._sendDirectly<T>(message);
    } catch {
      // Fall back to the background/native bridge when the extension view cannot
      // reach localhost directly.
    }

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
    }

    throw new Error('desktop_asr_bridge_unavailable');
  }

  private async _pairDirectly(): Promise<string> {
    const response = await fetch(`${DESKTOP_ASR_BASE_URL}/pair`, {
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
    message: BackgroundAsrRequest,
    retry = true,
  ): Promise<T> {
    const token = this.directBridgeToken || (await this._pairDirectly());
    const response = await fetch(`${DESKTOP_ASR_BASE_URL}${message.path}`, {
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
