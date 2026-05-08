import os from 'node:os';
import path from 'node:path';

import type { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import {
  scanLocalSkillDirectories,
  writeLocalSkillPackage,
  type LocalSkillDirectory,
} from './localSkillScanner.js';

export interface LocalSkillSyncRunOptions {
  platform?: string;
}

export interface LocalSkillSyncPlatformResult {
  platform: string;
  root?: string;
  status: 'succeeded' | 'skipped' | 'failed' | 'partial_failed';
  scanned: number;
  imported: number;
  pulled: number;
  pushed: number;
  skipped: number;
  errors: Array<{ slug?: string; error: string }>;
}

export interface LocalSkillSyncRunResult {
  status: 'succeeded' | 'partial_failed' | 'skipped';
  platforms: LocalSkillSyncPlatformResult[];
}

const LOCAL_SKILL_PLATFORMS = new Set(['codex', 'claude_code', 'cursor']);

function homePath(...parts: string[]): string {
  return path.join(os.homedir(), ...parts);
}

export function defaultLocalSkillDirectories(
  env: NodeJS.ProcessEnv = process.env,
): LocalSkillDirectory[] {
  const codexHome = env.CODEX_HOME || homePath('.codex');
  return [
    {
      platform: 'codex',
      root: env.CODEX_SKILLS_DIR || path.join(codexHome, 'skills'),
    },
    {
      platform: 'claude_code',
      root: env.CLAUDE_CODE_SKILLS_DIR || homePath('.claude', 'skills'),
    },
    {
      platform: 'cursor',
      root:
        env.CURSOR_SKILLS_DIR ||
        homePath('Library', 'Application Support', 'Cursor', 'User', 'skills'),
    },
  ];
}

export class LocalSkillSyncManager {
  private running = false;

  constructor(
    private readonly memoryClient: BridgeMemoryServiceClient,
    private readonly directories = defaultLocalSkillDirectories(),
  ) {}

  async tick(): Promise<void> {
    if (this.running || !this.memoryClient.isEnabled()) return;
    this.running = true;
    try {
      await this.run();
    } catch (error) {
      console.error('[desktop-app] local skill sync failed:', error);
    } finally {
      this.running = false;
    }
  }

  async run(options: LocalSkillSyncRunOptions = {}): Promise<LocalSkillSyncRunResult> {
    const settings = await this.memoryClient.getSkillSyncSettings();
    const enabledPlatforms = new Set(
      settings.items
        .filter(
          (setting) =>
            setting.enabled &&
            setting.capability === 'fs_via_desktop_app' &&
            LOCAL_SKILL_PLATFORMS.has(setting.platform),
        )
        .map((setting) => setting.platform),
    );
    const targetPlatforms = options.platform
      ? [options.platform]
      : Array.from(enabledPlatforms);

    const platforms: LocalSkillSyncPlatformResult[] = [];
    for (const platform of targetPlatforms) {
      const directory = this.directories.find((item) => item.platform === platform);
      if (!directory || !enabledPlatforms.has(platform)) {
        platforms.push({
          platform,
          root: directory?.root,
          status: 'skipped',
          scanned: 0,
          imported: 0,
          pulled: 0,
          pushed: 0,
          skipped: 0,
          errors: [],
        });
        continue;
      }

      try {
        const records = scanLocalSkillDirectories([directory]);
        const response = await this.memoryClient.syncLocalSkillPlatform({
          platform,
          skills: records.map((record) => ({
            slug: record.slug,
            title: record.title,
            description: record.description,
            version: record.version,
            sha256: record.sha256,
            mtime: record.mtime,
            skillMd: record.skillMd,
            files: record.files,
          })),
        });
        const writeErrors: Array<{ slug?: string; error: string }> = [];
        for (const pkg of response.packagesToInstall || []) {
          try {
            writeLocalSkillPackage(directory.root, pkg);
          } catch (error) {
            writeErrors.push({
              slug: pkg.slug,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        const errors = [...(response.errors || []), ...writeErrors];
        platforms.push({
          platform,
          root: directory.root,
          status: errors.length > 0 ? 'partial_failed' : 'succeeded',
          scanned: records.length,
          imported: response.imported,
          pulled: response.pulled,
          pushed: response.pushed,
          skipped: response.skipped,
          errors,
        });
      } catch (error) {
        platforms.push({
          platform,
          root: directory.root,
          status: 'failed',
          scanned: 0,
          imported: 0,
          pulled: 0,
          pushed: 0,
          skipped: 0,
          errors: [{ error: error instanceof Error ? error.message : String(error) }],
        });
      }
    }

    if (platforms.length === 0 || platforms.every((item) => item.status === 'skipped')) {
      return { status: 'skipped', platforms };
    }
    if (platforms.some((item) => item.status === 'failed' || item.status === 'partial_failed')) {
      return { status: 'partial_failed', platforms };
    }
    return { status: 'succeeded', platforms };
  }
}
