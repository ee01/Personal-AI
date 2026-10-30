#!/usr/bin/env node
/**
 * Phase 1 (T3) personal-memory eval dataset export — unified event JSONL + manifests.
 *
 * Usage:
 *   cd memory-service
 *   npm run export:eval-dataset-phase1 -- \
 *     --user esone.qiu \
 *     --ssh rcadmin@10.32.56.212 \
 *     --db /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db \
 *     --user-data-dir /Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu \
 *     --phase0 evals/personal-memory-dataset/phase0-prod-esone.qiu-2026-10-30.json
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLAUSIBLE_TS_FLOOR = 1_577_836_800; // 2020-01-01 UTC
const RAW_SOURCE_TYPES = new Set(['glip', 'calendar', 'jira', 'meeting', 'web']);

export interface PersonalMemoryEvent {
  event_id: string;
  source: 'messages_raw' | 'source_memory_capsule' | 'markdown_file' | 'chunk' | 'reflection_thread';
  source_type: string;
  occurred_at: string;
  observed_at: string;
  scope: string;
  group_id: string | null;
  thread_root: string | null;
  sender: string | null;
  text: string;
  metadata: Record<string, unknown>;
  acl: { scope: string; trust_class: string | null };
  provenance: Record<string, unknown>;
  replay_seq?: number;
}

interface CliOptions {
  userId: string;
  dbPath: string;
  sshTarget: string | null;
  userDataDir: string;
  phase0Path: string;
  outBase: string;
}

interface DbLike {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    iterate: (...params: unknown[]) => IterableIterator<unknown>;
  };
  close?: () => void;
}

interface RawRow {
  id: string;
  content: string;
  summary: string | null;
  scope: string;
  source: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  metadata_json: string | null;
  trust_class: string | null;
  created_at: number;
  updated_at: number | null;
}

interface RepairAuditRow {
  action: 'discard' | 'repair';
  reason: string;
  row_id: string;
  detail?: Record<string, unknown>;
}

function parseArgs(argv: string[]): CliOptions {
  let userId = 'esone.qiu';
  let dbPath = '';
  let sshTarget: string | null = null;
  let userDataDir = '';
  let phase0Path = '';
  let outBase = path.join(__dirname, '../evals/personal-memory-dataset');

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--user' && argv[i + 1]) userId = argv[++i];
    else if (arg === '--db' && argv[i + 1]) dbPath = argv[++i];
    else if (arg === '--ssh' && argv[i + 1]) sshTarget = argv[++i];
    else if (arg === '--user-data-dir' && argv[i + 1]) userDataDir = argv[++i];
    else if (arg === '--phase0' && argv[i + 1]) phase0Path = argv[++i];
    else if (arg === '--out-base' && argv[i + 1]) outBase = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.error(
        'Usage: export-eval-dataset-phase1.mts --user <id> --db <path> [--ssh user@host] --user-data-dir <dir> --phase0 <manifest.json> [--out-base dir]',
      );
      process.exit(0);
    }
  }

  if (!dbPath || !phase0Path) {
    console.error('Missing required --db and --phase0');
    process.exit(1);
  }
  if (!userDataDir) {
    userDataDir = path.dirname(dbPath) === dbPath ? path.join(path.dirname(dbPath), '..') : path.join(path.dirname(dbPath), '..');
  }
  return { userId, dbPath, sshTarget, userDataDir, phase0Path, outBase };
}

function unixToIso(ts: number | null | undefined): string | null {
  if (ts === null || ts === undefined || !Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}


function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return { _parse_error: true };
  }
}

function metadataTimestamp(meta: Record<string, unknown>): number | null {
  const keys = [
    'creationTime',
    'createdAt',
    'postCreationTime',
    'postCreatedAt',
    'eventTime',
    'startTime',
    'timestamp',
    'modifiedTime',
  ];
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'number' && v > 0) {
      return v > 1e12 ? Math.floor(v / 1000) : v;
    }
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      const n = Number(v);
      return n > 1e12 ? Math.floor(n / 1000) : n;
    }
  }
  return null;
}

function threadRootFromMeta(meta: Record<string, unknown>, fallbackId: string): string | null {
  const root =
    (typeof meta.threadRootPostId === 'string' && meta.threadRootPostId) ||
    (typeof meta.postId === 'string' && meta.postId) ||
    fallbackId;
  return root || null;
}

function storylineKey(groupId: string | null, threadRoot: string | null, fallbackId: string): string {
  const gid = groupId && groupId.trim() ? groupId.trim() : 'unknown';
  const tr = threadRoot && threadRoot.trim() ? threadRoot.trim() : fallbackId;
  return `${gid}:${tr}`;
}

function runRemoteQuery(sshTarget: string, dbPath: string, sql: string): string {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=30', sshTarget, 'sqlite3', '-json', dbPath], {
    encoding: 'utf8',
    input: `${sql.trim()};\n`,
    maxBuffer: 256 * 1024 * 1024,
  }).trim();
}

function wrapRemote(sshTarget: string, dbPath: string): DbLike {
  const remote = {
    exec: (sql: string) => {
      const raw = runRemoteQuery(sshTarget, dbPath, sql);
      if (!raw) return [];
      return JSON.parse(raw) as unknown[];
    },
  };
  return {
    prepare(sql: string) {
      return {
        all(...params: unknown[]) {
          let bound = sql;
          for (const p of params) {
            bound = bound.replace('?', () => {
              if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
              if (p === null || p === undefined) return 'NULL';
              return String(p);
            });
          }
          return remote.exec(bound);
        },
        get(...params: unknown[]) {
          const rows = this.all(...params);
          return rows[0];
        },
        *iterate(...params: unknown[]) {
          const rows = this.all(...params);
          for (const row of rows) yield row;
        },
      };
    },
  };
}

function openDb(opts: CliOptions): DbLike {
  if (opts.sshTarget) return wrapRemote(opts.sshTarget, opts.dbPath);
  const db = new Database(opts.dbPath, { readonly: true, fileMustExist: true });
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        all: (...params: unknown[]) => stmt.all(...params) as unknown[],
        get: (...params: unknown[]) => stmt.get(...params),
        *iterate(...params: unknown[]) {
          for (const row of stmt.iterate(...params)) yield row;
        },
      };
    },
    close: () => db.close(),
  };
}

function inferSourceType(row: RawRow, meta: Record<string, unknown>): { sourceType: string | null; repairs: string[] } {
  const repairs: string[] = [];
  let st = (row.source_type ?? '').trim();
  if (st === 'g') {
    repairs.push('normalize_source_type_g_to_glip');
    st = 'glip';
  }
  if (!st) {
    const metaType = typeof meta.sourceType === 'string' ? meta.sourceType.trim() : '';
    if (metaType) {
      repairs.push('empty_source_type_from_metadata');
      st = metaType;
    } else if (row.group_id && row.group_id.trim()) {
      repairs.push('empty_source_type_inferred_glip_from_group_id');
      st = 'glip';
    } else if (/<a class='at_mention_compose'/.test(row.content)) {
      repairs.push('empty_source_type_inferred_glip_from_markup');
      st = 'glip';
    } else {
      return { sourceType: null, repairs };
    }
  }
  return { sourceType: st, repairs };
}

function resolveTimestamps(
  row: RawRow,
  meta: Record<string, unknown>,
  repairs: string[],
): { occurredUnix: number; observedUnix: number } | null {
  let occurred = row.timestamp;
  if (!occurred || occurred <= 0) {
    const fromMeta = metadataTimestamp(meta);
    if (fromMeta && fromMeta >= PLAUSIBLE_TS_FLOOR) {
      repairs.push('occurred_at_from_metadata');
      occurred = fromMeta;
    } else if (row.created_at > 0) {
      repairs.push('occurred_at_from_created_at');
      occurred = row.created_at;
    } else {
      return null;
    }
  }
  if (occurred < PLAUSIBLE_TS_FLOOR && row.created_at >= PLAUSIBLE_TS_FLOOR) {
    repairs.push('occurred_at_below_floor_replaced_with_created_at');
    occurred = row.created_at;
  }
  const observed = (row.updated_at && row.updated_at > 0 ? row.updated_at : row.created_at) || occurred;
  return { occurredUnix: occurred, observedUnix: observed };
}

function rowToEvent(row: RawRow, audit: RepairAuditRow[]): PersonalMemoryEvent | null {
  const meta = parseMetadata(row.metadata_json);
  const { sourceType, repairs: stRepairs } = inferSourceType(row, meta);
  if (!sourceType || !RAW_SOURCE_TYPES.has(sourceType)) {
    audit.push({
      action: 'discard',
      reason: 'source_type_out_of_scope_or_unrecoverable',
      row_id: row.id,
      detail: { source_type: row.source_type, inferred: sourceType },
    });
    return null;
  }
  const repairs = [...stRepairs];
  const ts = resolveTimestamps(row, meta, repairs);
  if (!ts) {
    audit.push({ action: 'discard', reason: 'missing_occurred_and_observed_time', row_id: row.id });
    return null;
  }
  const threadRoot = sourceType === 'glip' ? threadRootFromMeta(meta, row.id) : null;
  const occurredIso = unixToIso(ts.occurredUnix)!;
  const observedIso = unixToIso(ts.observedUnix)!;
  return {
    event_id: `raw:${row.id}`,
    source: 'messages_raw',
    source_type: sourceType,
    occurred_at: occurredIso,
    observed_at: observedIso,
    scope: row.scope || 'work',
    group_id: row.group_id ?? null,
    thread_root: threadRoot,
    sender: row.sender ?? null,
    text: row.content ?? '',
    metadata: {
      ...meta,
      summary: row.summary ?? undefined,
      source_url: row.source_url ?? undefined,
      source_title: row.source_title ?? undefined,
      group_name: row.group_name ?? undefined,
      source: row.source ?? undefined,
      db_timestamp: row.timestamp,
      created_at: unixToIso(row.created_at),
      updated_at: unixToIso(row.updated_at),
    },
    acl: { scope: row.scope || 'work', trust_class: row.trust_class ?? null },
    provenance: {
      tier: 'T3',
      db_table: 'messages_raw',
      db_id: row.id,
      repairs: repairs.length ? repairs : undefined,
    },
  };
}

function loadMessagesRaw(db: DbLike): RawRow[] {
  const sql = `SELECT id, content, summary, scope, source, source_type, source_url, source_title,
    sender, group_id, group_name, timestamp, metadata_json, trust_class, created_at, updated_at
    FROM messages_raw ORDER BY COALESCE(updated_at, created_at), created_at, id`;
  return db.prepare(sql).all() as RawRow[];
}

function loadCapsules(db: DbLike, audit: RepairAuditRow[]): PersonalMemoryEvent[] {
  if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='source_memory_capsules'`).get()) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT c.id, c.source_kind, c.source_url, c.source_title, c.source_host, c.summary, c.content_preview,
              c.scope, c.privacy_level, c.metadata_json, c.message_id, c.created_at, c.updated_at, c.saved_at, c.status,
              m.timestamp AS msg_timestamp, m.created_at AS msg_created_at
       FROM source_memory_capsules c
       LEFT JOIN messages_raw m ON m.id = c.message_id
       ORDER BY COALESCE(c.updated_at, c.created_at), c.id`,
    )
    .all() as Array<Record<string, unknown>>;

  const events: PersonalMemoryEvent[] = [];
  for (const r of rows) {
    const meta = parseMetadata((r.metadata_json as string) ?? null);
    const occurred =
      (r.saved_at as number) ||
      (r.created_at as number) ||
      (r.msg_timestamp as number) ||
      (r.msg_created_at as number);
    const observed = (r.updated_at as number) || occurred;
    if (!occurred || occurred <= 0) {
      audit.push({
        action: 'discard',
        reason: 'capsule_missing_timestamps',
        row_id: String(r.id),
      });
      continue;
    }
    const text = [r.summary, r.content_preview].filter(Boolean).join('\n\n');
    events.push({
      event_id: `capsule:${r.id}`,
      source: 'source_memory_capsule',
      source_type: 'source_memory',
      occurred_at: unixToIso(occurred)!,
      observed_at: unixToIso(observed > 0 ? observed : occurred)!,
      scope: (r.scope as string) || 'work',
      group_id: null,
      thread_root: null,
      sender: null,
      text,
      metadata: {
        ...meta,
        source_kind: r.source_kind,
        source_url: r.source_url,
        source_title: r.source_title,
        source_host: r.source_host,
        message_id: r.message_id,
        status: r.status,
        privacy_level: r.privacy_level,
      },
      acl: { scope: (r.scope as string) || 'work', trust_class: null },
      provenance: { tier: 'T3', db_table: 'source_memory_capsules', db_id: r.id },
    });
  }
  return events;
}

function listRemoteMarkdown(sshTarget: string, userDataDir: string): Array<{ rel: string; mtime: number }> {
  const subdirs = ['daily', 'reflection-threads', 'projects'];
  const findCmd = `cd '${userDataDir.replace(/'/g, "'\\''")}' && find ${subdirs.join(' ')} -type f -name '*.md' 2>/dev/null | while IFS= read -r f; do stat -f '%m %N' "$f"; done`;
  const out = execFileSync('ssh', ['-o', 'BatchMode=yes', sshTarget, findCmd], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const entries: Array<{ rel: string; mtime: number }> = [];
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const sp = t.indexOf(' ');
    if (sp <= 0) continue;
    const mtime = Number(t.slice(0, sp));
    const rel = t.slice(sp + 1).trim();
    if (rel) entries.push({ rel, mtime });
  }
  return entries;
}

function readRemoteFile(sshTarget: string, absPath: string): string {
  const escaped = absPath.replace(/'/g, "'\\''");
  return execFileSync('ssh', ['-o', 'BatchMode=yes', sshTarget, `cat '${escaped}'`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function loadMarkdownEvents(opts: CliOptions): PersonalMemoryEvent[] {
  const subdirs = ['daily', 'reflection-threads', 'projects'];
  const events: PersonalMemoryEvent[] = [];

  const ingestFile = (relPath: string, text: string, mtimeSec: number) => {
    const kind = relPath.startsWith('daily/')
      ? 'markdown_daily'
      : relPath.startsWith('reflection-threads/')
        ? 'markdown_reflection_thread'
        : 'markdown_project';
    const iso = unixToIso(mtimeSec)!;
    const id = createHash('sha256').update(relPath).digest('hex').slice(0, 32);
    events.push({
      event_id: `md:${id}`,
      source: 'markdown_file',
      source_type: kind,
      occurred_at: iso,
      observed_at: iso,
      scope: 'work',
      group_id: null,
      thread_root: null,
      sender: null,
      text,
      metadata: { relative_path: relPath, byte_length: Buffer.byteLength(text, 'utf8') },
      acl: { scope: 'work', trust_class: null },
      provenance: { tier: 'T3', origin: 'user_data_markdown', path: relPath },
    });
  };

  if (opts.sshTarget) {
    for (const { rel, mtime } of listRemoteMarkdown(opts.sshTarget, opts.userDataDir)) {
      const abs = path.posix.join(opts.userDataDir, rel);
      try {
        ingestFile(rel, readRemoteFile(opts.sshTarget, abs), mtime);
      } catch (err) {
        console.error(`WARN markdown skip ${rel}:`, (err as Error).message);
      }
    }
    return events;
  }

  for (const sub of subdirs) {
    const root = path.join(opts.userDataDir, sub);
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, ent.name);
        if (ent.isDirectory()) stack.push(p);
        else if (ent.isFile() && ent.name.endsWith('.md')) {
          const rel = path.relative(opts.userDataDir, p).split(path.sep).join('/');
          const st = fs.statSync(p);
          ingestFile(rel, fs.readFileSync(p, 'utf8'), Math.floor(st.mtimeMs / 1000));
        }
      }
    }
  }
  return events;
}

function loadDerivedChunks(db: DbLike, audit: RepairAuditRow[]): PersonalMemoryEvent[] {
  if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='chunks'`).get()) return [];
  const rows = db
    .prepare(
      `SELECT ch.chunk_id, ch.content, ch.source_type, ch.related_entity_id, ch.file_path, ch.line_start, ch.line_end,
              ch.scope, ch.source, ch.created_at, ch.updated_at, ch.superseded_by, ch.merged_into,
              m.timestamp AS msg_timestamp, m.created_at AS msg_created_at
       FROM chunks ch
       LEFT JOIN messages_raw m ON m.id = ch.related_entity_id
       ORDER BY COALESCE(ch.updated_at, ch.created_at), ch.chunk_id`,
    )
    .all() as Array<Record<string, unknown>>;

  const events: PersonalMemoryEvent[] = [];
  for (const r of rows) {
    const occurred =
      (r.created_at as number) ||
      (r.msg_timestamp as number) ||
      (r.msg_created_at as number);
    const observed = (r.updated_at as number) || occurred;
    if (!occurred || occurred <= 0) {
      audit.push({
        action: 'discard',
        reason: 'chunk_missing_timestamps',
        row_id: String(r.chunk_id),
      });
      continue;
    }
    events.push({
      event_id: `chunk:${r.chunk_id}`,
      source: 'chunk',
      source_type: (r.source_type as string) || 'chunk_unknown',
      occurred_at: unixToIso(occurred)!,
      observed_at: unixToIso(observed > 0 ? observed : occurred)!,
      scope: (r.scope as string) || 'work',
      group_id: null,
      thread_root: null,
      sender: null,
      text: (r.content as string) || '',
      metadata: {
        file_path: r.file_path,
        line_start: r.line_start,
        line_end: r.line_end,
        related_entity_id: r.related_entity_id,
        source: r.source,
        superseded_by: r.superseded_by,
        merged_into: r.merged_into,
      },
      acl: { scope: (r.scope as string) || 'work', trust_class: null },
      provenance: {
        tier: 'T3',
        db_table: 'chunks',
        db_id: String(r.chunk_id),
        derived: true,
      },
    });
  }
  return events;
}

function loadDerivedReflectionThreads(db: DbLike): PersonalMemoryEvent[] {
  if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='reflection_threads'`).get()) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT id, topic_key, title, status, latest_summary, latest_markdown_path, source_type, source_ref_id,
              metadata_json, created_at, updated_at, reflection_count
       FROM reflection_threads ORDER BY COALESCE(updated_at, created_at), id`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const meta = parseMetadata((r.metadata_json as string) ?? null);
    const occurred = (r.created_at as number) || 0;
    const observed = (r.updated_at as number) || occurred;
    const text = [r.title, r.latest_summary].filter(Boolean).join('\n\n');
    return {
      event_id: `reflection:${r.id}`,
      source: 'reflection_thread' as const,
      source_type: 'reflection_thread',
      occurred_at: unixToIso(occurred)!,
      observed_at: unixToIso(observed > 0 ? observed : occurred)!,
      scope: 'work',
      group_id: null,
      thread_root: null,
      sender: null,
      text,
      metadata: {
        ...meta,
        topic_key: r.topic_key,
        status: r.status,
        latest_markdown_path: r.latest_markdown_path,
        source_ref_id: r.source_ref_id,
        reflection_count: r.reflection_count,
      },
      acl: { scope: 'work', trust_class: null },
      provenance: {
        tier: 'T3',
        db_table: 'reflection_threads',
        db_id: r.id,
        derived: true,
      },
    };
  });
}

function assignReplaySeq(events: PersonalMemoryEvent[]): void {
  events.sort((a, b) => {
    const oa = (a.observed_at ?? '').localeCompare(b.observed_at ?? '');
    if (oa !== 0) return oa;
    return a.event_id.localeCompare(b.event_id);
  });
  events.forEach((e, i) => {
    e.replay_seq = i + 1;
  });
}

function sha256File(filePath: string): string {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const fd = fs.openSync(filePath, 'w');
  try {
    for (const row of rows) {
      fs.writeSync(fd, `${JSON.stringify(row)}\n`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function buildStorylineIndex(events: PersonalMemoryEvent[]) {
  const def =
    'group_id : coalesce(metadata.threadRootPostId, metadata.postId, messages_raw.id) — glip raw events only';
  const map = new Map<string, { count: number; min_occurred: string; max_occurred: string; event_ids: string[] }>();
  for (const ev of events) {
    if (ev.source !== 'messages_raw' || ev.source_type !== 'glip') continue;
    const key = storylineKey(ev.group_id, ev.thread_root, ev.event_id.replace(/^raw:/, ''));
    let row = map.get(key);
    if (!row) {
      row = { count: 0, min_occurred: ev.occurred_at, max_occurred: ev.occurred_at, event_ids: [] };
      map.set(key, row);
    }
    row.count++;
    if (ev.occurred_at < row.min_occurred) row.min_occurred = ev.occurred_at;
    if (ev.occurred_at > row.max_occurred) row.max_occurred = ev.occurred_at;
    if (row.event_ids.length < 5) row.event_ids.push(ev.event_id);
  }
  const storylines = [...map.entries()]
    .map(([storyline_key, v]) => ({
      storyline_key,
      message_count: v.count,
      min_occurred_at: v.min_occurred,
      max_occurred_at: v.max_occurred,
      sample_event_ids: v.event_ids,
      tags: [
        ...(v.count >= 2 ? ['ge2'] : []),
        ...(v.count >= 5 ? ['ge5'] : []),
        ...(v.count >= 10 ? ['ge10'] : []),
      ],
    }))
    .sort((a, b) => b.message_count - a.message_count);

  const ge2 = storylines.filter((s) => s.message_count >= 2).length;
  const ge5 = storylines.filter((s) => s.message_count >= 5).length;
  const ge10 = storylines.filter((s) => s.message_count >= 10).length;

  return {
    definition: def,
    totals: {
      storylines: storylines.length,
      with_at_least_2: ge2,
      with_at_least_5: ge5,
      with_at_least_10: ge10,
    },
    storylines,
  };
}

function writeReport(
  reportPath: string,
  manifestId: string,
  events: PersonalMemoryEvent[],
  audit: RepairAuditRow[],
  phase0: Record<string, unknown>,
  hashes: Record<string, string>,
): void {
  const bySource = new Map<string, number>();
  for (const e of events) {
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
  }
  const occurred = events.map((e) => e.occurred_at).sort();
  const discards = audit.filter((a) => a.action === 'discard');
  const repairs = audit.filter((a) => a.action === 'repair');

  const lines = [
    `# Phase 1 export report — \`${manifestId}\``,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scale',
    '',
    `- Total events: **${events.length}**`,
    `- Time span (occurred_at): ${occurred[0] ?? 'n/a'} → ${occurred[occurred.length - 1] ?? 'n/a'}`,
    '',
    '### By source',
    '',
    ...[...bySource.entries()].map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '## Phase 0 reference',
    '',
    `- Database sha256 (T0): ${(phase0.database as { sha256?: string })?.sha256 ?? 'n/a'}`,
    `- T0 capturedAt: ${phase0.capturedAt ?? 'n/a'}`,
    '',
    '## Content hashes (this manifest)',
    '',
    ...Object.entries(hashes).map(([f, h]) => `- \`${f}\`: \`${h}\``),
    '',
    '## Repair / discard rules',
    '',
    '| Case | Action |',
    '|------|--------|',
    '| `source_type` empty | Infer glip from group_id / markup / metadata.sourceType; else **discard** |',
    '| `source_type=g` | Normalize to **glip** |',
    '| `timestamp=0` | metadata time fields → **created_at**; still missing → **discard** |',
    '| occurred below 2020 floor | Replace with **created_at** when plausible |',
    '',
    `- Discarded rows: **${discards.length}**`,
    `- Explicit repair audit rows: **${repairs.length}** (repairs also recorded in event provenance.repairs)`,
    '',
    '## Virtual clock replay',
    '',
    'Events sorted by `(observed_at, event_id)`; field `replay_seq` is 1-based visibility order (late updates use `updated_at` as observed_at).',
    '',
    '## Known issues',
    '',
    '- Production DB migration **066** (see Phase 0): no `origin_class` / promotion columns on messages_raw.',
    '- Empty `source_type` rows (868) share `timestamp=0`; recovered as glip when group/markup allows, remainder discarded.',
    '- Markdown `projects/` empty on prod at export time; daily + reflection-threads exported via SSH.',
    '',
  ];
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
}

async function exportManifest(
  manifestId: 'raw-only' | 'include-derived',
  opts: CliOptions,
  db: DbLike,
  phase0: Record<string, unknown>,
): Promise<void> {
  const outDir = path.join(opts.outBase, manifestId);
  fs.mkdirSync(outDir, { recursive: true });

  const audit: RepairAuditRow[] = [];
  const rawRows = loadMessagesRaw(db);
  const rawEvents: PersonalMemoryEvent[] = [];
  for (const row of rawRows) {
    const ev = rowToEvent(row, audit);
    if (ev) rawEvents.push(ev);
  }

  let events = [...rawEvents, ...loadCapsules(db, audit), ...loadMarkdownEvents(opts)];
  if (manifestId === 'include-derived') {
    events = events.concat(loadDerivedChunks(db, audit), loadDerivedReflectionThreads(db));
  }

  assignReplaySeq(events);

  const eventsPath = path.join(outDir, 'events.jsonl');
  writeJsonl(eventsPath, events);

  const storyline = buildStorylineIndex(events);
  const storylinePath = path.join(outDir, 'storyline-index.json');
  fs.writeFileSync(storylinePath, `${JSON.stringify(storyline, null, 2)}\n`, 'utf8');

  const auditPath = path.join(outDir, 'repair-audit.jsonl');
  writeJsonl(auditPath, audit);

  const hashes: Record<string, string> = {
    'events.jsonl': sha256File(eventsPath),
    'storyline-index.json': sha256File(storylinePath),
  };

  const manifest = {
    phase: 'T1-export',
    manifestId,
    tier: 'T3',
    capturedAt: new Date().toISOString(),
    userId: opts.userId,
    phase0Manifest: path.basename(opts.phase0Path),
    database: {
      path: opts.dbPath,
      sshTarget: opts.sshTarget,
      userDataDir: opts.userDataDir,
    },
    files: {
      events: 'events.jsonl',
      storylineIndex: 'storyline-index.json',
      repairAudit: 'repair-audit.jsonl',
      report: 'REPORT.md',
    },
    counts: {
      events: events.length,
      raw_messages: rawEvents.length,
      discarded_messages: audit.filter((a) => a.action === 'discard').length,
      capsules: events.filter((e) => e.source === 'source_memory_capsule').length,
      markdown_files: events.filter((e) => e.source === 'markdown_file').length,
      derived_chunks: events.filter((e) => e.source === 'chunk').length,
      derived_reflection_threads: events.filter((e) => e.source === 'reflection_thread').length,
    },
    storylineTotals: storyline.totals,
    contentHashes: hashes,
    replayOrdering: 'observed_at asc, event_id asc',
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'content-hashes.json'), `${JSON.stringify(hashes, null, 2)}\n`, 'utf8');
  writeReport(path.join(outDir, 'REPORT.md'), manifestId, events, audit, phase0, hashes);

  console.error(`[${manifestId}] wrote ${events.length} events → ${eventsPath}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const phase0 = JSON.parse(fs.readFileSync(opts.phase0Path, 'utf8')) as Record<string, unknown>;
  const db = openDb(opts);
  try {
    await exportManifest('raw-only', opts, db, phase0);
    await exportManifest('include-derived', opts, db, phase0);
  } finally {
    db.close?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
