export interface PersistentTaskThrottleStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface PersistentTaskThrottleEntry {
  lastAttemptAt: number;
  lastSucceededAt?: number;
  nextAllowedAt: number;
  lastStatus: 'running' | 'success' | 'failure';
}

export interface PersistentTaskThrottleResult<T> {
  ran: boolean;
  joined?: boolean;
  value?: T;
  nextAllowedAt: number;
}

export interface PersistentTaskThrottleOptions<T> {
  storage: PersistentTaskThrottleStorage;
  taskId: string;
  task: () => Promise<T>;
  successIntervalMs: number;
  failureIntervalMs?: number;
  leaseMs?: number;
  now?: () => number;
}

const STORAGE_KEY = 'persistentBackgroundTaskThrottle_v1';
const inFlight = new Map<string, Promise<PersistentTaskThrottleResult<unknown>>>();
let storageWriteQueue: Promise<void> = Promise.resolve();

function normalizeEntries(raw: unknown): Record<string, PersistentTaskThrottleEntry> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, PersistentTaskThrottleEntry> = {};
  for (const [taskId, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = value as Partial<PersistentTaskThrottleEntry> | null;
    if (
      !taskId ||
      !entry ||
      !Number.isFinite(entry.lastAttemptAt) ||
      !Number.isFinite(entry.nextAllowedAt) ||
      !['running', 'success', 'failure'].includes(String(entry.lastStatus))
    ) {
      continue;
    }
    result[taskId] = {
      lastAttemptAt: Number(entry.lastAttemptAt),
      ...(Number.isFinite(entry.lastSucceededAt)
        ? { lastSucceededAt: Number(entry.lastSucceededAt) }
        : {}),
      nextAllowedAt: Number(entry.nextAllowedAt),
      lastStatus: entry.lastStatus as PersistentTaskThrottleEntry['lastStatus'],
    };
  }
  return result;
}

async function readEntries(
  storage: PersistentTaskThrottleStorage,
): Promise<Record<string, PersistentTaskThrottleEntry>> {
  const stored = await storage.get(STORAGE_KEY);
  return normalizeEntries(stored?.[STORAGE_KEY]);
}

async function writeEntry(
  storage: PersistentTaskThrottleStorage,
  taskId: string,
  entry: PersistentTaskThrottleEntry,
): Promise<void> {
  const write = storageWriteQueue.then(async () => {
    const entries = await readEntries(storage);
    entries[taskId] = entry;
    await storage.set({ [STORAGE_KEY]: entries });
  });
  storageWriteQueue = write.catch(() => undefined);
  await write;
}

export async function runPersistentlyThrottledTask<T>(
  options: PersistentTaskThrottleOptions<T>,
): Promise<PersistentTaskThrottleResult<T>> {
  const existing = inFlight.get(options.taskId);
  if (existing) {
    const joined = (await existing) as PersistentTaskThrottleResult<T>;
    return { ...joined, joined: true };
  }

  const run = (async (): Promise<PersistentTaskThrottleResult<T>> => {
    const now = options.now || Date.now;
    const startedAt = now();
    const entries = await readEntries(options.storage);
    const previous = entries[options.taskId];
    if (previous && previous.nextAllowedAt > startedAt) {
      return {
        ran: false,
        nextAllowedAt: previous.nextAllowedAt,
      };
    }

    const leaseMs = Math.max(1_000, options.leaseMs || 60_000);
    await writeEntry(options.storage, options.taskId, {
      lastAttemptAt: startedAt,
      lastSucceededAt: previous?.lastSucceededAt,
      nextAllowedAt: startedAt + leaseMs,
      lastStatus: 'running',
    });

    try {
      const value = await options.task();
      const finishedAt = now();
      const nextAllowedAt = finishedAt + Math.max(1, options.successIntervalMs);
      await writeEntry(options.storage, options.taskId, {
        lastAttemptAt: startedAt,
        lastSucceededAt: finishedAt,
        nextAllowedAt,
        lastStatus: 'success',
      });
      return { ran: true, value, nextAllowedAt };
    } catch (error) {
      const finishedAt = now();
      const nextAllowedAt =
        finishedAt + Math.max(1, options.failureIntervalMs || 60_000);
      await writeEntry(options.storage, options.taskId, {
        lastAttemptAt: startedAt,
        lastSucceededAt: previous?.lastSucceededAt,
        nextAllowedAt,
        lastStatus: 'failure',
      });
      throw error;
    }
  })();

  inFlight.set(
    options.taskId,
    run as Promise<PersistentTaskThrottleResult<unknown>>,
  );
  try {
    return await run;
  } finally {
    inFlight.delete(options.taskId);
  }
}
