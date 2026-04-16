import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { reclassifyLegacyEvidenceResolutionConfirmRequests } from '../src/core/ConfirmRequestRoutingBackfill.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || process.env.USER_ID || 'esone.qiu';

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const summary = reclassifyLegacyEvidenceResolutionConfirmRequests(ctx.db, {
    dryRun: false,
    force: true,
  });

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        ...summary,
      },
      null,
      2,
    ),
  );

  ucm.closeAll();
}

main().catch((error) => {
  console.error('[backfill-confirm-routing] Failed:', error);
  process.exit(1);
});
