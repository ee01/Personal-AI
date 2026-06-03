import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { BridgeMemoryServiceClient } from '../../memoryServiceClient.js';
import type {
  BridgeSettingsStore,
  ExplorerLocalAgentSettings,
} from '../../settings.js';
import { RawMessageStore } from '../cache/RawMessageStore.js';
import { CursorStore } from '../CursorStore.js';
import { ExplorerExtractor } from '../extractor.js';
import type { ExplorerRunSummary, RawMessageRecord, SourceId } from '../types.js';

interface LocalAgentSessionFile {
  filePath: string;
  mtimeMs: number;
}

interface ParsedAgentMessage {
  id?: string;
  role: string;
  text: string;
  ts?: string;
}

interface LocalAgentSessionSourceOptions {
  source: Extract<SourceId, 'codex_cli' | 'claude_code_cli' | 'cursor_agent_cli'>;
  settingsStore: BridgeSettingsStore;
  rawStore: RawMessageStore;
  cursorStore: CursorStore;
  memoryClient: BridgeMemoryServiceClient;
}

export class LocalAgentSessionSource {
  constructor(private readonly options: LocalAgentSessionSourceOptions) {}

  async getAuthStatus(): Promise<'connected'> {
    return 'connected';
  }

  async runNow(): Promise<Partial<ExplorerRunSummary> & { implemented: true }> {
    const settings = this.getSettings();
    const files = await this.discoverSessionFiles(settings);
    let insertedCount = 0;

    for (const file of files) {
      const messages = await this.parseSessionFile(file.filePath);
      insertedCount += this.options.rawStore.insertMany(messages);
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        await this.options.cursorStore.upsert({
          source: this.options.source,
          conversationId: lastMessage.conversationId,
          lastMessageId: lastMessage.messageId,
          lastProcessedUpdateTime: lastMessage.ts,
          contentHash: lastMessage.contentHash,
        });
      }
    }

    const extractor = new ExplorerExtractor(
      this.options.memoryClient,
      this.options.rawStore,
    );
    const extracted = await extractor.extractPendingMessages({
      source: this.options.source,
      defaultScope: settings.defaultScope,
      autoClassify: this.options.settingsStore.getSettings().explorer.autoClassify,
      extractMode: 'agent_session',
    });

    return {
      implemented: true,
      insertedCount,
      extractedConversationCount: extracted.conversationCount,
      extractedMessageCount: extracted.messageCount,
      artifactCount: extracted.artifactCount,
      skippedConversationCount: extracted.skippedConversationCount,
    };
  }

  private getSettings(): ExplorerLocalAgentSettings {
    return this.options.settingsStore.getSettings().explorer[this.options.source];
  }

  private async discoverSessionFiles(
    settings: ExplorerLocalAgentSettings,
  ): Promise<LocalAgentSessionFile[]> {
    const cutoffMs =
      settings.lookbackDays > 0
        ? Date.now() - settings.lookbackDays * 24 * 60 * 60 * 1000
        : 0;
    const files: LocalAgentSessionFile[] = [];
    for (const root of settings.rootPaths) {
      const expandedRoot = expandLocalPath(root);
      const discovered = await walkJsonlFiles(expandedRoot, {
        includeSubagents: settings.includeSubagents,
        source: this.options.source,
      });
      for (const filePath of discovered) {
        try {
          const stat = await fs.stat(filePath);
          if (cutoffMs > 0 && stat.mtimeMs < cutoffMs) continue;
          files.push({ filePath, mtimeMs: stat.mtimeMs });
        } catch {
          // Ignore files that disappear while scanning.
        }
      }
    }
    files.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return settings.maxSessions > 0 ? files.slice(0, settings.maxSessions) : files;
  }

  private async parseSessionFile(filePath: string): Promise<RawMessageRecord[]> {
    const raw = await fs.readFile(filePath, 'utf8');
    const conversationId = toConversationId(this.options.source, filePath);
    const lines = raw.split(/\n/).filter((line) => line.trim());
    const messages: RawMessageRecord[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const parsed = parseJsonLine(lines[index]!);
      if (!parsed) continue;
      const message = extractAgentMessage(parsed);
      if (!message?.text) continue;
      const content = compactAgentMessageText(message.text);
      if (!content) continue;
      const stableId =
        message.id ||
        hashText(`${conversationId}:${index}:${message.role}:${content}`);
      messages.push({
        source: this.options.source,
        conversationId,
        messageId: stableId,
        ts: message.ts,
        role: message.role,
        contentHash: hashText(`${message.role}\n${content}`),
        content,
      });
    }

    return messages;
  }
}

function expandLocalPath(value: string): string {
  const withEnv = value.replace(
    /\$\{([A-Z0-9_]+)(?::-([^}]+))?\}/gi,
    (_match, name: string, fallback: string | undefined) =>
      process.env[name] || fallback || '',
  );
  if (withEnv === '~') return os.homedir();
  if (withEnv.startsWith('~/')) return path.join(os.homedir(), withEnv.slice(2));
  return withEnv;
}

async function walkJsonlFiles(
  root: string,
  options: {
    includeSubagents: boolean;
    source: SourceId;
  },
): Promise<string[]> {
  const results: string[] = [];
  async function walk(current: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(current, {
        withFileTypes: true,
        encoding: 'utf8',
      });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = String(entry.name);
      const next = path.join(current, name);
      if (entry.isDirectory()) {
        if (!options.includeSubagents && name === 'subagents') continue;
        await walk(next);
        continue;
      }
      if (!entry.isFile() || !name.endsWith('.jsonl')) continue;
      if (
        options.source === 'cursor_agent_cli' &&
        !next.includes(`${path.sep}agent-transcripts${path.sep}`)
      ) {
        continue;
      }
      results.push(next);
    }
  }
  await walk(root);
  return results;
}

function parseJsonLine(line: string): unknown | null {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return null;
  }
}

function extractAgentMessage(value: unknown): ParsedAgentMessage | null {
  if (!isRecord(value)) return null;
  const candidates = [
    value,
    value.message,
    value.payload,
    isRecord(value.payload) ? value.payload.message : undefined,
    isRecord(value.payload) ? value.payload.item : undefined,
    isRecord(value.item) ? value.item : undefined,
  ].filter(isRecord);

  for (const candidate of candidates) {
    const text = extractContentText(candidate);
    if (!text) continue;
    return {
      id: getString(candidate.id) || getString(candidate.uuid) || getString(candidate.messageId),
      role: normalizeRole(
        getString(candidate.role) ||
          getString(candidate.type) ||
          getString(isRecord(candidate.author) ? candidate.author.role : undefined),
      ),
      text,
      ts: normalizeTimestamp(
        candidate.timestamp ??
          candidate.created_at ??
          candidate.create_time ??
          candidate.updated_at,
      ),
    };
  }
  return null;
}

function extractContentText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(extractContentText).filter(Boolean).join('\n').trim();
  }
  if (!isRecord(value)) return '';
  const direct =
    getString(value.content) ||
    getString(value.text) ||
    getString(value.output) ||
    getString(value.summary) ||
    getString(value.message);
  if (direct) return direct;
  if (Array.isArray(value.content)) return extractContentText(value.content);
  if (Array.isArray(value.parts)) return extractContentText(value.parts);
  if (Array.isArray(value.list)) return extractContentText(value.list);
  if (isRecord(value.content)) return extractContentText(value.content);
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeRole(value?: string): string {
  const normalized = value?.toLowerCase() ?? '';
  if (/user|human/.test(normalized)) return 'user';
  if (/assistant|agent|bot|model/.test(normalized)) return 'assistant';
  if (/tool|function/.test(normalized)) return 'tool';
  return normalized || 'unknown';
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return normalizeTimestamp(numeric);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}

function compactAgentMessageText(text: string): string {
  const compacted = text
    .replace(/```[\s\S]*?```/g, '[code omitted]')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      if (!line.trim()) return false;
      if (/^([+-]{3}|@@|diff --git|index [a-f0-9]+\.\.)/.test(line)) {
        return false;
      }
      if (/^[+-]\s/.test(line) && line.length > 12) return false;
      return true;
    })
    .join('\n')
    .trim();
  return compacted.length > 4000
    ? `${compacted.slice(0, 4000).trimEnd()}...`
    : compacted;
}

function toConversationId(source: SourceId, filePath: string): string {
  const home = os.homedir();
  const normalized = filePath.startsWith(home)
    ? `~${filePath.slice(home.length)}`
    : filePath;
  return `${source}:${normalized}`;
}

function hashText(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
