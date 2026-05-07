import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.js';
import { StateStore } from './persistence.js';
import { DoubaoBrowserSession } from './browserSession.js';
import { DoubaoBridgeService } from './bridgeService.js';
import {
  CursorStore,
  ExplorerManager,
  RawMessageStore,
} from './explorer/index.js';
import {
  ChatGPTSource,
  PlaywrightChatGPTClient,
} from './explorer/sources/ChatGPTSource.js';
import { FallbackChatGPTClient } from './explorer/sources/FallbackChatGPTClient.js';
import { WebpageMcpChatGPTClient } from './explorer/sources/WebpageMcpChatGPTClient.js';
import { DoubaoChatSource } from './explorer/sources/DoubaoChatSource.js';
import { FallbackDoubaoSource } from './explorer/sources/FallbackDoubaoSource.js';
import { WebpageMcpDoubaoSource } from './explorer/sources/WebpageMcpDoubaoSource.js';
import { WebpageMcpHost } from './explorer/transports/WebpageMcpHost.js';
import { FallbackDoubaoBroadcast } from './transports/FallbackDoubaoBroadcast.js';
import { WebpageMcpDoubaoBroadcast } from './transports/WebpageMcpDoubaoBroadcast.js';
import { createBridgeServer } from './server.js';
import { BridgeMemoryServiceClient } from './memoryServiceClient.js';
import { BridgeSyncManager } from './syncManager.js';
import {
  applyBridgeSettingsToConfig,
  BridgeSettingsStore,
} from './settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const config = loadConfig();
  const stateFile = path.join(config.dataDir, 'bridge-state.json');
  const settingsFile = path.join(config.dataDir, 'bridge-settings.json');
  const explorerDbFile = path.join(
    config.dataDir,
    'explorer',
    'raw-messages.sqlite',
  );
  const explorerCursorFile = path.join(
    config.dataDir,
    'explorer',
    'cursors.json',
  );
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, 'utf8'),
  ) as { version?: string };
  const store = new StateStore(stateFile);
  const settingsStore = new BridgeSettingsStore(config, settingsFile);
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());
  settingsStore.subscribe((settings) => {
    applyBridgeSettingsToConfig(config, settings);
  });
  const mcpHost = WebpageMcpHost.getInstance();
  const browser = new DoubaoBrowserSession(config);
  const mcpBroadcast = new WebpageMcpDoubaoBroadcast(mcpHost);
  const broadcastAdapter = new FallbackDoubaoBroadcast({
    getTransport: () =>
      settingsStore.getSettings().explorer.doubao.broadcastTransport,
    webpageMcpClient: mcpBroadcast,
    playwrightClient: browser,
    log: (message, error) => console.warn(message, error),
  });

  const version = packageJson.version || '0.0.0';
  const service = new DoubaoBridgeService(config, store, broadcastAdapter, version);
  await service.init();
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const rawMessageStore = new RawMessageStore(explorerDbFile);
  const cursorStore = new CursorStore(explorerCursorFile);

  const mcpDoubaoExplorer = new WebpageMcpDoubaoSource(mcpHost);
  const doubaoExplorerClient = new FallbackDoubaoSource({
    getTransport: () => settingsStore.getSettings().explorer.doubao.transport,
    webpageMcpClient: mcpDoubaoExplorer,
    playwrightClient: browser,
    log: (message, error) => console.warn(message, error),
  });

  const doubaoSource = new DoubaoChatSource(
    settingsStore,
    rawMessageStore,
    cursorStore,
    memoryClient,
    doubaoExplorerClient,
    {
      getBoundConversationIds: () => service.getBoundThreadIds(),
    },
  );
  const chatgptApiClient = new FallbackChatGPTClient({
    getTransport: () =>
      settingsStore.getSettings().explorer.chatgpt.transport ?? 'playwright',
    webpageMcpClient: new WebpageMcpChatGPTClient(mcpHost),
    playwrightClient: new PlaywrightChatGPTClient(config),
  });
  const chatgptSource = new ChatGPTSource(
    settingsStore,
    rawMessageStore,
    cursorStore,
    memoryClient,
    chatgptApiClient,
  );
  const explorerManager = new ExplorerManager({
    settingsStore,
    memoryClient,
    rawStore: rawMessageStore,
    cursorStore,
    sourceAdapters: {
      doubao: doubaoSource,
      chatgpt: chatgptSource,
    },
  });
  const syncManager = new BridgeSyncManager(
    config,
    settingsStore,
    memoryClient,
    service,
    explorerManager,
  );

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    explorerManager,
    version,
  });
  const shutdown = async () => {
    syncManager.stop();
    await explorerManager.close();
    await browser.close();
    await mcpHost.stop();
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
    `Desktop App running at http://${config.host}:${config.port}`,
  );
}

main().catch((error) => {
  console.error('[desktop-app] failed to start:', error);
  process.exit(1);
});
