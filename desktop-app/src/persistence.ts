import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  BridgeStatus,
  BridgeSyncAttemptLogEntry,
  BindingType,
  ThreadBinding,
  ThreadRecord,
} from './types.js';

export interface BridgeStateFile {
  paired: boolean;
  pairToken?: string;
  authStatus: BridgeStatus['authStatus'];
  bindings: Partial<Record<BindingType, ThreadBinding>>;
  threads: ThreadRecord[];
  syncAttempts: BridgeSyncAttemptLogEntry[];
  lastSyncAt?: string;
  lastError?: string;
}

const DEFAULT_STATE: BridgeStateFile = {
  paired: false,
  authStatus: 'unknown',
  bindings: {},
  threads: [],
  syncAttempts: [],
};

export class StateStore {
  constructor(private readonly stateFile: string) {}

  async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
  }

  async load(): Promise<BridgeStateFile> {
    try {
      const raw = await fs.readFile(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as BridgeStateFile;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        bindings: parsed.bindings || {},
        threads: parsed.threads || [],
        syncAttempts: Array.isArray(parsed.syncAttempts)
          ? parsed.syncAttempts
          : [],
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  async save(state: BridgeStateFile): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }

  createToken(): string {
    return randomUUID();
  }
}
