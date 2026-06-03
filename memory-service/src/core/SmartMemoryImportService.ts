import AdmZip from 'adm-zip';
import type BetterSqlite3 from 'better-sqlite3';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { v4 as uuidv4 } from 'uuid';

import type { UserContext } from './UserContextManager.js';
import { contentHash } from '../utils/hashing.js';
import { chunkText } from '../utils/chunking.js';
import { now } from '../utils/time.js';

export type SmartMemoryImportInputKind = 'paste' | 'file';
export type SmartMemoryImportDetectedKind =
  | 'text'
  | 'document'
  | 'document_zip'
  | 'external_ai_history'
  | 'backup_zip'
  | 'unsupported';

export interface SmartMemoryImportInput {
  inputKind: SmartMemoryImportInputKind;
  text?: string;
  fileName?: string;
  mimeType?: string;
  buffer?: Buffer;
  scope?: 'work' | 'personal';
}

export interface SmartMemoryImportEntry {
  id: string;
  path: string;
  title: string;
  kind: 'text' | 'markdown' | 'json' | 'pdf' | 'unsupported';
  status: 'ready' | 'blocked';
  sizeBytes: number;
  hash?: string;
  chunkCount: number;
  preview: string;
  blockedReason?: string;
}

export interface SmartMemoryImportInspectResult {
  detectedKind: SmartMemoryImportDetectedKind;
  inputKind: SmartMemoryImportInputKind;
  fileName?: string;
  sourceHash: string;
  status: 'ready' | 'backup' | 'blocked' | 'duplicate';
  summary: {
    files: number;
    readyFiles: number;
    chunks: number;
    profileCandidates: number;
    skillSignals: number;
    highRisk: number;
    unsupported: number;
    backup: boolean;
    externalAiConversations?: number;
    externalAiImportedMessages?: number;
    externalAiTotalMessages?: number;
    externalAiTruncatedConversations?: number;
    externalAiTruncatedMessages?: number;
    promotionCandidates?: number;
  };
  entries: SmartMemoryImportEntry[];
  backup?: {
    reason: string;
    suggestedMode: 'merge';
    replaceRequiresConfirm: true;
  };
  existingBatchId?: string;
  warnings: string[];
}

export interface SmartMemoryImportCommitResult {
  status: 'committed' | 'duplicate';
  batchId: string;
  detectedKind: SmartMemoryImportDetectedKind;
  importedMessages: number;
  importedChunks: number;
  skippedEntries: number;
  warnings: string[];
}

interface ParsedImportSource {
  detectedKind: SmartMemoryImportDetectedKind;
  sourceHash: string;
  entries: ParsedImportEntry[];
  backup?: SmartMemoryImportInspectResult['backup'];
  warnings: string[];
}

interface CountRow {
  count: number;
}

interface ParsedImportEntry extends SmartMemoryImportEntry {
  content: string;
  sourceKind?: 'document' | 'pdf' | 'external_ai_history';
  metadata?: Record<string, unknown>;
}

interface ExternalAiImportStats {
  conversations: number;
  importedMessages: number;
  totalMessages: number;
  truncatedConversations: number;
  truncatedMessages: number;
}

const PARSER_VERSION = 'smart-memory-import-v1';
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 80;
const MAX_ZIP_TEXT_ENTRY_BYTES = 768 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_EXTERNAL_AI_CONVERSATIONS = 40;
const MAX_EXTERNAL_AI_MESSAGES_PER_CONVERSATION = 80;
const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.csv',
  '.log',
]);

export class SmartMemoryImportValidationError extends Error {
  statusCode = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = 'SmartMemoryImportValidationError';
  }
}

export class SmartMemoryImportService {
  constructor(private readonly userContext: UserContext) {}

  inspect(input: SmartMemoryImportInput): SmartMemoryImportInspectResult {
    const parsed = this.parse(input);
    const existingBatchId = this.findCommittedBatch(parsed.sourceHash);
    const readyEntries = parsed.entries.filter((entry) => entry.status === 'ready');
    const highRisk = readyEntries.reduce(
      (count, entry) => count + countHighRiskSignals(entry.content),
      0,
    );
    const profileCandidates = readyEntries.reduce(
      (count, entry) => count + countProfileSignals(entry.content),
      0,
    );
    const skillSignals = readyEntries.reduce(
      (count, entry) => count + countSkillSignals(entry.content),
      0,
    );
    const externalAiConversations = readyEntries.filter(
      (entry) => entry.sourceKind === 'external_ai_history',
    ).length;
    const externalAiStats = summarizeExternalAiEntries(readyEntries);
    const unsupported = parsed.entries.filter(
      (entry) => entry.status === 'blocked',
    ).length;

    const status: SmartMemoryImportInspectResult['status'] = parsed.backup
      ? 'backup'
      : existingBatchId
        ? 'duplicate'
        : readyEntries.length > 0
          ? 'ready'
          : 'blocked';

    return {
      detectedKind: parsed.detectedKind,
      inputKind: input.inputKind,
      fileName: input.fileName,
      sourceHash: parsed.sourceHash,
      status,
      summary: {
        files: parsed.entries.length,
        readyFiles: readyEntries.length,
        chunks: readyEntries.reduce((sum, entry) => sum + entry.chunkCount, 0),
        profileCandidates,
        skillSignals,
        highRisk,
        unsupported,
        backup: Boolean(parsed.backup),
        externalAiConversations,
        externalAiImportedMessages: externalAiStats.importedMessages,
        externalAiTotalMessages: externalAiStats.totalMessages,
        externalAiTruncatedConversations: externalAiStats.truncatedConversations,
        externalAiTruncatedMessages: externalAiStats.truncatedMessages,
        promotionCandidates: profileCandidates + skillSignals,
      },
      entries: parsed.entries.map(toPublicEntry),
      backup: parsed.backup,
      existingBatchId: existingBatchId ?? undefined,
      warnings: parsed.warnings,
    };
  }

  commit(input: SmartMemoryImportInput): SmartMemoryImportCommitResult {
    const parsed = this.parse(input);
    if (parsed.backup) {
      throw new SmartMemoryImportValidationError(
        'Detected a Personal AI backup zip. Use /import backup restore instead.',
      );
    }

    const existingBatchId = this.findCommittedBatch(parsed.sourceHash);
    if (existingBatchId) {
      return {
        status: 'duplicate',
        batchId: existingBatchId,
        detectedKind: parsed.detectedKind,
        importedMessages: 0,
        importedChunks: 0,
        skippedEntries: parsed.entries.length,
        warnings: ['This source was already imported.'],
      };
    }

    const readyEntries = parsed.entries.filter((entry) => entry.status === 'ready');
    if (readyEntries.length === 0) {
      throw new SmartMemoryImportValidationError(
        'No supported text entries were found to import.',
      );
    }

    const batchId = uuidv4();
    const ts = now();
    const sourceName = input.fileName || 'pasted-text';
    const scope = input.scope ?? 'work';
    const externalAiStats = summarizeExternalAiEntries(readyEntries);
    const batchSummary = {
      files: parsed.entries.length,
      readyFiles: readyEntries.length,
      chunks: readyEntries.reduce((sum, entry) => sum + entry.chunkCount, 0),
      profileCandidates: readyEntries.reduce(
        (sum, entry) => sum + countProfileSignals(entry.content),
        0,
      ),
      skillSignals: readyEntries.reduce(
        (sum, entry) => sum + countSkillSignals(entry.content),
        0,
      ),
      highRisk: readyEntries.reduce(
        (sum, entry) => sum + countHighRiskSignals(entry.content),
        0,
      ),
      unsupported: parsed.entries.filter((entry) => entry.status === 'blocked').length,
      externalAiConversations: readyEntries.filter(
        (entry) => entry.sourceKind === 'external_ai_history',
      ).length,
      externalAiImportedMessages: externalAiStats.importedMessages,
      externalAiTotalMessages: externalAiStats.totalMessages,
      externalAiTruncatedConversations: externalAiStats.truncatedConversations,
      externalAiTruncatedMessages: externalAiStats.truncatedMessages,
      parserVersion: PARSER_VERSION,
    };

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO memory_import_batches (
             id, input_kind, detected_kind, source_name, source_hash,
             source_count, status, summary_json, warnings_json, created_at, committed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          batchId,
          input.inputKind,
          parsed.detectedKind,
          sourceName,
          parsed.sourceHash,
          readyEntries.length,
          'committed',
          JSON.stringify(batchSummary),
          JSON.stringify(parsed.warnings),
          ts,
          ts,
        );

      for (const entry of readyEntries) {
        this.insertEntry(batchId, sourceName, scope, entry, ts);
      }
    });

    transaction();

    return {
      status: 'committed',
      batchId,
      detectedKind: parsed.detectedKind,
      importedMessages: readyEntries.length,
      importedChunks: batchSummary.chunks,
      skippedEntries: parsed.entries.length - readyEntries.length,
      warnings: parsed.warnings,
    };
  }

  private get db(): BetterSqlite3.Database {
    return this.userContext.db;
  }

  private parse(input: SmartMemoryImportInput): ParsedImportSource {
    if (input.inputKind === 'paste') {
      const text = normalizeText(input.text ?? '');
      if (!text) {
        throw new SmartMemoryImportValidationError('Text import cannot be empty.');
      }
      assertTextSize(Buffer.byteLength(text, 'utf8'));
      const sourceHash = contentHash(`paste:${text}`);
      return {
        detectedKind: 'text',
        sourceHash,
        entries: [buildTextEntry('pasted-text.md', text)],
        warnings: [],
      };
    }

    const fileName = sanitizeFileName(input.fileName || 'import-source');
    const buffer = input.buffer;
    if (!buffer || buffer.length === 0) {
      throw new SmartMemoryImportValidationError('Missing import file.');
    }
    const sourceHash = contentHash(buffer.toString('base64'));
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      return this.parseZip(fileName, buffer, sourceHash);
    }

    const extension = getExtension(fileName);
    if (extension === '.pdf') {
      return parsePdfImport(fileName, buffer, sourceHash);
    }

    if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
      return {
        detectedKind: 'unsupported',
        sourceHash,
        entries: [buildUnsupportedEntry(fileName, buffer.length, `Unsupported file type: ${extension || 'unknown'}`)],
        warnings: [`Unsupported file type: ${extension || 'unknown'}`],
      };
    }

    assertTextSize(buffer.length);
    const text = normalizeText(buffer.toString('utf8'));
    const detectedKind =
      extension === '.md' || extension === '.markdown' ? 'document' : 'text';
    if (!text) {
      return {
        detectedKind,
        sourceHash,
        entries: [buildUnsupportedEntry(fileName, buffer.length, 'Text file is empty.')],
        warnings: ['Text file is empty.'],
      };
    }
    return {
      detectedKind,
      sourceHash,
      entries: [buildTextEntry(fileName, text)],
      warnings: [],
    };
  }

  private parseZip(
    fileName: string,
    buffer: Buffer,
    sourceHash: string,
  ): ParsedImportSource {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw new SmartMemoryImportValidationError('Zip file is invalid or encrypted.');
    }

    const allFileEntries = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory);
    assertSafeZipPaths(allFileEntries.map((entry) => entry.entryName));

    if (isBackupZip(allFileEntries)) {
      return {
        detectedKind: 'backup_zip',
        sourceHash,
        entries: [
          {
            id: 'backup',
            path: fileName,
            title: 'Personal AI backup',
            kind: 'unsupported',
            status: 'blocked',
            sizeBytes: buffer.length,
            chunkCount: 0,
            preview:
              'Detected manifest.json, user/memory.db and user/config.json. This zip should be restored, not analyzed as documents.',
            content: '',
            blockedReason: 'backup_zip',
          },
        ],
        backup: {
          reason:
            'Detected Personal AI backup structure: manifest.json + user/memory.db + user/config.json.',
          suggestedMode: 'merge',
          replaceRequiresConfirm: true,
        },
        warnings:
          allFileEntries.length > MAX_ZIP_ENTRIES
            ? [`Only inspected the first ${MAX_ZIP_ENTRIES} entries.`]
            : [],
      };
    }

    const externalAiHistory = parseExternalAiZip(allFileEntries, sourceHash);
    if (externalAiHistory) {
      return externalAiHistory;
    }

    const entries = allFileEntries.slice(0, MAX_ZIP_ENTRIES);
    const parsedEntries: ParsedImportEntry[] = [];
    const warnings: string[] = [];
    for (const entry of entries) {
      const entryName = entry.entryName;
      const extension = getExtension(entryName);
      const data = entry.getData();
      if (extension === '.pdf') {
        const parsedPdf = parsePdfEntry(entryName, data);
        parsedEntries.push(parsedPdf);
        continue;
      }
      if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
        parsedEntries.push(
          buildUnsupportedEntry(
            entryName,
            data.length,
            `Unsupported file type: ${extension || 'unknown'}`,
          ),
        );
        continue;
      }
      if (data.length > MAX_ZIP_TEXT_ENTRY_BYTES) {
        parsedEntries.push(
          buildUnsupportedEntry(
            entryName,
            data.length,
            `Text entry is larger than ${MAX_ZIP_TEXT_ENTRY_BYTES} bytes.`,
          ),
        );
        continue;
      }
      const text = normalizeText(data.toString('utf8'));
      if (!text) {
        parsedEntries.push(
          buildUnsupportedEntry(entryName, data.length, 'Text entry is empty.'),
        );
        continue;
      }
      parsedEntries.push(buildTextEntry(entryName, text));
    }

    if (zip.getEntries().length > MAX_ZIP_ENTRIES) {
      warnings.push(`Only inspected the first ${MAX_ZIP_ENTRIES} entries.`);
    }

    return {
      detectedKind: 'document_zip',
      sourceHash,
      entries: parsedEntries,
      warnings,
    };
  }

  private findCommittedBatch(sourceHash: string): string | null {
    if (!this.tableExists('memory_import_batches')) return null;
    const row = this.db
      .prepare(
        `SELECT id
         FROM memory_import_batches
         WHERE source_hash = ? AND status = 'committed'
         ORDER BY committed_at DESC
         LIMIT 1`,
      )
      .get(sourceHash) as { id: string } | undefined;
    return row?.id ?? null;
  }

  private insertEntry(
    batchId: string,
    sourceName: string,
    scope: 'work' | 'personal',
    entry: ParsedImportEntry,
    ts: number,
  ): void {
    const content = entry.content;
    const messageId = uuidv4();
    const source = `import:${batchId}`;
    const title = entry.title || entry.path;
    const metadata = {
      importBatchId: batchId,
      importEntryId: entry.id,
      importEntryPath: entry.path,
      importEntryHash: entry.hash,
      importDetectedKind: entry.kind,
      parserVersion: PARSER_VERSION,
      shadowMemory: true,
      provenanceLabel: `记忆录入 · ${sourceName}`,
      lowWeight: true,
      importSourceKind: entry.sourceKind ?? 'document',
      importSourceMetadata: entry.metadata ?? {},
    };

    this.db
      .prepare(
        `INSERT INTO messages_raw
          (id, content, summary, scope, source, source_type, source_title,
           sender, group_id, group_name, timestamp, entities_json,
           matched_projects_json, importance, sentiment, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        messageId,
        content,
        `导入资料：${title}`,
        scope,
        source,
        'manual',
        title,
        'memory-import',
        batchId,
        `Memory Import · ${sourceName}`,
        ts,
        null,
        null,
        0.35,
        'neutral',
        JSON.stringify(metadata),
        ts,
        ts,
      );

    this.db
      .prepare(
        `INSERT OR REPLACE INTO memory_metadata
          (target_type, target_id, salience_score, importance, frequency,
           recency_boost, surprise_score, redundancy, access_count, decay_rate,
           half_life_days, consolidation_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'message',
        messageId,
        0.18,
        0.35,
        1,
        1,
        0,
        0,
        0,
        1.2,
        21,
        'temporary',
        ts,
        ts,
      );

    const chunks = chunkText(content);
    const insertChunk = this.db.prepare(
      `INSERT INTO chunks
        (file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_entity_id, token_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMetadata = this.db.prepare(
      `INSERT OR REPLACE INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency,
         recency_boost, surprise_score, redundancy, access_count, decay_rate,
         half_life_days, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const chunk of chunks) {
      const result = insertChunk.run(
        `imports/${batchId}/${entry.id}`,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.content,
        contentHash(chunk.content),
        scope,
        source,
        'manual',
        messageId,
        chunk.tokenCount,
        ts,
        ts,
      );
      insertMetadata.run(
        'chunk',
        String(result.lastInsertRowid),
        0.18,
        0.35,
        1,
        1,
        0,
        0,
        0,
        1.2,
        21,
        'temporary',
        ts,
        ts,
      );
    }
  }

  private tableExists(table: string): boolean {
    const row = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
      )
      .get(table) as { name?: string } | undefined;
    return Boolean(row?.name);
  }
}

function buildTextEntry(path: string, text: string): ParsedImportEntry {
  const normalized = normalizeText(text);
  const chunks = chunkText(normalized);
  return {
    id: contentHash(path).slice(0, 12),
    path,
    title: inferTitle(path, normalized),
    kind: kindForPath(path),
    status: 'ready',
    sizeBytes: Buffer.byteLength(normalized, 'utf8'),
    hash: contentHash(normalized),
    chunkCount: chunks.length,
    preview: makePreview(normalized),
    content: normalized,
    sourceKind: getExtension(path) === '.pdf' ? 'pdf' : 'document',
  };
}

function buildExternalAiEntry(
  path: string,
  title: string,
  text: string,
  metadata: Record<string, unknown>,
): ParsedImportEntry {
  const entry = buildTextEntry(path, text);
  return {
    ...entry,
    title,
    kind: 'markdown',
    sourceKind: 'external_ai_history',
    metadata,
  };
}

function buildUnsupportedEntry(
  path: string,
  sizeBytes: number,
  blockedReason: string,
): ParsedImportEntry {
  return {
    id: contentHash(`${path}:${blockedReason}`).slice(0, 12),
    path,
    title: inferTitle(path, ''),
    kind: blockedEntryKind(path),
    status: 'blocked',
    sizeBytes,
    chunkCount: 0,
    preview: '',
    content: '',
    blockedReason,
  };
}

function blockedEntryKind(path: string): SmartMemoryImportEntry['kind'] {
  const extension = getExtension(path);
  if (extension === '.pdf') return 'pdf';
  if (SUPPORTED_TEXT_EXTENSIONS.has(extension)) return kindForPath(path);
  return 'unsupported';
}

function toPublicEntry(entry: ParsedImportEntry): SmartMemoryImportEntry {
  const { content: _content, ...publicEntry } = entry;
  return publicEntry;
}

function summarizeExternalAiEntries(
  entries: ParsedImportEntry[],
): ExternalAiImportStats {
  const stats: ExternalAiImportStats = {
    conversations: 0,
    importedMessages: 0,
    totalMessages: 0,
    truncatedConversations: 0,
    truncatedMessages: 0,
  };

  for (const entry of entries) {
    if (entry.sourceKind !== 'external_ai_history') continue;
    const totalMessages = readMetadataNumber(entry.metadata, 'totalMessages');
    const importedMessages = readMetadataNumber(entry.metadata, 'importedMessages');
    const truncatedMessages =
      readMetadataNumber(entry.metadata, 'truncatedMessages') ??
      Math.max(0, (totalMessages ?? 0) - (importedMessages ?? 0));

    stats.conversations += 1;
    stats.totalMessages += totalMessages ?? 0;
    stats.importedMessages += importedMessages ?? totalMessages ?? 0;
    stats.truncatedMessages += truncatedMessages;
    if (truncatedMessages > 0) {
      stats.truncatedConversations += 1;
    }
  }

  return stats;
}

function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function makePreview(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= 420) {
    return normalized;
  }
  return `${normalized.slice(0, 420)}...`;
}

function isBackupZip(entries: AdmZip.IZipEntry[]): boolean {
  const names = new Set(entries.map((entry) => entry.entryName));
  if (!names.has('manifest.json')) return false;
  if (!names.has('user/memory.db') || !names.has('user/config.json')) {
    return false;
  }
  const manifestEntry = entries.find((entry) => entry.entryName === 'manifest.json');
  if (!manifestEntry) return false;
  try {
    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    return (
      manifest?.format === 'personal-ai-memory-backup' &&
      manifest?.transport === 'zip'
    );
  } catch {
    return false;
  }
}

function assertSafeZipPaths(paths: string[]): void {
  for (const entryName of paths) {
    if (!entryName || entryName.startsWith('/') || entryName.includes('..')) {
      throw new SmartMemoryImportValidationError(
        `Zip contains an unsafe entry path: ${entryName || '(empty)'}`,
      );
    }
  }
}

function assertTextSize(sizeBytes: number): void {
  if (sizeBytes > MAX_TEXT_BYTES) {
    throw new SmartMemoryImportValidationError(
      `Text import is too large. Max size is ${MAX_TEXT_BYTES} bytes.`,
    );
  }
}

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/]+/g, '/').split('/').filter(Boolean).pop() || 'import-source';
}

function getExtension(fileName: string): string {
  const normalized = fileName.toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
}

function kindForPath(path: string): SmartMemoryImportEntry['kind'] {
  const extension = getExtension(path);
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.json') return 'json';
  if (extension === '.pdf') return 'pdf';
  return 'text';
}

function parsePdfImport(
  fileName: string,
  buffer: Buffer,
  sourceHash: string,
): ParsedImportSource {
  const entry = parsePdfEntry(fileName, buffer);
  return {
    detectedKind: entry.status === 'ready' ? 'document' : 'unsupported',
    sourceHash,
    entries: [entry],
    warnings:
      entry.status === 'ready'
        ? ['PDF text was extracted with a built-in best-effort parser; OCR is not performed.']
        : ['PDF was detected but text extraction found no readable text.'],
  };
}

function parsePdfEntry(fileName: string, buffer: Buffer): ParsedImportEntry {
  if (buffer.length > MAX_PDF_BYTES) {
    return buildUnsupportedEntry(
      fileName,
      buffer.length,
      `PDF is larger than ${MAX_PDF_BYTES} bytes.`,
    );
  }

  const text = extractPdfText(buffer);
  if (!text) {
    return buildUnsupportedEntry(
      fileName,
      buffer.length,
      'PDF text extraction found no readable text; OCR is not enabled.',
    );
  }

  return {
    ...buildTextEntry(fileName, text),
    kind: 'pdf',
    sourceKind: 'pdf',
  };
}

function extractPdfText(buffer: Buffer): string {
  if (!buffer.subarray(0, 1024).toString('latin1').includes('%PDF')) {
    return '';
  }

  const raw = buffer.toString('latin1');
  const candidates = [raw, ...extractPdfStreams(raw)];
  const fragments: string[] = [];
  for (const candidate of candidates) {
    fragments.push(...extractPdfLiteralStrings(candidate));
    fragments.push(...extractPdfHexStrings(candidate));
  }

  return normalizeText(
    fragments
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => fragment.length >= 2 && /[A-Za-z0-9\u4e00-\u9fff]/.test(fragment))
      .join('\n'),
  );
}

function extractPdfStreams(raw: string): string[] {
  const streams: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(streamPattern)) {
    const streamData = Buffer.from(match[1], 'latin1');
    try {
      streams.push(inflateSync(streamData).toString('latin1'));
      continue;
    } catch {
      // Try raw deflate below.
    }
    try {
      streams.push(inflateRawSync(streamData).toString('latin1'));
    } catch {
      streams.push(match[1]);
    }
  }
  return streams;
}

function extractPdfLiteralStrings(content: string): string[] {
  const fragments: string[] = [];
  const textOperatorPattern = /\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")/g;
  const arrayPattern = /\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*\.?\d*)+)\]\s*TJ/g;

  for (const match of content.matchAll(textOperatorPattern)) {
    fragments.push(decodePdfLiteralString(match[1]));
  }

  for (const arrayMatch of content.matchAll(arrayPattern)) {
    for (const part of arrayMatch[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
      fragments.push(decodePdfLiteralString(part[1]));
    }
  }

  return fragments;
}

function extractPdfHexStrings(content: string): string[] {
  const fragments: string[] = [];
  const hexPattern = /<([0-9a-fA-F\s]{4,})>\s*(?:Tj|'|")/g;
  for (const match of content.matchAll(hexPattern)) {
    const hex = match[1].replace(/\s+/g, '');
    if (hex.length % 2 !== 0) continue;
    try {
      fragments.push(Buffer.from(hex, 'hex').toString('utf8'));
    } catch {
      // Ignore malformed text operands.
    }
  }
  return fragments;
}

function decodePdfLiteralString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_match, octal) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    );
}

function parseExternalAiZip(
  entries: AdmZip.IZipEntry[],
  sourceHash: string,
): ParsedImportSource | null {
  const conversationsEntry = entries.find((entry) =>
    entry.entryName.toLowerCase().endsWith('conversations.json'),
  );
  if (!conversationsEntry) return null;

  let conversations: unknown;
  try {
    conversations = JSON.parse(conversationsEntry.getData().toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(conversations)) return null;

  const parsedEntries = conversations
    .slice(0, MAX_EXTERNAL_AI_CONVERSATIONS)
    .map((conversation, index) =>
      buildExternalAiConversationEntry(conversation, index, conversationsEntry.entryName),
    )
    .filter((entry): entry is ParsedImportEntry => Boolean(entry));

  if (parsedEntries.length === 0) return null;

  const warnings =
    conversations.length > MAX_EXTERNAL_AI_CONVERSATIONS
      ? [`Only inspected the first ${MAX_EXTERNAL_AI_CONVERSATIONS} conversations.`]
      : [];
  for (const entry of parsedEntries) {
    const warning = buildExternalAiTruncationWarning(entry);
    if (warning) {
      warnings.push(warning);
    }
  }
  if (entries.length > 1) {
    warnings.push(
      `Detected external AI history from ${conversationsEntry.entryName}; other archive files were ignored.`,
    );
  }

  return {
    detectedKind: 'external_ai_history',
    sourceHash,
    entries: parsedEntries,
    warnings,
  };
}

function buildExternalAiConversationEntry(
  conversation: any,
  index: number,
  sourcePath: string,
): ParsedImportEntry | null {
  const title =
    typeof conversation?.title === 'string' && conversation.title.trim()
      ? conversation.title.trim()
      : `AI conversation ${index + 1}`;
  const provider = inferExternalAiProvider(conversation);
  const messages = extractExternalAiMessages(conversation);
  if (messages.length === 0) return null;
  const importedMessages = Math.min(
    messages.length,
    MAX_EXTERNAL_AI_MESSAGES_PER_CONVERSATION,
  );
  const truncatedMessages = Math.max(0, messages.length - importedMessages);

  const body = [
    `# ${title}`,
    '',
    `Source: ${provider}`,
    '',
    ...messages
      .slice(0, MAX_EXTERNAL_AI_MESSAGES_PER_CONVERSATION)
      .map((message) => `## ${message.role}\n\n${message.text}`),
  ].join('\n');

  return buildExternalAiEntry(
    `${provider}/${index + 1}-${slugify(title)}.md`,
    title,
    body,
    {
      provider,
      sourcePath,
      originalTitle: title,
      totalMessages: messages.length,
      importedMessages,
      truncatedMessages,
      messageLimit: MAX_EXTERNAL_AI_MESSAGES_PER_CONVERSATION,
    },
  );
}

function buildExternalAiTruncationWarning(entry: ParsedImportEntry): string | null {
  const totalMessages = readMetadataNumber(entry.metadata, 'totalMessages');
  const importedMessages = readMetadataNumber(entry.metadata, 'importedMessages');
  const truncatedMessages = readMetadataNumber(entry.metadata, 'truncatedMessages');
  if (!totalMessages || !importedMessages || !truncatedMessages) return null;
  return `Conversation "${entry.title}" includes ${totalMessages} messages; only the first ${importedMessages} were included in this import preview.`;
}

function inferExternalAiProvider(conversation: any): string {
  if (conversation?.mapping && typeof conversation.mapping === 'object') {
    return 'chatgpt';
  }
  if (Array.isArray(conversation?.chat_messages)) {
    return 'claude';
  }
  return 'external_ai';
}

function extractExternalAiMessages(
  conversation: any,
): Array<{ role: string; text: string }> {
  if (conversation?.mapping && typeof conversation.mapping === 'object') {
    return Object.values(conversation.mapping as Record<string, any>)
      .map((node: any) => node?.message)
      .filter(Boolean)
      .sort((a: any, b: any) => Number(a.create_time ?? 0) - Number(b.create_time ?? 0))
      .map((message: any) => ({
        role: String(message.author?.role || 'message'),
        text: extractExternalAiMessageText(message.content),
      }))
      .filter((message) => message.text.length > 0);
  }

  if (Array.isArray(conversation?.chat_messages)) {
    return conversation.chat_messages
      .map((message: any) => ({
        role: String(message.sender || message.role || 'message'),
        text: extractExternalAiMessageText(message.content ?? message.text),
      }))
      .filter((message: { text: string }) => message.text.length > 0);
  }

  return [];
}

function extractExternalAiMessageText(content: any): string {
  if (typeof content === 'string') return normalizeText(content);
  if (Array.isArray(content)) {
    return normalizeText(
      content
        .map((part: unknown) => {
          if (typeof part === 'string') return part;
          if (typeof (part as any)?.text === 'string') return (part as any).text;
          return JSON.stringify(part);
        })
        .join('\n'),
    );
  }
  if (Array.isArray(content?.parts)) {
    return normalizeText(
      content.parts
        .map((part: unknown) =>
          typeof part === 'string' ? part : JSON.stringify(part),
        )
        .join('\n'),
    );
  }
  if (typeof content?.text === 'string') return normalizeText(content.text);
  return '';
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'conversation'
  );
}

function inferTitle(path: string, text: string): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 120);
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (firstLine) return firstLine.slice(0, 120);
  return path.split('/').pop() || path;
}

function countHighRiskSignals(text: string): number {
  return countMatches(text, [
    /password/gi,
    /secret/gi,
    /private key/gi,
    /api[_ -]?key/gi,
    /token/gi,
    /密码/g,
    /密钥/g,
  ]);
}

function countProfileSignals(text: string): number {
  return countMatches(text, [
    /I prefer/gi,
    /I like/gi,
    /my preference/gi,
    /我(喜欢|偏好|习惯|通常|希望)/g,
    /用户(喜欢|偏好|习惯|通常|希望)/g,
  ]);
}

function countSkillSignals(text: string): number {
  return countMatches(text, [
    /skill/gi,
    /workflow/gi,
    /prompt/gi,
    /codex/gi,
    /openclaw/gi,
    /技能/g,
    /工作流/g,
    /提示词/g,
  ]);
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, pattern) => {
    const matches = text.match(pattern);
    return sum + (matches?.length ?? 0);
  }, 0);
}
