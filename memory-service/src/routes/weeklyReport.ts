/**
 * Weekly report control routes.
 *
 * POST /weekly-report/push-now — Manually trigger a weekly report push.
 */

import type { FastifyInstance } from 'fastify';
import { WeeklyReporter } from '../core/WeeklyReporter.js';

interface PushNowBody {
  force?: boolean;
  weeklyReportPushTarget?: 'me' | 'group' | 'none' | 'user' | 'team';
  weeklyReportPushGroupId?: string;
}

const pushNowBodySchema = {
  type: 'object' as const,
  properties: {
    force: { type: 'boolean' as const },
    weeklyReportPushTarget: {
      type: 'string' as const,
      enum: ['me', 'group', 'none', 'user', 'team'],
    },
    weeklyReportPushGroupId: { type: 'string' as const },
  },
  additionalProperties: false,
};

export async function weeklyReportRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PushNowBody }>(
    '/weekly-report/push-now',
    { schema: { body: pushNowBodySchema } },
    async (request, reply) => {
      const { db, userDataManager } = request.userContext;
      const userId = request.userId ?? 'unknown';
      const body = request.body ?? {};
      const reporter = new WeeklyReporter(db, userDataManager, userId);
      const result = await reporter.generateWeeklyReport({
        ignoreEnabled: true,
        ignoreMinMessages: true,
        manual: true,
        pushTarget:
          body.weeklyReportPushTarget === 'user'
            ? 'me'
            : body.weeklyReportPushTarget === 'team'
              ? 'group'
              : body.weeklyReportPushTarget,
        pushGroupId: body.weeklyReportPushGroupId,
      });

      request.log.info(
        `[weekly-report/push-now] userId=${userId} result=${JSON.stringify(result)}`,
      );

      return reply.status(200).send(result);
    },
  );
}
