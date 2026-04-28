import fs from 'node:fs/promises';
import path from 'node:path';

import type { ExplorationCursor, SourceId } from './types.js';

interface CursorFileShape {
  cursors?: ExplorationCursor[];
}

function cursorKey(source: SourceId, conversationId: string): string {
  return `${source}:${conversationId}`;
}

function sanitizeProcessedMessageIds(
  value: ExplorationCursor['processedMessageIds'],
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const processedMessageIds = Array.from(
    new Set(
      value
        .map((messageId) => messageId?.trim())
        .filter((messageId): messageId is string => Boolean(messageId)),
    ),
  );

  return processedMessageIds.length > 0 ? processedMessageIds : undefined;
}

function cloneCursor(cursor: ExplorationCursor): ExplorationCursor {
  const processedMessageIds = sanitizeProcessedMessageIds(
    cursor.processedMessageIds,
  );
  return processedMessageIds
    ? {
        ...cursor,
        processedMessageIds,
      }
    : { ...cursor };
}

export class CursorStore {
  private readonly cursors = new Map<string, ExplorationCursor>();
  private loadPromise: Promise<void>;

  constructor(private readonly filePath: string) {
    this.loadPromise = this.load();
  }

  async get(
    source: SourceId,
    conversationId: string,
  ): Promise<ExplorationCursor | undefined> {
    await this.loadPromise;
    const cursor = this.cursors.get(cursorKey(source, conversationId));
    return cursor ? cloneCursor(cursor) : undefined;
  }

  async list(source?: SourceId): Promise<ExplorationCursor[]> {
    await this.loadPromise;
    return Array.from(this.cursors.values())
      .filter((cursor) => !source || cursor.source === source)
      .map((cursor) => cloneCursor(cursor));
  }

  async upsert(cursor: ExplorationCursor): Promise<void> {
    await this.loadPromise;
    this.cursors.set(
      cursorKey(cursor.source, cursor.conversationId),
      cloneCursor(cursor),
    );
    await this.persist();
  }

  async reset(source: SourceId, conversationId?: string): Promise<number> {
    await this.loadPromise;
    if (conversationId) {
      const deleted = this.cursors.delete(cursorKey(source, conversationId))
        ? 1
        : 0;
      if (deleted > 0) {
        await this.persist();
      }
      return deleted;
    }

    let deleted = 0;
    for (const key of Array.from(this.cursors.keys())) {
      if (!key.startsWith(`${source}:`)) {
        continue;
      }
      this.cursors.delete(key);
      deleted += 1;
    }
    if (deleted > 0) {
      await this.persist();
    }
    return deleted;
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as CursorFileShape;
      for (const cursor of parsed.cursors ?? []) {
        if (!cursor?.source || !cursor?.conversationId) {
          continue;
        }
        this.cursors.set(
          cursorKey(cursor.source, cursor.conversationId),
          cloneCursor(cursor),
        );
      }
    } catch {
      // Fresh store.
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: CursorFileShape = {
      cursors: Array.from(this.cursors.values()).sort((left, right) =>
        left.source === right.source
          ? left.conversationId.localeCompare(right.conversationId)
          : left.source.localeCompare(right.source),
      ),
    };
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
