import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LocalSkillSyncManager } from '../skillSync/localSkillSyncManager.js';

test('LocalSkillSyncManager scans enabled platform and writes packages returned by Memory Service', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'personal-ai-local-sync-'));
  try {
    const codexRoot = path.join(root, 'codex');
    mkdirSync(path.join(codexRoot, 'existing'), { recursive: true });
    writeFileSync(
      path.join(codexRoot, 'existing', 'SKILL.md'),
      [
        '---',
        'name: existing',
        'version: v1',
        '---',
        '',
        '# Existing',
      ].join('\n'),
    );

    const calls: any[] = [];
    const memoryClient = {
      isEnabled: () => true,
      getSkillSyncSettings: async () => ({
        items: [
          {
            platform: 'codex',
            enabled: true,
            capability: 'fs_via_desktop_app',
            mode: 'Desktop App fs watcher',
          },
        ],
      }),
      syncLocalSkillPlatform: async (input: any) => {
        calls.push(input);
        return {
          status: 'succeeded',
          platform: 'codex',
          processed: 1,
          imported: 0,
          updated: 0,
          pulled: 0,
          pushed: 1,
          externalChanges: 2,
          skipped: 0,
          errors: [],
          packagesToInstall: [
            {
              slug: 'new-skill',
              title: 'new-skill',
              version: 'v1',
              skillMd: '# New Skill\n',
              files: [{ path: 'scripts/run.js', content: 'console.log("ok");\n' }],
            },
          ],
        };
      },
    };

    const manager = new LocalSkillSyncManager(memoryClient as any, [
      { platform: 'codex', root: codexRoot },
    ]);
    const result = await manager.run({ platform: 'codex' });

    assert.equal(result.status, 'succeeded');
    assert.equal(calls[0].platform, 'codex');
    assert.equal(calls[0].skills[0].slug, 'existing');
    assert.equal(calls[0].skills[0].root, codexRoot);
    assert.equal(calls[0].skills[0].directory, path.join(codexRoot, 'existing'));
    assert.equal(calls[0].skills[0].skillMdPath, path.join(codexRoot, 'existing', 'SKILL.md'));
    assert.equal(result.platforms[0].externalChanges, 2);
    assert.ok(existsSync(path.join(codexRoot, 'new-skill', 'SKILL.md')));
    assert.equal(
      readFileSync(path.join(codexRoot, 'new-skill', 'scripts', 'run.js'), 'utf8'),
      'console.log("ok");\n',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
