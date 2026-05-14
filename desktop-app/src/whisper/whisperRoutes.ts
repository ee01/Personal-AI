import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

type FastifyApp = ReturnType<typeof Fastify>;

import {
  isModelReady,
  downloadModel,
  deleteModel,
  getModelPath,
  MODEL_NAME,
} from './modelManager.js';
import {
  loadWhisperModel,
  transcribeWithWhisper,
  unloadWhisperModel,
  isWhisperLoaded,
  getWhisperBinaryPath,
  getWhisperServerPath,
  retainWhisperEngine,
  releaseWhisperEngine,
  getWhisperEngineState,
  warmWhisperEngine,
} from './whisperEngine.js';
import {
  ensureWhisperBinary,
  getWhisperBinaryInstallStatus,
} from './binaryManager.js';
import { installManifest } from '../nativeMessaging/manifestInstaller.js';

interface SessionBuffer {
  chunks: Buffer[];
  startedAt: number;
  lastTouchedAt: number;
  language?: string;
}

const sessions = new Map<string, SessionBuffer>();
const MIN_TRANSCRIBE_SECONDS = 3;
const MIN_IDLE_FLUSH_TRANSCRIBE_SECONDS = 0.7;
const PCM16_MONO_16KHZ_BYTES_PER_SECOND = 16000 * 2;
const DEFAULT_MEETING_WHISPER_LANGUAGE = 'auto';
const SESSION_IDLE_TTL_MS = 2 * 60_000;
const SESSION_SWEEP_INTERVAL_MS = 30_000;

let downloadProgress = 0;
let downloadInProgress = false;

export function normalizeWhisperLanguage(value: unknown): string | undefined {
  const raw = String(value || DEFAULT_MEETING_WHISPER_LANGUAGE)
    .trim()
    .toLowerCase();
  if (!raw || raw === 'auto') return 'auto';
  if (raw.startsWith('zh')) return 'zh';
  if (raw.startsWith('en')) return 'en';
  return raw;
}

export function shouldTranscribeBufferedPcm(
  totalBytes: number,
  options?: { flush?: boolean },
): boolean {
  const minSeconds = options?.flush
    ? MIN_IDLE_FLUSH_TRANSCRIBE_SECONDS
    : MIN_TRANSCRIBE_SECONDS;
  return totalBytes >= PCM16_MONO_16KHZ_BYTES_PER_SECOND * minSeconds;
}

function shouldAutoEnsureWhisperBinary(): boolean {
  return process.env.NODE_ENV !== 'test';
}

export async function registerWhisperRoutes(app: FastifyApp): Promise<void> {
  const sessionSweepTimer = setInterval(() => {
    closeIdleSessions();
  }, SESSION_SWEEP_INTERVAL_MS);
  sessionSweepTimer.unref?.();
  app.addHook('onClose', async () => {
    clearInterval(sessionSweepTimer);
    closeAllSessions();
    await unloadWhisperModel();
  });

  app.get(
    '/whisper/status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const modelStatus = await isModelReady();
      const binaryStatus = getWhisperBinaryInstallStatus();
      const engineState = getWhisperEngineState();
      if (
        shouldAutoEnsureWhisperBinary() &&
        !binaryStatus.ready &&
        !binaryStatus.installInProgress
      ) {
        void ensureWhisperBinary();
      }
      return reply.send({
        ok: true,
        modelName: MODEL_NAME,
        modelPath: getModelPath(),
        modelReady: modelStatus.ready,
        whisperBinaryAvailable: Boolean(getWhisperBinaryPath()),
        whisperBinaryPath: getWhisperBinaryPath(),
        whisperServerAvailable: Boolean(getWhisperServerPath()),
        whisperServerPath: getWhisperServerPath(),
        whisperServerRunning: engineState.server.running,
        whisperServerPort: engineState.server.port,
        whisperServerError: engineState.server.lastError,
        whisperBinaryInstallInProgress: binaryStatus.installInProgress,
        whisperBinaryInstallProgress: binaryStatus.installProgress,
        whisperBinaryInstallError: binaryStatus.error,
        engineLoaded: isWhisperLoaded(),
        engineMode: engineState.mode,
        engineActiveSessionRefs: engineState.activeSessionRefs,
        engineLastUsedAt: engineState.lastUsedAt,
        engineIdleUnloadMs: engineState.idleUnloadMs,
        engineIdleUnloadAt: engineState.idleUnloadAt,
        engineQueued: engineState.queued,
        activeSessionId: sessions.size > 0 ? [...sessions.keys()][0] : null,
        downloadInProgress,
        downloadProgress,
      });
    },
  );

  app.post(
    '/whisper/binary/ensure',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const result = await ensureWhisperBinary();
      return reply.send(result);
    },
  );

  app.post(
    '/whisper/model/ensure',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const modelStatus = await isModelReady();
      if (modelStatus.ready) {
        return reply.send({ ok: true, alreadyReady: true });
      }
      if (downloadInProgress) {
        return reply.send({
          ok: true,
          downloading: true,
          progressEndpoint: '/whisper/model/progress',
        });
      }

      downloadInProgress = true;
      downloadProgress = 0;

      void downloadModel((pct) => {
        downloadProgress = pct;
      }).then(async (result) => {
        downloadInProgress = false;
        if (result.ok) {
          const modelPath = getModelPath();
          await loadWhisperModel(modelPath).catch(() => undefined);
        }
      });

      return reply.send({
        ok: true,
        downloading: true,
        progressEndpoint: '/whisper/model/progress',
      });
    },
  );

  app.post(
    '/whisper/native-host/install',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { extensionIds?: string[] } | undefined;
      const extensionIds = Array.isArray(body?.extensionIds)
        ? body.extensionIds.map((item) => String(item).trim()).filter(Boolean)
        : [];
      if (!extensionIds.length) {
        return reply
          .status(400)
          .send({ ok: false, error: 'extension_ids_required' });
      }
      await installManifest(extensionIds);
      return reply.send({
        ok: true,
        installed: true,
        count: extensionIds.length,
      });
    },
  );

  app.get(
    '/whisper/model/progress',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        ok: true,
        downloading: downloadInProgress,
        pct: downloadProgress,
      });
    },
  );

  app.post(
    '/whisper/session/start',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { sessionId?: string; language?: string };
      const sessionId = String(body?.sessionId || `session-${Date.now()}`);

      if (!isWhisperLoaded()) {
        const modelStatus = await isModelReady();
        if (!modelStatus.ready) {
          return reply
            .status(503)
            .send({ ok: false, error: 'model_not_ready' });
        }
        await loadWhisperModel(getModelPath());
      }
      if (!getWhisperBinaryPath()) {
        await ensureWhisperBinary();
        return reply
          .status(503)
          .send({ ok: false, error: 'whisper_binary_installing' });
      }

      const replacingExistingSession = sessions.has(sessionId);
      sessions.set(sessionId, {
        chunks: [],
        startedAt: Date.now(),
        lastTouchedAt: Date.now(),
        language: normalizeWhisperLanguage(body?.language),
      });
      if (!replacingExistingSession) {
        retainWhisperEngine();
      }
      await warmWhisperEngine();
      return reply.send({ ok: true, sessionId });
    },
  );

  app.post(
    '/whisper/session/:id/chunk',
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
      session.lastTouchedAt = Date.now();
      if (body?.pcmBase64) {
        const pcmBuf = Buffer.from(body.pcmBase64, 'base64');
        if (pcmBuf.length > 0) session.chunks.push(pcmBuf);
      }

      const totalBytes = session.chunks.reduce((sum, c) => sum + c.length, 0);
      if (shouldTranscribeBufferedPcm(totalBytes, { flush: body?.flush })) {
        const combined = Buffer.concat(session.chunks);
        session.chunks = [];
        try {
          const result = await transcribeWithWhisper(combined, {
            language: session.language,
          });
          return reply.send({ ok: true, interim: result.text });
        } catch {
          return reply.send({ ok: true, interim: null });
        }
      }

      return reply.send({
        ok: true,
        interim: null,
        flushed: Boolean(body?.flush),
      });
    },
  );

  app.post(
    '/whisper/session/:id/stop',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const session = sessions.get(id);
      if (!session) {
        return reply
          .status(404)
          .send({ ok: false, error: 'session_not_found' });
      }

      sessions.delete(id);
      releaseWhisperEngine();

      if (session.chunks.length === 0) {
        return reply.send({ ok: true, final: '' });
      }

      const combined = Buffer.concat(session.chunks);
      try {
        const result = await transcribeWithWhisper(combined, {
          language: session.language,
        });
        return reply.send({ ok: true, final: result.text });
      } catch (e) {
        return reply.send({
          ok: true,
          final: '',
          error: String((e as Error)?.message || e),
        });
      }
    },
  );

  app.delete(
    '/whisper/model',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      sessions.clear();
      await unloadWhisperModel();
      await deleteModel();
      return reply.send({ ok: true });
    },
  );
}

function closeAllSessions(): void {
  const releasedCount = sessions.size;
  sessions.clear();
  for (let index = 0; index < releasedCount; index += 1) {
    releaseWhisperEngine();
  }
}

function closeIdleSessions(now = Date.now()): void {
  let releasedCount = 0;
  for (const [sessionId, session] of sessions) {
    if (now - session.lastTouchedAt <= SESSION_IDLE_TTL_MS) continue;
    sessions.delete(sessionId);
    releasedCount += 1;
  }
  for (let index = 0; index < releasedCount; index += 1) {
    releaseWhisperEngine();
  }
}
