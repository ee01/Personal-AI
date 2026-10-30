#!/usr/bin/env tsx
/**
 * Create / renew / monitor RingCentral Team Messaging webhook subscriptions.
 *
 * Usage:
 *   cd memory-service
 *   RINGCENTRAL_TM_WEBHOOK_PUBLIC_URL=https://xxxx.ngrok.app \
 *   RINGCENTRAL_TM_WEBHOOK_TOKEN=local-secret \
 *   npm run rc:tm-webhook -- --user esone.qiu create
 *   npm run rc:tm-webhook -- --user esone.qiu renew --subscription-id <id>
 *   npm run rc:tm-webhook -- --user esone.qiu monitor
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getConfig } from '../src/config.js';
import { UserContextManager } from '../src/core/UserContextManager.js';
import { RingCentralClient } from '../src/integrations/RingCentralClient.js';
import { TeamMessagingWebhookService } from '../src/integrations/ringcentral/TeamMessagingWebhookService.js';
import {
  buildTeamMessagingWebhookPublicUrl,
  persistSubscriptionFromApiResponse,
} from '../src/routes/ringcentralTeamMessagingWebhook.js';
import { RC_TM_POSTS_EVENT_FILTER } from '../src/integrations/ringcentral/teamMessagingWebhookTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  const args = [...argv];
  const userIdx = args.indexOf('--user');
  const user = userIdx >= 0 ? args[userIdx + 1] : process.env.RINGCENTRAL_TM_WEBHOOK_USER_ID;
  const command = args.find((a) => !a.startsWith('-') && a !== user) ?? 'monitor';
  const subIdx = args.indexOf('--subscription-id');
  return {
    user: user || 'default',
    command,
    subscriptionId: subIdx >= 0 ? args[subIdx + 1] : undefined,
  };
}

async function main(): Promise<void> {
  const { user, command, subscriptionId } = parseArgs(process.argv.slice(2));
  const config = getConfig();
  const token = config.ringCentralTeamMessagingWebhookToken;
  const publicBase = config.ringCentralTeamMessagingWebhookPublicUrl;
  if (!token || !publicBase) {
    console.error(
      'Set RINGCENTRAL_TM_WEBHOOK_TOKEN and RINGCENTRAL_TM_WEBHOOK_PUBLIC_URL (HTTPS, e.g. ngrok).',
    );
    process.exit(1);
  }

  const ucm = new UserContextManager(path.resolve(__dirname, '..', 'data'));
  const ctx = ucm.getContext(user);
  const client = new RingCentralClient(ctx.userDataManager, ctx.db, user);
  if (!client.isConfigured()) {
    console.error('RingCentral JWT credentials missing in user config.json or env.');
    process.exit(1);
  }

  const webhookUrl = buildTeamMessagingWebhookPublicUrl(publicBase, token);
  const service = new TeamMessagingWebhookService(ctx.db, ctx.userDataManager, user);

  if (command === 'create') {
    const body = await client.createTeamMessagingWebhookSubscription({
      address: webhookUrl,
      eventFilters: [RC_TM_POSTS_EVENT_FILTER],
    });
    persistSubscriptionFromApiResponse(service, body, webhookUrl);
    console.log(JSON.stringify({ action: 'create', subscriptionId: body.id, webhookUrl }, null, 2));
    return;
  }

  if (command === 'renew') {
    if (!subscriptionId) {
      console.error('Pass --subscription-id for renew');
      process.exit(1);
    }
    const body = await client.renewTeamMessagingWebhookSubscription(subscriptionId);
    persistSubscriptionFromApiResponse(service, body, webhookUrl);
    console.log(JSON.stringify({ action: 'renew', subscriptionId, expirationTime: body.expirationTime }, null, 2));
    return;
  }

  const remote = await client.listWebhookSubscriptions();
  const blacklisted = remote.filter(
    (item) => String(item.status ?? '').toLowerCase() === 'blacklisted',
  );
  console.log(
    JSON.stringify(
      {
        action: 'monitor',
        webhookUrl,
        local: service.getRepository().listSubscriptions(),
        remoteCount: remote.length,
        blacklisted,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
