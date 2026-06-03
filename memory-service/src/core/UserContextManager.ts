import fs from 'node:fs';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { Database } from '../storage/Database.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { ProfileManager } from './ProfileManager.js';
import { assertValidUserId, isValidUserId } from '../utils/userIdentity.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserContext {
  userId: string;
  db: BetterSqlite3.Database;
  database: Database;
  userDataManager: UserDataManager;
  profileManager: ProfileManager;
  lastAccessedAt: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// UserContextManager
// ---------------------------------------------------------------------------

/**
 * Lazily creates and caches per-user storage contexts.
 *
 * Each user gets:
 *  - Their own SQLite database  ({usersBaseDir}/{userId}/memory.db)
 *  - Their own Markdown directory ({usersBaseDir}/{userId}/…)
 *  - A ProfileManager seeded with default agent profiles
 *
 * Idle contexts (no access within `maxIdleMs`) are automatically evicted
 * and their database connections closed.
 */
export class UserContextManager {
  private contexts = new Map<string, UserContext>();
  private usersBaseDir: string;
  private maxIdleMs: number;
  private evictTimer: NodeJS.Timeout | null = null;

  constructor(baseDataDir: string, maxIdleMs = 30 * 60 * 1000) {
    this.usersBaseDir = path.join(baseDataDir, 'users');
    this.maxIdleMs = maxIdleMs;

    // Ensure base directory exists
    if (!fs.existsSync(this.usersBaseDir)) {
      fs.mkdirSync(this.usersBaseDir, { recursive: true });
    }

    // Evict idle contexts every 5 minutes
    this.evictTimer = setInterval(() => this.evictIdle(), 5 * 60 * 1000);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Get (or lazily create) the UserContext for a given userId.
   * Bumps `lastAccessedAt` on every access so the eviction timer stays fresh.
   */
  getContext(userId: string): UserContext {
    const normalizedUserId = assertValidUserId(userId);
    const existing = this.contexts.get(normalizedUserId);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing;
    }
    return this.createContext(normalizedUserId);
  }

  /**
   * Scan the filesystem for all user directories that have been created.
   * Useful for batch operations that need to iterate every user.
   */
  getRegisteredUserIds(): string[] {
    if (!fs.existsSync(this.usersBaseDir)) return [];
    return fs
      .readdirSync(this.usersBaseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter(isValidUserId);
  }

  /**
   * Return all currently-loaded (in-memory) user contexts.
   */
  getActiveContexts(): UserContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Close and remove a single cached context so it can be recreated on demand.
   */
  resetContext(userId: string): void {
    const ctx = this.contexts.get(userId);
    if (!ctx) {
      return;
    }

    try {
      ctx.database.close();
    } catch {
      // best-effort
    }

    this.contexts.delete(userId);
  }

  /**
   * Gracefully close every open database and clear all cached contexts.
   * Must be called on process shutdown.
   */
  closeAll(): void {
    if (this.evictTimer) {
      clearInterval(this.evictTimer);
      this.evictTimer = null;
    }
    for (const [, ctx] of this.contexts) {
      try {
        ctx.database.close();
      } catch {
        // best-effort
      }
    }
    this.contexts.clear();
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private createContext(userId: string): UserContext {
    const userDir = path.join(this.usersBaseDir, userId);

    // Create Database wrapper (handles dir creation, WAL, migrations)
    const database = new Database({ dataDir: userDir });
    database.migrate();
    const db = database.raw;

    // Create UserDataManager for this user's markdown directory
    const userDataManager = new UserDataManager();
    userDataManager.initialize(userDir);

    // Create ProfileManager and ensure seed profiles exist
    const profileManager = new ProfileManager(db);
    profileManager.ensureSeedProfiles();

    const ctx: UserContext = {
      userId,
      db,
      database,
      userDataManager,
      profileManager,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };

    this.contexts.set(userId, ctx);
    return ctx;
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [userId, ctx] of this.contexts) {
      if (now - ctx.lastAccessedAt > this.maxIdleMs) {
        try {
          ctx.database.close();
        } catch {
          // best-effort
        }
        this.contexts.delete(userId);
      }
    }
  }
}
