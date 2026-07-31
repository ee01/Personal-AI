import type { FastifyInstance } from 'fastify';

import { MeetingOutcomeBinderService } from '../core/MeetingOutcomeBinderService.js';
import type { MeetingOutcomeBindInput } from '../types/index.js';

export async function meetingOutcomeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/meeting-outcomes/:id',
    async (request, reply) => {
      const service = new MeetingOutcomeBinderService(
        request.userContext.db,
        request.userId,
      );
      const binder = service.getById(request.params.id);
      if (!binder) return reply.status(404).send({ error: 'Meeting outcome binder not found' });
      return reply.status(200).send({ binder });
    },
  );

  app.get<{ Querystring: { meetingId?: string } }>(
    '/meeting-outcomes',
    async (request, reply) => {
      const meetingId = String(request.query.meetingId || '').trim();
      if (!meetingId) return reply.status(400).send({ error: 'meetingId is required' });
      const service = new MeetingOutcomeBinderService(
        request.userContext.db,
        request.userId,
      );
      return reply.status(200).send({ binder: service.getByMeetingId(meetingId) });
    },
  );

  app.post<{ Body: MeetingOutcomeBindInput }>(
    '/meeting-outcomes/bind',
    async (request, reply) => {
      const meetingId = String(request.body?.meetingId || '').trim();
      if (!meetingId) return reply.status(400).send({ error: 'meetingId is required' });
      if (!request.body?.binderId && !request.body?.eventExternalId) {
        return reply.status(400).send({ error: 'binderId or eventExternalId is required' });
      }
      try {
        const service = new MeetingOutcomeBinderService(
          request.userContext.db,
          request.userId,
        );
        const binder = await service.bindMeetingSession({
          ...request.body,
          meetingId,
          transcript: Array.isArray(request.body.transcript)
            ? request.body.transcript.slice(-60)
            : [],
          actionItems: Array.isArray(request.body.actionItems)
            ? request.body.actionItems.slice(0, 40)
            : [],
          decisions: Array.isArray(request.body.decisions)
            ? request.body.decisions.slice(0, 30)
            : [],
          chapters: Array.isArray(request.body.chapters)
            ? request.body.chapters.slice(0, 30)
            : [],
        });
        return reply.status(200).send({ binder });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply
          .status(message.includes('not found') ? 404 : 400)
          .send({ error: message });
      }
    },
  );
}
