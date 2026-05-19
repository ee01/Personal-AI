import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type RingCentralDirectoryScope = 'users' | 'teams';
export type RingCentralDirectorySyncStatus = 'idle' | 'syncing' | 'ready' | 'error';

export interface RingCentralDirectoryUserRecord {
  entityId: string;
  displayName: string;
  email?: string;
  extensionNumber?: string;
  searchText: string;
  raw?: Record<string, unknown>;
  updatedAt: number;
}

export interface RingCentralDirectoryTeamRecord {
  chatId: string;
  name: string;
  description?: string;
  searchText: string;
  raw?: Record<string, unknown>;
  updatedAt: number;
}

export interface RingCentralDirectoryScopeState {
  scope: RingCentralDirectoryScope;
  status: RingCentralDirectorySyncStatus;
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastSuccessAt?: number;
  recordCount: number;
  lastError?: string;
}

interface SyncStateRow {
  scope: RingCentralDirectoryScope;
  status: RingCentralDirectorySyncStatus;
  last_started_at: number | null;
  last_finished_at: number | null;
  last_success_at: number | null;
  record_count: number;
  last_error: string | null;
}

interface UserRow {
  entity_id: string;
  display_name: string;
  email: string | null;
  extension_number: string | null;
  search_text: string;
  raw_json: string | null;
  updated_at: number;
}

interface TeamRow {
  chat_id: string;
  name: string;
  description: string | null;
  search_text: string;
  raw_json: string | null;
  updated_at: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function scopeTable(scope: RingCentralDirectoryScope): 'rc_directory_users' | 'rc_directory_teams' {
  return scope === 'users' ? 'rc_directory_users' : 'rc_directory_teams';
}

export class RingCentralDirectoryRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToScopeState(row: SyncStateRow): RingCentralDirectoryScopeState {
    return {
      scope: row.scope,
      status: row.status,
      lastStartedAt: row.last_started_at ?? undefined,
      lastFinishedAt: row.last_finished_at ?? undefined,
      lastSuccessAt: row.last_success_at ?? undefined,
      recordCount: row.record_count,
      lastError: row.last_error ?? undefined,
    };
  }

  private rowToUser(row: UserRow): RingCentralDirectoryUserRecord {
    return {
      entityId: row.entity_id,
      displayName: row.display_name,
      email: row.email ?? undefined,
      extensionNumber: row.extension_number ?? undefined,
      searchText: row.search_text,
      raw: safeParse(row.raw_json, {}),
      updatedAt: row.updated_at,
    };
  }

  private rowToTeam(row: TeamRow): RingCentralDirectoryTeamRecord {
    return {
      chatId: row.chat_id,
      name: row.name,
      description: row.description ?? undefined,
      searchText: row.search_text,
      raw: safeParse(row.raw_json, {}),
      updatedAt: row.updated_at,
    };
  }

  getScopeState(scope: RingCentralDirectoryScope): RingCentralDirectoryScopeState {
    const row = this.db
      .prepare(
        `SELECT scope, status, last_started_at, last_finished_at, last_success_at, record_count, last_error
         FROM rc_directory_sync_state
         WHERE scope = ?`,
      )
      .get(scope) as SyncStateRow | undefined;
    if (!row) {
      const fallback: SyncStateRow = {
        scope,
        status: 'idle',
        last_started_at: null,
        last_finished_at: null,
        last_success_at: null,
        record_count: 0,
        last_error: null,
      };
      return this.rowToScopeState(fallback);
    }
    return this.rowToScopeState(row);
  }

  listScopeStates(): RingCentralDirectoryScopeState[] {
    const rows = this.db
      .prepare(
        `SELECT scope, status, last_started_at, last_finished_at, last_success_at, record_count, last_error
         FROM rc_directory_sync_state
         ORDER BY scope ASC`,
      )
      .all() as SyncStateRow[];
    return rows.map((row) => this.rowToScopeState(row));
  }

  markScopeSyncStarted(scope: RingCentralDirectoryScope): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO rc_directory_sync_state (scope, status, last_started_at, last_finished_at, record_count, last_error)
         VALUES (?, 'syncing', ?, NULL, 0, NULL)
         ON CONFLICT(scope) DO UPDATE SET
           status = 'syncing',
           last_started_at = excluded.last_started_at,
           last_finished_at = NULL,
           last_error = NULL`,
      )
      .run(scope, ts);
  }

  markScopeSyncSuccess(scope: RingCentralDirectoryScope, recordCount: number): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO rc_directory_sync_state (scope, status, last_started_at, last_finished_at, last_success_at, record_count, last_error)
         VALUES (?, 'ready', ?, ?, ?, ?, NULL)
         ON CONFLICT(scope) DO UPDATE SET
           status = 'ready',
           last_finished_at = excluded.last_finished_at,
           last_success_at = excluded.last_success_at,
           record_count = excluded.record_count,
           last_error = NULL`,
      )
      .run(scope, ts, ts, ts, Math.max(0, Math.floor(recordCount)));
  }

  markScopeSyncError(scope: RingCentralDirectoryScope, message: string): void {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO rc_directory_sync_state (scope, status, last_started_at, last_finished_at, record_count, last_error)
         VALUES (?, 'error', ?, ?, 0, ?)
         ON CONFLICT(scope) DO UPDATE SET
           status = 'error',
           last_finished_at = excluded.last_finished_at,
           last_error = excluded.last_error`,
      )
      .run(scope, ts, ts, message.slice(0, 500));
  }

  markScopeIdle(scope: RingCentralDirectoryScope): void {
    this.db
      .prepare(
        `INSERT INTO rc_directory_sync_state (scope, status, record_count)
         VALUES (?, 'idle', 0)
         ON CONFLICT(scope) DO UPDATE SET
           status = 'idle'`,
      )
      .run(scope);
  }

  replaceUsers(users: RingCentralDirectoryUserRecord[]): number {
    const insert = this.db.prepare(
      `INSERT INTO rc_directory_users (
         entity_id, display_name, email, extension_number, search_text, raw_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const trx = this.db.transaction((items: RingCentralDirectoryUserRecord[]) => {
      this.db.prepare('DELETE FROM rc_directory_users').run();
      for (const item of items) {
        insert.run(
          item.entityId,
          item.displayName,
          item.email ?? null,
          item.extensionNumber ?? null,
          normalizeSearchText(item.searchText),
          JSON.stringify(item.raw ?? {}),
          item.updatedAt,
        );
      }
    });
    trx(users);
    return users.length;
  }

  upsertUsers(users: RingCentralDirectoryUserRecord[]): number {
    if (users.length === 0) return 0;
    const insert = this.db.prepare(
      `INSERT INTO rc_directory_users (
         entity_id, display_name, email, extension_number, search_text, raw_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_id) DO UPDATE SET
         display_name = excluded.display_name,
         email = excluded.email,
         extension_number = excluded.extension_number,
         search_text = excluded.search_text,
         raw_json = excluded.raw_json,
         updated_at = excluded.updated_at`,
    );
    const trx = this.db.transaction((items: RingCentralDirectoryUserRecord[]) => {
      for (const item of items) {
        insert.run(
          item.entityId,
          item.displayName,
          item.email ?? null,
          item.extensionNumber ?? null,
          normalizeSearchText(item.searchText),
          JSON.stringify(item.raw ?? {}),
          item.updatedAt,
        );
      }
    });
    trx(users);
    return users.length;
  }

  replaceTeams(teams: RingCentralDirectoryTeamRecord[]): number {
    const insert = this.db.prepare(
      `INSERT INTO rc_directory_teams (
         chat_id, name, description, search_text, raw_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const trx = this.db.transaction((items: RingCentralDirectoryTeamRecord[]) => {
      this.db.prepare('DELETE FROM rc_directory_teams').run();
      for (const item of items) {
        insert.run(
          item.chatId,
          item.name,
          item.description ?? null,
          normalizeSearchText(item.searchText),
          JSON.stringify(item.raw ?? {}),
          item.updatedAt,
        );
      }
    });
    trx(teams);
    return teams.length;
  }

  hasRecords(scope: RingCentralDirectoryScope): boolean {
    const table = scopeTable(scope);
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as { count: number };
    return row.count > 0;
  }

  searchUsers(query: string, limit = 20): RingCentralDirectoryUserRecord[] {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const rows = this.db
      .prepare(
        `SELECT entity_id, display_name, email, extension_number, search_text, raw_json, updated_at
         FROM rc_directory_users
         WHERE search_text LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(`%${normalized}%`, Math.max(limit, 1)) as UserRow[];
    return rows.map((row) => this.rowToUser(row));
  }

  searchTeams(query: string, limit = 20): RingCentralDirectoryTeamRecord[] {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const rows = this.db
      .prepare(
        `SELECT chat_id, name, description, search_text, raw_json, updated_at
         FROM rc_directory_teams
         WHERE search_text LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(`%${normalized}%`, Math.max(limit, 1)) as TeamRow[];
    return rows.map((row) => this.rowToTeam(row));
  }
}
