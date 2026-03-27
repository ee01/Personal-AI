import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.js';
import { StateStore } from './persistence.js';
import { DoubaoBrowserSession } from './browserSession.js';
import { DoubaoBridgeService } from './bridgeService.js';
import { createBridgeServer } from './server.js';
import { BridgeMemoryServiceClient } from './memoryServiceClient.js';
import { BridgeSyncManager } from './syncManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const config = loadConfig();
  const stateFile = path.join(config.dataDir, 'bridge-state.json');
  const store = new StateStore(stateFile);
  const browser = new DoubaoBrowserSession(config);
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();
  const memoryClient = new BridgeMemoryServiceClient(config);
  const syncManager = new BridgeSyncManager(config, memoryClient, service);

  const app = await createBridgeServer(config, service);
  const shutdown = async () => {
    syncManager.stop();
    await browser.close();
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().then(() => process.exit(0));
  });

  await app.listen({ host: config.host, port: config.port });
  syncManager.start();
  app.log.info(
    {
      cwd: process.cwd(),
      dataDir: config.dataDir,
      profileDir: config.profileDir,
      autoSync: config.autoSync,
      memoryServiceBaseUrl: config.memoryServiceBaseUrl,
    },
    `Doubao Bridge running at http://${config.host}:${config.port}`,
  );
}

main().catch((error) => {
  console.error('[doubao-bridge] failed to start:', error);
  process.exit(1);
});
