import type { FastifyInstance } from 'fastify';

import { DayPilotService } from '../core/DayPilotService.js';
import { TodayPilotMeetingPrepService } from '../core/TodayPilotMeetingPrepService.js';
import type { DayPilotFeedbackAction } from '../repositories/DayPilotRepository.js';
import type {
  ContextAssistMeetingEvent,
  RecallSourceType,
} from '../types/index.js';

const feedbackActions = new Set<DayPilotFeedbackAction>([
  'done',
  'later',
  'mute',
  'wrong',
  'useful',
]);

export async function dayPilotRoutes(app: FastifyInstance): Promise<void> {
  for (const prefix of ['/day-pilot', '/today-pilot']) {
    app.get<{
      Querystring: {
        date?: string;
        timezone?: string;
        autoGenerate?: string;
      };
    }>(`${prefix}/today`, async (request, reply) => {
      const { db } = request.userContext;
      const service = new DayPilotService(db, request.userId);
      const autoGenerate =
        request.query.autoGenerate === undefined
          ? true
          : request.query.autoGenerate !== 'false';

      const result = service.getToday({
        localDate: request.query.date,
        timezone: request.query.timezone,
        autoGenerate,
      });

      return reply.status(200).send(result);
    });

    app.post<{
      Body: {
        date?: string;
        timezone?: string;
        mode?: 'light' | 'full';
      };
    }>(`${prefix}/refresh`, async (request, reply) => {
      const { db } = request.userContext;
      const service = new DayPilotService(db, request.userId);
      const result = service.refreshToday({
        localDate: request.body?.date,
        timezone: request.body?.timezone,
        mode: request.body?.mode === 'full' ? 'full' : 'light',
      });
      return reply.status(200).send(result);
    });

    app.post<{
      Params: { id: string };
      Body: {
        action: DayPilotFeedbackAction;
        note?: string;
        reason?: string;
        snoozeUntil?: number;
        muteKey?: string;
      };
    }>(`${prefix}/cards/:id/feedback`, async (request, reply) => {
      if (!feedbackActions.has(request.body?.action)) {
        return reply
          .status(400)
          .send({ error: 'Invalid Today Pilot feedback action' });
      }

      const { db } = request.userContext;
      const service = new DayPilotService(db, request.userId);
      try {
        const result = service.recordCardFeedback(request.params.id, {
          action: request.body.action,
          note: request.body.note,
          reason: request.body.reason,
          snoozeUntil: request.body.snoozeUntil,
          muteKey: request.body.muteKey,
        });
        return reply.status(200).send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        return reply.status(400).send({ error: message });
      }
    });

    app.post<{
      Params: { id: string };
      Body: {
        tokenBudget?: number;
        targetProvider?: 'codex' | 'chatgpt' | 'claude' | 'doubao' | 'generic';
        includeSensitive?: boolean;
      };
    }>(`${prefix}/missions/:id/context-pack`, async (request, reply) => {
      const { db } = request.userContext;
      const service = new DayPilotService(db, request.userId);
      try {
        const result = service.renderMissionContextPack(request.params.id, {
          tokenBudget: request.body?.tokenBudget,
          targetProvider: request.body?.targetProvider,
          includeSensitive: request.body?.includeSensitive,
        });
        return reply.status(200).send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        return reply.status(400).send({ error: message });
      }
    });
  }

  app.post<{
    Body: {
      date?: string;
      timezone?: string;
      horizonHours?: number;
      maxMeetings?: number;
      mode?: 'nightly_llm' | 'on_demand_llm';
    };
  }>('/today-pilot/meeting-prep/prepare', async (request, reply) => {
    const { db } = request.userContext;
    const service = new TodayPilotMeetingPrepService(db, request.userId);
    const result = await service.prepare({
      date: request.body?.date,
      timezone: request.body?.timezone,
      horizonHours: request.body?.horizonHours,
      maxMeetings: request.body?.maxMeetings,
      mode:
        request.body?.mode === 'on_demand_llm'
          ? 'on_demand_llm'
          : 'nightly_llm',
    });
    return reply.status(200).send(result);
  });

  app.post<{
    Body: {
      event?: ContextAssistMeetingEvent;
      timezone?: string;
      userGoal?: string;
      autoGenerate?: boolean;
      forceGenerate?: boolean;
      sourceTypes?: RecallSourceType[];
    };
  }>('/today-pilot/meeting-prep/resolve', async (request, reply) => {
    const { db } = request.userContext;
    const service = new TodayPilotMeetingPrepService(db, request.userId);
    const result = await service.resolve({
      event: request.body?.event,
      timezone: request.body?.timezone,
      userGoal: request.body?.userGoal,
      autoGenerate: request.body?.autoGenerate,
      forceGenerate: request.body?.forceGenerate,
      sourceTypes: request.body?.sourceTypes,
    });
    return reply.status(200).send(result);
  });
}
