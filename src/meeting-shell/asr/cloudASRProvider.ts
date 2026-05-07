import { getEnvConfig } from '../../utils';
import {
  getMeetingTranscribeCompatibilityIssue,
  normalizeMeetingTranscribeApiStyle,
  requestMeetingTranscription,
} from '../asrProvider';
import { prepareMediaBlobForTranscription } from '../transcodeForWhisper';
import type { ASRProvider, ASREventMap, MeetingPilotASRTier } from './types';
import { createASREventEmitter } from './types';
import { sanitizeASRTranscriptText } from './transcriptFilter';

const SEGMENT_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 3;

export class CloudASRProvider implements ASRProvider {
  readonly tier: MeetingPilotASRTier = 'cloud';

  private emitter = createASREventEmitter();
  private recorder: MediaRecorder | undefined;
  private segmentTimer: ReturnType<typeof setTimeout> | undefined;
  private segmentChunks: Blob[] = [];
  private segmentSeq = 0;
  private queue: Array<{
    blob: Blob;
    seq: number;
    startedAt: number;
    endedAt: number;
  }> = [];
  private inFlight = false;
  private stopRequested = false;
  private consecutiveFailures = 0;

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const envConfig = await getEnvConfig();
    const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').trim();
    const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
    if (!baseUrl || !apiKey) {
      return { ok: false, reason: 'missing base URL or API key' };
    }
    return { ok: true };
  }

  async start(audio: MediaStreamTrack | MediaStream): Promise<void> {
    this.stopRequested = false;
    this.consecutiveFailures = 0;
    this.emitter.emit('status', {
      tier: 'cloud',
      state: 'starting',
      ts: Date.now(),
    });
    const stream =
      audio instanceof MediaStream ? audio : new MediaStream([audio]);
    this._startSegment(stream);
    this.emitter.emit('status', {
      tier: 'cloud',
      state: 'running',
      ts: Date.now(),
    });
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
      this.segmentTimer = undefined;
    }
    if (this.recorder && this.recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const r = this.recorder!;
        r.addEventListener('stop', () => resolve(), { once: true });
        r.stop();
      });
    }
    this.recorder = undefined;
    this.emitter.emit('status', {
      tier: 'cloud',
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

  private _startSegment(stream: MediaStream): void {
    if (this.stopRequested) return;
    const audioTracks = stream
      .getAudioTracks()
      .filter((t) => t.readyState === 'live');
    if (!audioTracks.length) return;

    const audioStream = new MediaStream(audioTracks);
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined;

    const recorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);

    this.segmentSeq += 1;
    const seq = this.segmentSeq;
    const startedAt = Date.now();
    this.segmentChunks = [];
    this.recorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size) this.segmentChunks.push(event.data);
    };

    recorder.onstop = () => {
      const endedAt = Date.now();
      const chunks = this.segmentChunks;
      this.segmentChunks = [];
      if (chunks.length) {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || chunks[0]?.type || 'audio/webm',
        });
        this._enqueue(blob, seq, startedAt, endedAt);
      }
      this.recorder = undefined;
      this.segmentTimer = undefined;
      if (!this.stopRequested) {
        this._startSegment(stream);
      }
    };

    recorder.start();
    this.segmentTimer = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, SEGMENT_MS);
  }

  private _enqueue(
    blob: Blob,
    seq: number,
    startedAt: number = Date.now(),
    endedAt: number = Date.now(),
  ): void {
    if (blob.size < 1) return;
    this.queue.push({ blob, seq, startedAt, endedAt });
    if (this.queue.length > 3) {
      this.queue = this.queue.slice(-3);
    }
    void this._processQueue();
  }

  private async _processQueue(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      while (this.queue.length) {
        const segment = this.queue.shift();
        if (segment) await this._runSegment(segment);
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async _runSegment(segment: {
    blob: Blob;
    seq: number;
    startedAt: number;
    endedAt: number;
  }): Promise<void> {
    try {
      const envConfig = await getEnvConfig();
      const baseUrl = String(envConfig.MEETING_PROVIDER_BASE_URL || '').replace(
        /\/$/,
        '',
      );
      const apiKey = String(envConfig.MEETING_PROVIDER_API_KEY || '').trim();
      const apiStyle = normalizeMeetingTranscribeApiStyle(
        envConfig.MEETING_TRANSCRIBE_API_STYLE,
      );
      const model = String(
        envConfig.MEETING_TRANSCRIBE_MODEL || 'whisper-1',
      ).trim();

      if (!baseUrl || !apiKey) return;

      const compatibilityIssue =
        getMeetingTranscribeCompatibilityIssue(envConfig);
      if (compatibilityIssue) return;

      const prepared = await prepareMediaBlobForTranscription(segment.blob);
      if (!prepared.signal.likelyHasSpeech) return;

      const result = await requestMeetingTranscription({
        baseUrl,
        apiKey,
        model: model || 'whisper-1',
        apiStyle,
        audioBlob: prepared.wavBlob,
        language: envConfig.MEETING_TRANSCRIBE_LANGUAGE,
        timeoutMs: 30000,
      });

      if (!result.ok) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.emitter.emit('error', {
            tier: 'cloud',
            code: 'network',
            message: result.errorMessage || 'transcription_failed',
            ts: Date.now(),
            fatal: true,
          });
        }
        return;
      }

      this.consecutiveFailures = 0;
      const text = sanitizeASRTranscriptText(result.text);
      if (!text) return;

      this.emitter.emit('transcript', {
        kind: 'final',
        text,
        tier: 'cloud',
        ts: segment.startedAt,
      });
    } catch (err) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.emitter.emit('error', {
          tier: 'cloud',
          code: 'unknown',
          message: String((err as Error)?.message || err),
          ts: Date.now(),
          fatal: true,
        });
      }
    }
  }
}
