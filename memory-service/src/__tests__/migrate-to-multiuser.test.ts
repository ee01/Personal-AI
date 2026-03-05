import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { migrateToMultiUser } from '../../scripts/migrate-to-multiuser.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
}

describe('migrate-to-multiuser', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('moves markdown files and directories into users/{userId}/', () => {
    // Setup: simulate existing single-tenant data
    fs.writeFileSync(path.join(dataDir, 'CORE_MEMORY.md'), '# Core Memory\nUser data');
    fs.writeFileSync(path.join(dataDir, 'WATCHED_PROJECTS.md'), '# Watched');
    fs.mkdirSync(path.join(dataDir, 'daily'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'daily', '2026-02-24.md'), '- test entry');
    fs.mkdirSync(path.join(dataDir, 'entities', 'people'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'entities', 'people', 'john.md'), '# John');
    fs.mkdirSync(path.join(dataDir, 'dreams'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'reflections'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'projects'), { recursive: true });

    const result = migrateToMultiUser({ dataDir, userId: 'default', dryRun: false });

    // Verify items were moved
    expect(result.moved).toContain('CORE_MEMORY.md');
    expect(result.moved).toContain('WATCHED_PROJECTS.md');
    expect(result.moved).toContain('daily');
    expect(result.moved).toContain('entities');
    expect(result.moved).toContain('dreams');
    expect(result.moved).toContain('reflections');
    expect(result.moved).toContain('skills');
    expect(result.moved).toContain('projects');

    // Verify files exist at new location
    const target = path.join(dataDir, 'users', 'default');
    expect(fs.existsSync(path.join(target, 'CORE_MEMORY.md'))).toBe(true);
    expect(fs.readFileSync(path.join(target, 'CORE_MEMORY.md'), 'utf-8')).toContain('User data');
    expect(fs.existsSync(path.join(target, 'WATCHED_PROJECTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'daily', '2026-02-24.md'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'entities', 'people', 'john.md'))).toBe(true);

    // Verify items no longer exist at top level
    expect(fs.existsSync(path.join(dataDir, 'CORE_MEMORY.md'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'WATCHED_PROJECTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'daily'))).toBe(false);
  });

  it('moves memory.db if it exists', () => {
    fs.writeFileSync(path.join(dataDir, 'memory.db'), 'fake-db-content');

    const result = migrateToMultiUser({ dataDir, userId: 'default', dryRun: false });

    expect(result.moved).toContain('memory.db');
    expect(fs.existsSync(path.join(dataDir, 'users', 'default', 'memory.db'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'memory.db'))).toBe(false);
  });

  it('dry-run mode does not move files', () => {
    fs.writeFileSync(path.join(dataDir, 'CORE_MEMORY.md'), '# Core');
    fs.mkdirSync(path.join(dataDir, 'daily'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'daily', '2026-01-01.md'), 'log');

    const result = migrateToMultiUser({ dataDir, userId: 'default', dryRun: true });

    expect(result.moved).toContain('CORE_MEMORY.md');
    expect(result.moved).toContain('daily');
    // Files should still be at the original location
    expect(fs.existsSync(path.join(dataDir, 'CORE_MEMORY.md'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'daily', '2026-01-01.md'))).toBe(true);
  });

  it('detects already-migrated state', () => {
    // Setup: only users/default exists, no top-level user data
    fs.mkdirSync(path.join(dataDir, 'users', 'default'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'users', 'default', 'CORE_MEMORY.md'), '# Core');

    const result = migrateToMultiUser({ dataDir, userId: 'default', dryRun: false });

    expect(result.alreadyMigrated).toBe(true);
    expect(result.moved).toHaveLength(0);
  });

  it('skips non-existent items gracefully', () => {
    // Only create one file, everything else should be skipped
    fs.writeFileSync(path.join(dataDir, 'CORE_MEMORY.md'), '# Core');

    const result = migrateToMultiUser({ dataDir, userId: 'myuser', dryRun: false });

    expect(result.moved).toContain('CORE_MEMORY.md');
    expect(result.skipped).toContain('WATCHED_PROJECTS.md');
    expect(result.skipped).toContain('memory.db');
    expect(fs.existsSync(path.join(dataDir, 'users', 'myuser', 'CORE_MEMORY.md'))).toBe(true);
  });

  it('supports custom user ID', () => {
    fs.writeFileSync(path.join(dataDir, 'CORE_MEMORY.md'), '# Core');

    const result = migrateToMultiUser({ dataDir, userId: 'john.doe', dryRun: false });

    expect(result.moved).toContain('CORE_MEMORY.md');
    expect(fs.existsSync(path.join(dataDir, 'users', 'john.doe', 'CORE_MEMORY.md'))).toBe(true);
  });

  it('handles non-existent data directory', () => {
    const nonExistent = path.join(dataDir, 'does-not-exist');

    const result = migrateToMultiUser({ dataDir: nonExistent, userId: 'default', dryRun: false });

    expect(result.moved).toHaveLength(0);
    expect(result.alreadyMigrated).toBe(false);
  });

  it('merges when target exists but top-level data also present', () => {
    // Target already has some data
    fs.mkdirSync(path.join(dataDir, 'users', 'default'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'users', 'default', 'CORE_MEMORY.md'),
      '# Existing core',
    );

    // Top-level has data too
    fs.writeFileSync(path.join(dataDir, 'CORE_MEMORY.md'), '# Old core');
    fs.writeFileSync(path.join(dataDir, 'WATCHED_PROJECTS.md'), '# Watched');

    const result = migrateToMultiUser({ dataDir, userId: 'default', dryRun: false });

    // CORE_MEMORY.md should be skipped (already exists at dest)
    expect(result.skipped).toContain('CORE_MEMORY.md');
    // WATCHED_PROJECTS.md should be moved
    expect(result.moved).toContain('WATCHED_PROJECTS.md');
    // Original CORE_MEMORY.md in target should be preserved
    expect(
      fs.readFileSync(path.join(dataDir, 'users', 'default', 'CORE_MEMORY.md'), 'utf-8'),
    ).toContain('Existing core');
  });
});
