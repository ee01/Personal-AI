import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

type FastifyApp = ReturnType<typeof Fastify>;

import {
  ensureAsrModels,
  getAsrModelDownloadStatus,
  getAsrModelRoot,
  getFunAsrNanoModelDir,
  getSherpaStreamingModelDir,
  isFunAsrNanoModelReady,
  isSherpaStreamingModelReady,
  FUNASR_NANO_MODEL_NAME,
  SHERPA_STREAMING_MODEL_NAME,
} from './modelManager.js';
import {
  createSherpaStreamingSession,
  getSherpaEngineState,
  type FinalEngineName,
  type LiveEngineName,
  type SherpaStreamingSession,
  transcribeWithFunAsrNano,
} from './sherpaEngine.js';
import {
  AppleSpeechPcmSession,
  getAppleSpeechAvailability,
} from './appleSpeechEngine.js';
import {
  isModelReady as isWhisperModelReady,
  getModelPath as getWhisperModelPath,
} from '../whisper/modelManager.js';
import {
  ensureWhisperBinary,
  getWhisperBinaryInstallStatus,
} from '../whisper/binaryManager.js';
import {
  analyzePcm16SpeechPresence,
  getWhisperBinaryPath,
  isWhisperLoaded,
  loadWhisperModel,
  transcribeWithWhisper,
  warmWhisperEngine,
} from '../whisper/whisperEngine.js';

interface AsrSession {
  id: string;
  locale: string;
  language: string;
  liveEngine: LiveEngineName;
  finalEngine: FinalEngineName;
  fallbackFinalEngine: FinalEngineName;
  chunks: Buffer[];
  hasSpeech: boolean;
  trailingSilenceMs: number;
  segmentSeq: number;
  currentUtteranceId?: string;
  sherpa?: SherpaStreamingSession;
  apple?: AppleSpeechPcmSession;
  lastPartial?: string;
  startedAt: number;
  finalizing: Promise<AsrFinalResult> | undefined;
}

interface AsrFinalResult {
  text: string;
  finalEngine: FinalEngineName;
  utteranceId?: string;
}

interface AsrChunkResponse {
  ok: boolean;
  partial?: string | null;
  final?: string | null;
  utteranceId?: string;
  liveEngine: LiveEngineName;
  finalEngine: FinalEngineName;
  fallbackFinalEngine?: FinalEngineName;
  flushed?: boolean;
  error?: string;
}

const sessions = new Map<string, AsrSession>();
const PCM16_MONO_16KHZ_BYTES_PER_SECOND = 16000 * 2;
const TRAILING_SILENCE_MS = 800;
const MAX_TRAILING_SILENCE_MS = 900;
const MIN_FINAL_SPEECH_SECONDS = 0.25;
const DEFAULT_LOCALE = 'auto';

export function normalizeAsrLanguage(value: unknown): string {
  const raw = String(value || DEFAULT_LOCALE)
    .trim()
    .toLowerCase();
  if (!raw || raw === 'auto') return 'auto';
  if (raw.startsWith('zh')) return 'zh';
  if (raw.startsWith('en')) return 'en';
  return 'auto';
}

export function selectLiveEngine(options: {
  requested?: string;
  locale?: string;
  appleReady: boolean;
  sherpaReady: boolean;
}): LiveEngineName {
  const requested = String(options.requested || 'auto').trim();
  if (requested === 'apple_speech') {
    return options.appleReady ? 'apple_speech' : 'none';
  }
  if (requested === 'sherpa_streaming') {
    return options.sherpaReady ? 'sherpa_streaming' : 'none';
  }
  if (requested === 'none') return 'none';
  if (isEnglishLocale(options.locale) && options.appleReady) {
    return 'apple_speech';
  }
  if (options.sherpaReady) return 'sherpa_streaming';
  return 'none';
}

export function shouldFinalizeAsrSegment(options: {
  hasSpeech: boolean;
  trailingSilenceMs: number;
  flush?: boolean;
  liveEndpoint?: boolean;
}): boolean {
  if (!options.hasSpeech) return false;
  if (options.flush) return true;
  if (options.liveEndpoint) return true;
  return options.trailingSilenceMs >= TRAILING_SILENCE_MS;
}

export async function registerAsrRoutes(app: FastifyApp): Promise<void> {
  app.get('/asr/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const sherpaStatus = await isSherpaStreamingModelReady();
    const funAsrStatus = await isFunAsrNanoModelReady();
    const whisperStatus = await getWhisperFallbackStatus();
    const appleStatus = getAppleSpeechAvailability();
    const downloadStatus = getAsrModelDownloadStatus();

    if (
      process.env.NODE_ENV !== 'test' &&
      !whisperStatus.whisperBinaryAvailable &&
      !whisperStatus.whisperBinaryInstallInProgress
    ) {
      void ensureWhisperBinary();
    }

    return reply.send({
      ok: true,
      ready:
        (appleStatus.ready || sherpaStatus.ready) &&
        (funAsrStatus.ready || whisperStatus.ready),
      modelRoot: getAsrModelRoot(),
      engines: {
        appleSpeech: appleStatus,
        sherpaStreaming: {
          name: SHERPA_STREAMING_MODEL_NAME,
          modelDir: getSherpaStreamingModelDir(),
          modelReady: sherpaStatus.ready,
          reason: sherpaStatus.reason,
          missingFiles: sherpaStatus.missingFiles,
        },
        funasrFinal: {
          name: FUNASR_NANO_MODEL_NAME,
          modelDir: getFunAsrNanoModelDir(),
          modelReady: funAsrStatus.ready,
          reason: funAsrStatus.reason,
          missingFiles: funAsrStatus.missingFiles,
        },
        whisperFallback: whisperStatus,
      },
      sherpaEngine: getSherpaEngineState(),
      activeSessionId: sessions.size > 0 ? [...sessions.keys()][0] : null,
      downloadInProgress: downloadStatus.downloadInProgress,
      downloadProgress: downloadStatus.downloadProgress,
      downloadTarget: downloadStatus.downloadTarget,
      lastDownloadError: downloadStatus.lastDownloadError,
    });
  });

  app.post(
    '/asr/model/ensure',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const result = await ensureAsrModels('all');
      const status = getAsrModelDownloadStatus();
      return reply.send({
        ok: result.ok,
        downloading: result.downloading,
        error: result.error,
        progressEndpoint: '/asr/model/progress',
        downloadProgress: status.downloadProgress,
      });
    },
  );

  app.get(
    '/asr/model/progress',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const status = getAsrModelDownloadStatus();
      return reply.send({
        ok: true,
        downloading: status.downloadInProgress,
        pct: status.downloadProgress,
        target: status.downloadTarget,
        error: status.lastDownloadError,
      });
    },
  );

  app.post(
    '/asr/session/start',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as
        | {
            sessionId?: string;
            locale?: string;
            language?: string;
            liveEngine?: string;
            finalEngine?: string;
            fallbackFinalEngine?: string;
          }
        | undefined;
      const sessionId = String(body?.sessionId || `session-${Date.now()}`);
      const locale = String(body?.locale || DEFAULT_LOCALE);
      const language = normalizeAsrLanguage(body?.language || locale);
      const sherpaReady = (await isSherpaStreamingModelReady()).ready;
      const funAsrReady = (await isFunAsrNanoModelReady()).ready;
      const whisperStatus = await getWhisperFallbackStatus();
      const appleReady = getAppleSpeechAvailability().ready;
      const liveEngine = selectLiveEngine({
        requested: body?.liveEngine,
        locale,
        appleReady,
        sherpaReady,
      });
      const finalEngine: FinalEngineName =
        normalizeFinalEngine(body?.finalEngine, 'funasr_nano') ===
          'funasr_nano' &&
        funAsrReady
          ? 'funasr_nano'
          : 'none';
      const fallbackFinalEngine: FinalEngineName =
        normalizeFinalEngine(body?.fallbackFinalEngine, 'whisper_cpp') ===
          'whisper_cpp' &&
        whisperStatus.ready
          ? 'whisper_cpp'
          : 'none';

      if (finalEngine === 'none' && fallbackFinalEngine === 'none') {
        if (process.env.NODE_ENV !== 'test') {
          void ensureAsrModels('funasr_nano');
        }
        return reply.status(503).send({
          ok: false,
          error: 'final_model_not_ready',
          funAsrReady,
          whisperFallbackReady: whisperStatus.ready,
        });
      }

      const replacingExistingSession = sessions.get(sessionId);
      if (replacingExistingSession) {
        await closeSession(replacingExistingSession);
      }

      const session: AsrSession = {
        id: sessionId,
        locale,
        language,
        liveEngine,
        finalEngine,
        fallbackFinalEngine,
        chunks: [],
        hasSpeech: false,
        trailingSilenceMs: 0,
        segmentSeq: 0,
        startedAt: Date.now(),
        finalizing: undefined,
      };

      if (session.liveEngine === 'sherpa_streaming') {
        session.sherpa = await createSherpaStreamingSession().catch(() => {
          session.liveEngine = 'none';
          return undefined;
        });
      }
      sessions.set(sessionId, session);
      return reply.send({
        ok: true,
        sessionId,
        liveEngine: session.liveEngine,
        finalEngine: session.finalEngine,
        fallbackFinalEngine: session.fallbackFinalEngine,
      });
    },
  );

  app.post(
    '/asr/session/:id/chunk',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const session = sessions.get(id);
      if (!session) {
        return reply
          .status(404)
          .send({ ok: false, error: 'session_not_found' });
      }

      const body = req.body as
        | { pcmBase64?: string; flush?: boolean }
        | undefined;
      try {
        const response = await handleSessionChunk(session, body);
        return reply.send(response);
      } catch (error) {
        return reply.send({
          ok: true,
          partial: null,
          final: null,
          liveEngine: session.liveEngine,
          finalEngine: session.finalEngine,
          fallbackFinalEngine: session.fallbackFinalEngine,
          error: String((error as Error)?.message || error),
        } satisfies AsrChunkResponse);
      }
    },
  );

  app.post(
    '/asr/session/:id/stop',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const session = sessions.get(id);
      if (!session) {
        return reply
          .status(404)
          .send({ ok: false, error: 'session_not_found' });
      }
      const result = await finalizeSegment(session, 'stop');
      sessions.delete(id);
      await closeSession(session);
      return reply.send({
        ok: true,
        final: result.text || '',
        utteranceId: result.utteranceId,
        liveEngine: session.liveEngine,
        finalEngine: result.finalEngine,
        fallbackFinalEngine: session.fallbackFinalEngine,
      });
    },
  );
}

async function handleSessionChunk(
  session: AsrSession,
  body: { pcmBase64?: string; flush?: boolean } | undefined,
): Promise<AsrChunkResponse> {
  let partial: string | undefined;
  let liveEndpoint = false;

  if (body?.pcmBase64) {
      const pcmBuf = Buffer.from(body.pcmBase64, 'base64');
      if (pcmBuf.length > 0) {
        const analysis = analyzePcm16SpeechPresence(pcmBuf);
        const hasSpeechInChunk = isLikelySpeechChunk(analysis);
        const chunkMs = Math.round(
          (pcmBuf.length / PCM16_MONO_16KHZ_BYTES_PER_SECOND) * 1000,
        );
        const shouldFeedLive = hasSpeechInChunk || session.hasSpeech;
        if (hasSpeechInChunk) {
          startSegmentIfNeeded(session);
          session.chunks.push(pcmBuf);
        session.trailingSilenceMs = 0;
      } else if (session.hasSpeech) {
        if (session.trailingSilenceMs < MAX_TRAILING_SILENCE_MS) {
          session.chunks.push(pcmBuf);
        }
        session.trailingSilenceMs += chunkMs;
      }

      if (shouldFeedLive) {
        const live = await processLiveChunk(session, pcmBuf);
        partial = live.partial;
        if (partial) session.lastPartial = partial;
        liveEndpoint = live.endpoint;
      }
    }
  }

  if (
    shouldFinalizeAsrSegment({
      hasSpeech: session.hasSpeech,
      trailingSilenceMs: session.trailingSilenceMs,
      flush: body?.flush,
      liveEndpoint,
    })
  ) {
    const finalResult = await finalizeSegment(
      session,
      body?.flush ? 'flush' : 'endpoint',
    );
    return {
      ok: true,
      partial: partial || null,
      final: finalResult.text || null,
      utteranceId: finalResult.utteranceId,
      liveEngine: session.liveEngine,
      finalEngine: finalResult.finalEngine,
      fallbackFinalEngine: session.fallbackFinalEngine,
      flushed: Boolean(body?.flush),
    };
  }

  return {
    ok: true,
    partial: partial || null,
    final: null,
    utteranceId: session.currentUtteranceId,
    liveEngine: session.liveEngine,
    finalEngine: body?.flush && !session.hasSpeech ? 'none' : session.finalEngine,
    fallbackFinalEngine: session.fallbackFinalEngine,
    flushed: Boolean(body?.flush),
  };
}

function startSegmentIfNeeded(session: AsrSession): void {
  if (session.hasSpeech) return;
  session.hasSpeech = true;
  session.trailingSilenceMs = 0;
  session.segmentSeq += 1;
  session.currentUtteranceId = `${session.id}-utt-${session.segmentSeq}`;
}

async function processLiveChunk(
  session: AsrSession,
  pcmBuf: Buffer,
): Promise<{ partial?: string; endpoint: boolean }> {
  if (session.liveEngine === 'sherpa_streaming') {
    if (!session.sherpa) {
      session.sherpa = await createSherpaStreamingSession();
    }
    return session.sherpa.acceptPcm16(pcmBuf);
  }

  if (session.liveEngine === 'apple_speech') {
    try {
      if (!session.apple) {
        session.apple = await AppleSpeechPcmSession.create(session.locale);
      }
      return { ...(await session.apple.acceptPcm16(pcmBuf)), endpoint: false };
    } catch {
      await session.apple?.finish().catch(() => '');
      session.apple = undefined;
      const sherpaReady = (await isSherpaStreamingModelReady()).ready;
      if (sherpaReady) {
        session.liveEngine = 'sherpa_streaming';
        session.sherpa = await createSherpaStreamingSession();
        return session.sherpa.acceptPcm16(pcmBuf);
      }
      session.liveEngine = 'none';
    }
  }

  return { endpoint: false };
}

async function finalizeSegment(
  session: AsrSession,
  _reason: 'endpoint' | 'flush' | 'stop',
): Promise<AsrFinalResult> {
  if (session.finalizing) return session.finalizing;
  const utteranceId = session.currentUtteranceId;
  if (!session.hasSpeech || session.chunks.length === 0) {
    return { text: '', finalEngine: 'none', utteranceId };
  }

  session.finalizing = runFinalCorrection(session, utteranceId).finally(() => {
    session.finalizing = undefined;
  });
  return session.finalizing;
}

async function runFinalCorrection(
  session: AsrSession,
  utteranceId: string | undefined,
): Promise<AsrFinalResult> {
  const combined = Buffer.concat(session.chunks);
  const previewText = session.lastPartial;
  const signal = analyzePcm16SpeechPresence(combined);
  let text = '';
  let finalEngine: FinalEngineName = 'none';

  if (
    signal.durationSec >= MIN_FINAL_SPEECH_SECONDS &&
    signal.likelyHasSpeech
  ) {
    if (session.finalEngine === 'funasr_nano') {
      try {
        const result = await transcribeWithFunAsrNano(combined, {
          language: session.language,
          maxNewTokens: 96,
        });
        text = reconcileFinalWithPreview(result.text, previewText);
        finalEngine = text ? 'funasr_nano' : 'none';
      } catch {
        finalEngine = 'none';
      }
    }
    if (!text && session.fallbackFinalEngine === 'whisper_cpp') {
      text = reconcileFinalWithPreview(
        await transcribeWithWhisperFallback(combined, session.language),
        previewText,
      );
      if (text) finalEngine = 'whisper_cpp';
    }
  }

  await finishLiveUtterance(session);
  resetSegment(session);
  return { text, finalEngine, utteranceId };
}

async function finishLiveUtterance(session: AsrSession): Promise<void> {
  if (session.apple) {
    await session.apple.finish().catch(() => '');
    session.apple = undefined;
  }
  session.sherpa?.reset();
}

function resetSegment(session: AsrSession): void {
  session.chunks = [];
  session.hasSpeech = false;
  session.trailingSilenceMs = 0;
  session.currentUtteranceId = undefined;
  session.lastPartial = undefined;
}

async function closeSession(session: AsrSession): Promise<void> {
  await session.apple?.finish().catch(() => '');
  session.apple = undefined;
  session.sherpa = undefined;
  resetSegment(session);
}

function normalizeFinalEngine(
  value: unknown,
  defaultEngine: FinalEngineName,
): FinalEngineName {
  const raw = String(value || '').trim();
  if (raw === 'funasr_nano') return 'funasr_nano';
  if (raw === 'whisper_cpp') return 'whisper_cpp';
  if (raw === 'none') return 'none';
  return raw ? 'none' : defaultEngine;
}

function isEnglishLocale(locale: string | undefined): boolean {
  return String(locale || '').toLowerCase().startsWith('en');
}

function isLikelySpeechChunk(
  signal: ReturnType<typeof analyzePcm16SpeechPresence>,
): boolean {
  return (
    signal.durationSec >= 0.08 &&
    (signal.likelyHasSpeech ||
      signal.overallRms >= 0.008 ||
      (signal.overallRms >= 0.003 &&
        signal.peakAbs >= 0.025 &&
        signal.activeFrameRatio >= 0.08) ||
      (signal.overallRms >= 0.005 &&
        signal.peakAbs >= 0.018 &&
        signal.activeFrameRatio >= 0.18))
  );
}

function reconcileFinalWithPreview(finalText: string, previewText?: string): string {
  const finalValue = String(finalText || '').trim();
  const previewValue = String(previewText || '').trim();
  if (!finalValue || !previewValue) return finalValue;
  if (/[A-Za-z]/.test(finalValue) || !/[A-Za-z]/.test(previewValue)) {
    return finalValue;
  }

  const latinMatch = previewValue.match(
    /\b[A-Za-z][A-Za-z0-9@._+-]*(?:\s+[A-Za-z][A-Za-z0-9@._+-]*){0,3}\b/,
  );
  if (!latinMatch) return finalValue;
  const latinText = latinMatch[0].trim();
  if (!latinText || latinText.length < 2) return finalValue;

  const prefix = previewValue.slice(0, latinMatch.index).trim();
  if (!prefix || !finalValue.startsWith(prefix)) return finalValue;
  const rest = finalValue.slice(prefix.length).trimStart();
  return `${prefix} ${latinText}${rest ? ` ${rest}` : ''}`.trim();
}

async function getWhisperFallbackStatus(): Promise<{
  ready: boolean;
  modelReady: boolean;
  modelPath: string;
  whisperBinaryAvailable: boolean;
  whisperBinaryInstallInProgress: boolean;
  whisperBinaryInstallProgress: number;
  whisperBinaryInstallError?: string;
  engineLoaded: boolean;
}> {
  const modelStatus = await isWhisperModelReady();
  const binaryStatus = getWhisperBinaryInstallStatus();
  const whisperBinaryAvailable = Boolean(getWhisperBinaryPath());
  return {
    ready: modelStatus.ready && whisperBinaryAvailable,
    modelReady: modelStatus.ready,
    modelPath: getWhisperModelPath(),
    whisperBinaryAvailable,
    whisperBinaryInstallInProgress: binaryStatus.installInProgress,
    whisperBinaryInstallProgress: binaryStatus.installProgress,
    whisperBinaryInstallError: binaryStatus.error,
    engineLoaded: isWhisperLoaded(),
  };
}

async function transcribeWithWhisperFallback(
  pcm16: Buffer,
  language: string,
): Promise<string> {
  const modelStatus = await isWhisperModelReady();
  if (!modelStatus.ready) return '';
  if (!isWhisperLoaded()) {
    await loadWhisperModel(getWhisperModelPath());
  }
  if (!getWhisperBinaryPath()) {
    await ensureWhisperBinary();
    return '';
  }
  await warmWhisperEngine();
  const result = await transcribeWithWhisper(pcm16, {
    language: language === 'auto' ? undefined : language,
  });
  return result.text;
}
