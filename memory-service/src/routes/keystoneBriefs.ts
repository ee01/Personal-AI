import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

import { KeystoneBriefComposerService } from '../core/KeystoneBriefComposerService.js';
import {
  KeystoneBriefService,
  type KeystoneBriefEventInput,
  type UpsertKeystoneBriefInput,
} from '../core/KeystoneBriefService.js';
import { getUiLanguageFromHeaders } from '../i18n.js';
import type { ContextRecallRequest } from '../types/index.js';

const EVENT_TYPES = new Set<KeystoneBriefEventInput['eventType']>([
  'shown',
  'opened',
  'evidence_opened',
  'copied',
  'useful',
  'hidden',
  'not_accurate',
  'used_in_ask',
  'used_by_compiler',
]);
const languageRefreshes = new WeakMap<Database.Database, Promise<void>>();

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export async function keystoneBriefRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { includeHidden?: string; limit?: string };
  }>('/keystone-briefs', async (request) => {
    const service = new KeystoneBriefService(request.userContext.db);
    const limit = Number.parseInt(request.query.limit || '', 10);
    return {
      items: service.list({
        includeHidden: parseBoolean(request.query.includeHidden),
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
      readOnly: true,
    };
  });

  app.get<{
    Querystring: {
      scene?: string;
      text?: string;
      title?: string;
      url?: string;
      issueKey?: string;
      scope?: 'work' | 'personal' | 'both' | 'all';
    };
  }>('/keystone-briefs/match', async (request) => {
    const service = new KeystoneBriefService(request.userContext.db);
    const recallRequest: ContextRecallRequest = {
      surface: 'web_passive',
      contextType: request.query.issueKey ? 'jira_issue' : 'webpage',
      title: request.query.title,
      url: request.query.url,
      primaryText: request.query.text,
      scope: request.query.scope ?? 'work',
      currentContext: request.query.issueKey
        ? { issueKey: request.query.issueKey }
        : undefined,
      interactionScene: request.query.scene
        ? {
            sceneType: request.query.scene as NonNullable<
              ContextRecallRequest['interactionScene']
            >['sceneType'],
            surface: 'memory_lens',
            userMode: 'read',
            admission: { state: 'passive_ready' },
          }
        : undefined,
    };
    const item = service.matchContext(recallRequest, [], {
      requireRecallEvidence: false,
      outputLanguage: getUiLanguageFromHeaders(request.headers),
    });
    return {
      items: item ? [item] : [],
      scopeReceipt: {
        requestedScope: recallRequest.scope ?? 'work',
        effectiveScope: recallRequest.scope ?? 'work',
        returned: item ? 1 : 0,
        note: '只读取匹配简报；不会写入画像、任务或外部系统。',
      },
    };
  });

  app.post('/keystone-briefs/refresh-language', async (request, reply) => {
    const db = request.userContext.db;
    if (languageRefreshes.has(db)) {
      return reply.code(202).send({ scheduled: false, reason: 'already_running' });
    }

    const refresh = new KeystoneBriefComposerService(db)
      .run({ maxBriefs: 10, scanThreads: 250 })
      .then((result) => {
        request.log.info(
          { composed: result.composed, failed: result.failed },
          'keystone brief language refresh completed',
        );
      })
      .catch((err) => {
        request.log.error({ err }, 'keystone brief language refresh failed');
      })
      .finally(() => {
        languageRefreshes.delete(db);
      });
    languageRefreshes.set(db, refresh);
    return reply.code(202).send({ scheduled: true });
  });

  app.post<{ Body: UpsertKeystoneBriefInput }>(
    '/keystone-briefs/mine',
    async (request, reply) => {
      const input = request.body;
      if (
        !input ||
        typeof input.briefKey !== 'string' ||
        typeof input.title !== 'string' ||
        typeof input.summary !== 'string' ||
        typeof input.subjectType !== 'string'
      ) {
        return reply.code(400).send({ error: 'invalid_keystone_brief_input' });
      }
      const service = new KeystoneBriefService(request.userContext.db);
      return reply.send({ item: service.upsertComposedCandidate(input) });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/keystone-briefs/:id',
    async (request, reply) => {
      const service = new KeystoneBriefService(request.userContext.db);
      const item = service.getById(request.params.id);
      if (!item) return reply.code(404).send({ error: 'not_found' });
      return reply.send({ item, readOnly: true });
    },
  );

  app.post<{
    Params: { id: string };
    Body: KeystoneBriefEventInput;
  }>('/keystone-briefs/:id/events', async (request, reply) => {
    if (!request.body || !EVENT_TYPES.has(request.body.eventType)) {
      return reply.code(400).send({ error: 'invalid_event_type' });
    }
    const service = new KeystoneBriefService(request.userContext.db);
    const item = service.recordEvent(request.params.id, request.body);
    if (!item) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ item });
  });

  app.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/keystone-briefs/:id/hide', async (request, reply) => {
    const service = new KeystoneBriefService(request.userContext.db);
    const item = service.recordEvent(request.params.id, {
      eventType: 'hidden',
      surface: 'keystone_brief_api',
      reason: request.body?.reason,
    });
    if (!item) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ item });
  });

  app.post<{ Params: { id: string } }>(
    '/keystone-briefs/:id/repair-preview',
    async (request, reply) => {
      const service = new KeystoneBriefService(request.userContext.db);
      const preview = service.getRepairPreview(request.params.id);
      if (!preview) return reply.code(404).send({ error: 'not_found' });
      return reply.send(preview);
    },
  );
}
