const locks = new Map<string, Promise<unknown>>();

export class ExportLockBusyError extends Error {
  statusCode = 409 as const;

  constructor(userId: string) {
    super(`An export or backup is already running for user ${userId}`);
    this.name = 'ExportLockBusyError';
  }
}

export async function withUserExportLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (locks.has(userId)) {
    throw new ExportLockBusyError(userId);
  }

  const work = (async () => fn())();
  locks.set(userId, work);
  try {
    return await work;
  } finally {
    if (locks.get(userId) === work) {
      locks.delete(userId);
    }
  }
}

export function isUserExportLocked(userId: string): boolean {
  return locks.has(userId);
}
