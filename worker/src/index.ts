import { hostname as osHostname } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CLAIM_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  claim,
  heartbeat,
  pairWorker,
  report,
  type WorkerState,
} from './protocol.js';
import { runClaimedTask, type LocalExecutorSettings } from './runner.js';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function loadState(dataDir: string): Promise<Partial<WorkerState>> {
  try {
    const raw = await readFile(path.join(dataDir, 'worker.json'), 'utf8');
    return JSON.parse(raw) as Partial<WorkerState>;
  } catch {
    return {};
  }
}

async function saveState(dataDir: string, state: WorkerState): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, 'worker.json'),
    JSON.stringify(state, null, 2),
    'utf8',
  );
}

async function main(): Promise<void> {
  const dataDir =
    argValue('--data-dir') ||
    process.env.WORKER_DATA_DIR ||
    path.join(process.env.HOME || process.cwd(), '.personal-ai', 'worker');
  const saved = await loadState(dataDir);
  let state: WorkerState = {
    serverUrl:
      argValue('--server') ||
      process.env.WORKER_SERVER_URL ||
      saved.serverUrl ||
      'http://127.0.0.1:3210',
    pairingToken:
      argValue('--token') || process.env.WORKER_PAIRING_TOKEN || saved.pairingToken,
    credential: saved.credential,
    workerId: saved.workerId,
    hostKind:
      (argValue('--host-kind') as WorkerState['hostKind']) ||
      (process.env.WORKER_HOST_KIND as WorkerState['hostKind']) ||
      saved.hostKind ||
      'headless',
    hostname: osHostname(),
  };

  if (!state.credential) {
    if (!state.pairingToken) {
      throw new Error('Pass --token <pairing> the first time, or reuse a paired data dir.');
    }
    state = await pairWorker(state);
    await saveState(dataDir, state);
    console.log(`[worker] paired as ${state.workerId}`);
  } else {
    await saveState(dataDir, state);
  }

  async function loadLocalSettings(): Promise<LocalExecutorSettings> {
    try {
      const raw = await readFile(path.join(dataDir, 'settings.json'), 'utf8');
      return JSON.parse(raw) as LocalExecutorSettings;
    } catch {
      return {};
    }
  }

  const loadedSettings = await loadLocalSettings();
  const settings: LocalExecutorSettings = {
    ...loadedSettings,
    cwd: argValue('--cwd') || process.env.WORKER_CWD || loadedSettings.cwd,
    acpCursorCommand:
      argValue('--acp-cursor-command') ||
      process.env.ACP_CURSOR_COMMAND ||
      loadedSettings.acpCursorCommand,
    cursorAgentCommand:
      argValue('--cursor-agent-command') ||
      process.env.CURSOR_AGENT_COMMAND ||
      loadedSettings.cursorAgentCommand,
  };
  let currentTaskCount = 0;
  let running = true;

  const writeRuntime = async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, 'runtime.json'),
      JSON.stringify({
        pid: process.pid,
        workerId: state.workerId,
        currentTaskCount,
        updatedAt: Date.now(),
      }),
      'utf8',
    );
  };

  const beat = async () => {
    try {
      const result = await heartbeat(state, currentTaskCount);
      await writeRuntime();
      for (const command of result.commands || []) {
        if (command.kind === 'echo') {
          await report(state, {
            commandId: command.id,
            result: { ok: true, at: Date.now() },
          });
        }
      }
    } catch (error) {
      console.error('[worker] heartbeat failed', error instanceof Error ? error.message : error);
    }
  };

  const pull = async () => {
    if (currentTaskCount > 0) return;
    try {
      const { tasks } = await claim(state, 1);
      for (const task of tasks) {
        currentTaskCount += 1;
        try {
          const envelope = await runClaimedTask(task, {
            ...settings,
            ...(await loadLocalSettings()),
            mcpBearer: state.credential,
            mcpUrl: task.memory?.mcpUrl,
            userId: task.memory?.userId,
          });
          await report(state, {
            actionId: task.actionId,
            fenceToken: task.fenceToken,
            envelope,
          });
        } catch (error) {
          await report(state, {
            actionId: task.actionId,
            fenceToken: task.fenceToken,
            envelope: {
              status: 'failed',
              summary: error instanceof Error ? error.message : String(error),
              artifacts: [],
            },
          });
        } finally {
          currentTaskCount = Math.max(0, currentTaskCount - 1);
        }
      }
    } catch (error) {
      console.error('[worker] claim failed', error instanceof Error ? error.message : error);
    }
  };

  await beat();
  if (hasFlag('--once')) {
    await pull();
    running = false;
  }

  const beatTimer = setInterval(() => {
    void beat();
  }, HEARTBEAT_INTERVAL_MS);
  const claimTimer = setInterval(() => {
    void pull();
  }, CLAIM_INTERVAL_MS);

  const shutdown = () => {
    running = false;
    clearInterval(beatTimer);
    clearInterval(claimTimer);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
