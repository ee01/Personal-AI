#!/usr/bin/env tsx
/**
 * Historical Glip post backfill via RingCentral REST (watermarks in SQLite).
 *
 *   npm run rc:tm-backfill -- --user esone.qiu --max-chats 5
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { RingCentralClient } from '../src/integrations/RingCentralClient.js';
import { TeamMessagingBackfillService } from '../src/integrations/ringcentral/TeamMessagingBackfillService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  const args = [...argv];
  const readFlag = (name: string) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    user: readFlag('--user') || 'default',
    maxChats: readFlag('--max-chats') ? Number(readFlag('--max-chats')) : 20,
    chatId: readFlag('--chat-id'),
    sinceAt: readFlag('--since') ? Number(readFlag('--since')) : undefined,
  };
}

async function main(): Promise<void> {
  const { user, maxChats, chatId, sinceAt } = parseArgs(process.argv.slice(2));
  const ucm = new UserContextManager(path.resolve(__dirname, '..', 'data'));
  const ctx = ucm.getContext(user);
  const client = new RingCentralClient(ctx.userDataManager, ctx.db, user);
  if (!client.isConfigured()) {
    console.error('RingCentral not configured for user', user);
    process.exit(1);
  }
  const backfill = new TeamMessagingBackfillService(
    ctx.db,
    ctx.userDataManager,
    user,
    client,
  );
  const result = await backfill.run({
    maxChats,
    sinceAt,
    chatIds: chatId ? [chatId] : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
