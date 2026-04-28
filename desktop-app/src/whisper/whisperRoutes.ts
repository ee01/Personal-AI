import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

type FastifyApp = ReturnType<typeof Fastify>;

import {
  isModelReady,
  downloadModel,
  deleteModel,
  getModelPath,
} from './modelManager.js';
import {
  loadWhisperModel,
  transcribeWithWhisper,
  unloadWhisperModel,
  isWhisperLoaded,
} from './whisperEngine.js';
import { installManifest } from '../nativeMessaging/manifestInstaller.js';

interface SessionBuffer {
  chunks: Buffer[];
  startedAt: number;
}

const sessions = new Map<string, SessionBuffer>();

let downloadProgress = 0;
let downloadInProgress = false;

export async function registerWhisperRoutes(app: FastifyApp): Promise<void> {
  app.get(
    '/whisper/status',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const modelStatus = await isModelReady();
      return reply.send({
        ok: true,
        modelReady: modelStatus.ready,
        engineLoaded: isWhisperLoaded(),
        activeSessionId: sessions.size > 0 ? [...sessions.keys()][0] : null,
        downloadInProgress,
        downloadProgress,
      });
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
      const body = req.body as { sessionId?: string };
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

      sessions.set(sessionId, { chunks: [], startedAt: Date.now() });
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

      const body = req.body as { pcmBase64?: string } | undefined;
      if (body?.pcmBase64) {
        const pcmBuf = Buffer.from(body.pcmBase64, 'base64');
        if (pcmBuf.length > 0) session.chunks.push(pcmBuf);
      }

      const totalBytes = session.chunks.reduce((sum, c) => sum + c.length, 0);
      if (totalBytes >= 16000 * 2 * 1) {
        const combined = Buffer.concat(session.chunks);
        session.chunks = [];
        try {
          const result = await transcribeWithWhisper(combined);
          return reply.send({ ok: true, interim: result.text });
        } catch {
          return reply.send({ ok: true, interim: null });
        }
      }

      return reply.send({ ok: true, interim: null });
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

      if (session.chunks.length === 0) {
        return reply.send({ ok: true, final: '' });
      }

      const combined = Buffer.concat(session.chunks);
      try {
        const result = await transcribeWithWhisper(combined);
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
      await unloadWhisperModel();
      await deleteModel();
      return reply.send({ ok: true });
    },
  );
}
