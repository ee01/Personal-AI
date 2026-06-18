import type { FastifyInstance } from 'fastify';

import { RelationshipRadarService } from '../core/RelationshipRadarService.js';

const radarStates = ['core', 'active', 'rising', 'dormant', 'watch', 'all'];
const reviewStatuses = ['pending', 'confirmed', 'rejected', 'snoozed', 'all'];
const reviewActions = ['confirm', 'reject', 'snooze'];

const contextCardBodySchema = {
  type: 'object' as const,
  properties: {
    personId: { type: 'string' as const, minLength: 1 },
    personName: { type: 'string' as const, minLength: 1 },
    surface: { type: 'string' as const, minLength: 1 },
    tokenBudget: { type: 'integer' as const, minimum: 300, maximum: 2400 },
    includeSensitive: { type: 'boolean' as const },
  },
  additionalProperties: false,
  anyOf: [{ required: ['personId'] }, { required: ['personName'] }],
};

const contextPackageBodySchema = {
  type: 'object' as const,
  properties: {
    personIds: {
      type: 'array' as const,
      items: { type: 'string' as const, minLength: 1 },
      maxItems: 5,
    },
    personName: { type: 'string' as const, minLength: 1 },
    surface: { type: 'string' as const, minLength: 1 },
    tokenBudget: { type: 'integer' as const, minimum: 300, maximum: 2400 },
  },
  additionalProperties: false,
};

const reviewActionBodySchema = {
  type: 'object' as const,
  properties: {
    editedValue: { type: 'string' as const },
    userNote: { type: 'string' as const },
    snoozeUntil: { type: 'integer' as const },
  },
  additionalProperties: false,
};

const assistantDraftBodySchema = {
  type: 'object' as const,
  properties: {
    personId: { type: 'string' as const, minLength: 1 },
    personName: { type: 'string' as const, minLength: 1 },
    scenario: { type: 'string' as const, minLength: 1, maxLength: 80 },
    userGoal: { type: 'string' as const, maxLength: 800 },
  },
  additionalProperties: false,
  anyOf: [{ required: ['personId'] }, { required: ['personName'] }],
};

interface ConsolidateBody {
  limit?: number;
  personIds?: string[];
  force?: boolean;
}

interface MeetingBriefBody {
  eventId?: string;
  title?: string;
  startAt?: number;
  attendees?: Array<{ name?: string; email?: string } | string>;
}

interface AssistantDraftBody {
  personId?: string;
  personName?: string;
  scenario?: string;
  userGoal?: string;
}

export async function relationshipRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      limit?: string;
      state?: string;
      search?: string;
      includeBelowThreshold?: string;
    };
  }>('/relationships/people', async (request, reply) => {
    const service = new RelationshipRadarService(request.userContext.db);
    const state = radarStates.includes(request.query.state ?? '')
      ? (request.query.state as any)
      : 'all';

    return reply.status(200).send(
      service.listPeople({
        limit: parseInteger(request.query.limit),
        radarState: state,
        search: request.query.search,
        includeBelowThreshold: request.query.includeBelowThreshold === 'true',
      }),
    );
  });

  app.post<{ Body: ConsolidateBody }>(
    '/relationships/consolidate',
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      return reply.status(200).send(service.consolidatePeople(request.body ?? {}));
    },
  );

  app.post<{ Body: MeetingBriefBody }>(
    '/relationships/meeting-brief',
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      return reply.status(200).send(service.buildMeetingBrief(request.body ?? {}));
    },
  );

  app.post<{ Body: AssistantDraftBody }>(
    '/relationships/assistant/draft',
    {
      schema: { body: assistantDraftBodySchema },
      preValidation: (request, reply, done) => {
        const body = request.body as Record<string, unknown> | undefined;
        const allowed = new Set(['personId', 'personName', 'scenario', 'userGoal']);
        const unknown = Object.keys(body ?? {}).filter((key) => !allowed.has(key));
        if (unknown.length > 0) {
          void reply.status(400).send({ error: 'Invalid assistant draft body' });
          return;
        }
        done();
      },
    },
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      const draft = service.buildAssistantDraft(request.body ?? {});
      if (!draft) return reply.status(404).send({ error: 'Person not found' });
      return reply.status(200).send(draft);
    },
  );

  app.get<{ Querystring: { limit?: string } }>(
    '/relationships/graph',
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      return reply.status(200).send(
        service.buildGraph({ limit: parseInteger(request.query.limit) }),
      );
    },
  );

  app.get<{ Params: { personId: string } }>(
    '/relationships/people/:personId',
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      const person = service.getPerson(request.params.personId);
      if (!person) return reply.status(404).send({ error: 'Person not found' });
      return reply.status(200).send(person);
    },
  );

  app.get<{
    Params: { personId: string };
    Querystring: { limit?: string };
  }>('/relationships/people/:personId/timeline', async (request, reply) => {
    const service = new RelationshipRadarService(request.userContext.db);
    const result = service.listTimeline(
      request.params.personId,
      parseInteger(request.query.limit),
    );
    if (!result) return reply.status(404).send({ error: 'Person not found' });
    return reply.status(200).send(result);
  });

  app.get<{
    Params: { personId: string };
    Querystring: { limit?: string };
  }>('/relationships/people/:personId/open-loops', async (request, reply) => {
    const service = new RelationshipRadarService(request.userContext.db);
    const person = service.getPerson(request.params.personId);
    if (!person) return reply.status(404).send({ error: 'Person not found' });
    return reply.status(200).send({
      personId: request.params.personId,
      items: service.listOpenLoops(
        request.params.personId,
        parseInteger(request.query.limit),
      ),
    });
  });

  app.post<{
    Body: {
      personId?: string;
      personName?: string;
      surface?: string;
      tokenBudget?: number;
      includeSensitive?: boolean;
    };
  }>(
    '/relationships/context-card',
    { schema: { body: contextCardBodySchema } },
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      const card = service.buildContextCard(request.body);
      if (!card) return reply.status(404).send({ error: 'Person not found' });
      return reply.status(200).send(card);
    },
  );

  app.post<{
    Body: {
      personIds?: string[];
      personName?: string;
      surface?: string;
      tokenBudget?: number;
    };
  }>(
    '/relationships/context-package',
    { schema: { body: contextPackageBodySchema } },
    async (request, reply) => {
      const service = new RelationshipRadarService(request.userContext.db);
      return reply.status(200).send(service.buildContextPackage(request.body));
    },
  );

  app.get<{
    Querystring: {
      status?: string;
      limit?: string;
      personId?: string;
    };
  }>('/relationships/review-items', async (request, reply) => {
    const service = new RelationshipRadarService(request.userContext.db);
    const status = reviewStatuses.includes(request.query.status ?? '')
      ? (request.query.status as any)
      : 'pending';
    return reply.status(200).send(
      service.listReviewItems({
        status,
        limit: parseInteger(request.query.limit),
        personId: request.query.personId,
      }),
    );
  });

  app.post<{
    Params: { id: string; action: string };
    Body: { editedValue?: string; userNote?: string; snoozeUntil?: number };
  }>(
    '/relationships/review-items/:id/:action',
    { schema: { body: reviewActionBodySchema } },
    async (request, reply) => {
      if (!reviewActions.includes(request.params.action)) {
        return reply.status(400).send({ error: 'Invalid review action' });
      }

      const service = new RelationshipRadarService(request.userContext.db);
      const item = service.applyReviewAction(
        request.params.id,
        request.params.action as 'confirm' | 'reject' | 'snooze',
        request.body ?? {},
      );
      if (!item) {
        return reply.status(404).send({ error: 'Review item not found' });
      }
      return reply.status(200).send(item);
    },
  );
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
