import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import { getConfig } from '../config.js';
import type { UserContextManager } from '../core/UserContextManager.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { TeamMessagingWebhookService } from '../integrations/ringcentral/TeamMessagingWebhookService.js';
import { RC_TM_POSTS_EVENT_FILTER } from '../integrations/ringcentral/teamMessagingWebhookTypes.js';

function webhookPathMatches(url: string, token: string): boolean {
  const pathOnly = url.split('?')[0];
  if (token) {
    return (
      pathOnly === `/webhooks/ringcentral/team-messaging/${token}` ||
      pathOnly === `/webhooks/ringcentral/team-messaging/${token}/`
    );
  }
  return pathOnly === '/webhooks/ringcentral/team-messaging';
}

export async function ringcentralTeamMessagingWebhookRoutes(
  app: FastifyInstance,
  opts: { userContextManager: UserContextManager },
): Promise<void> {
  const config = getConfig();

  app.post(
    '/webhooks/ringcentral/team-messaging/:token?',
    async (request, reply) => {
      const pathToken =
        typeof (request.params as { token?: string }).token === 'string'
          ? (request.params as { token: string }).token
          : '';
      const expectedToken = config.ringCentralTeamMessagingWebhookToken;
      if (expectedToken && pathToken !== expectedToken) {
        return reply.code(404).send({ error: 'not_found' });
      }
      if (!webhookPathMatches(request.url, expectedToken || pathToken)) {
        return reply.code(404).send({ error: 'not_found' });
      }

      const userId = config.ringCentralTeamMessagingWebhookUserId || 'default';
      const ctx = opts.userContextManager.getContext(userId);
      request.userId = userId;
      request.userContext = ctx;

      const service = new TeamMessagingWebhookService(
        ctx.db,
        ctx.userDataManager,
        userId,
      );

      const validation = service.handleValidation(request.headers);
      if (validation.ok) {
        reply.header('Validation-Token', validation.validationToken);
        return reply.code(200).send(validation.validationToken);
      }

      const result = await service.processNotification(request.body, request.headers);
      return reply.code(200).send(result);
    },
  );

  app.get(
    '/api/v1/ringcentral/team-messaging/webhook/status',
    async (request, reply) => {
      const userId =
        request.userId ||
        config.ringCentralTeamMessagingWebhookUserId ||
        'default';
      const ctx = opts.userContextManager.getContext(userId);
      const repo = new TeamMessagingWebhookService(
        ctx.db,
        ctx.userDataManager,
        userId,
      ).getRepository();
      const subscriptions = repo.listSubscriptions();
      const client = new RingCentralClient(ctx.userDataManager, ctx.db, userId);
      let remote: Array<Record<string, unknown>> = [];
      let remoteError: string | undefined;
      if (client.isConfigured()) {
        try {
          remote = await client.listWebhookSubscriptions();
        } catch (err) {
          remoteError = err instanceof Error ? err.message : String(err);
        }
      }
      const blacklisted = remote.filter(
        (item) => String(item.status ?? '').toLowerCase() === 'blacklisted',
      );
      return reply.send({
        eventFilter: RC_TM_POSTS_EVENT_FILTER,
        localSubscriptions: subscriptions,
        remoteSubscriptions: remote,
        blacklistedCount: blacklisted.length,
        blacklisted,
        remoteError,
        publicWebhookPath: config.ringCentralTeamMessagingWebhookPublicUrl
          ? `${config.ringCentralTeamMessagingWebhookPublicUrl.replace(/\/+$/, '')}/webhooks/ringcentral/team-messaging/${config.ringCentralTeamMessagingWebhookToken}`
          : null,
      });
    },
  );
}

export function buildTeamMessagingWebhookPublicUrl(
  baseUrl: string,
  token: string,
): string {
  return `${baseUrl.replace(/\/+$/, '')}/webhooks/ringcentral/team-messaging/${token}`;
}

export function persistSubscriptionFromApiResponse(
  service: TeamMessagingWebhookService,
  body: Record<string, unknown>,
  deliveryAddress: string,
): void {
  const subscriptionId = String(body.id ?? '');
  if (!subscriptionId) return;
  const expirationTime = String(body.expirationTime ?? '');
  const expiresAt = expirationTime ? Math.floor(Date.parse(expirationTime) / 1000) : undefined;
  service.getRepository().upsertSubscription({
    id: uuidv4(),
    subscriptionId,
    deliveryAddress,
    status: String(body.status ?? 'Active'),
    eventFilters: Array.isArray(body.eventFilters)
      ? body.eventFilters.map(String)
      : [RC_TM_POSTS_EVENT_FILTER],
    expiresAt,
    lastError: null,
  });
}
