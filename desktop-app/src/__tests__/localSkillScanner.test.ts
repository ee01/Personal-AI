import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  decideSkillSync,
  scanLocalSkillDirectories,
  writeLocalSkillPackage,
} from '../skillSync/localSkillScanner.js';

test('scanLocalSkillDirectories reads SKILL.md packages from configured platform roots', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'personal-ai-skills-'));
  try {
    const codexRoot = path.join(root, 'codex');
    const claudeRoot = path.join(root, 'claude');
    mkdirSync(path.join(codexRoot, 'meeting-prep'), { recursive: true });
    mkdirSync(path.join(codexRoot, 'not-a-skill'), { recursive: true });
    mkdirSync(path.join(claudeRoot, 'research-scout'), { recursive: true });

    writeFileSync(
      path.join(codexRoot, 'meeting-prep', 'SKILL.md'),
      [
        '---',
        'name: meeting-prep',
        'description: Build meeting briefs from prior context',
        '---',
        '',
        '# Meeting Prep',
      ].join('\n'),
    );
    mkdirSync(path.join(codexRoot, 'meeting-prep', 'scripts'), { recursive: true });
    writeFileSync(
      path.join(codexRoot, 'meeting-prep', 'scripts', 'brief.py'),
      'print("brief")\n',
    );
    writeFileSync(
      path.join(claudeRoot, 'research-scout', 'SKILL.md'),
      '# Research Scout\n\nUse when collecting sources.',
    );

    const records = scanLocalSkillDirectories([
      { platform: 'codex', root: codexRoot },
      { platform: 'claude_code', root: claudeRoot },
      { platform: 'cursor', root: path.join(root, 'missing') },
    ]);

    assert.equal(records.length, 2);
    assert.equal(records[0]?.platform, 'claude_code');
    assert.equal(records[0]?.slug, 'research-scout');
    assert.equal(records[0]?.title, 'research-scout');
    assert.equal(records[1]?.platform, 'codex');
    assert.equal(records[1]?.slug, 'meeting-prep');
    assert.equal(records[1]?.description, 'Build meeting briefs from prior context');
    assert.equal(records[1]?.files[0]?.path, 'scripts/brief.py');
    assert.match(records[1]?.sha256 || '', /^[a-f0-9]{64}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeLocalSkillPackage installs SKILL.md and resources under the platform root', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'personal-ai-skill-write-'));
  try {
    const record = writeLocalSkillPackage(root, {
      slug: 'meeting-prep',
      title: 'meeting-prep',
      version: 'v1',
      skillMd: [
        '---',
        'name: meeting-prep',
        'version: v1',
        '---',
        '',
        '# Meeting Prep',
      ].join('\n'),
      files: [
        {
          path: 'scripts/brief.py',
          content: 'print("brief")\n',
        },
      ],
    });

    assert.equal(record.slug, 'meeting-prep');
    assert.equal(record.version, 'v1');
    assert.ok(existsSync(path.join(root, 'meeting-prep', 'SKILL.md')));
    assert.equal(
      readFileSync(path.join(root, 'meeting-prep', 'scripts', 'brief.py'), 'utf8'),
      'print("brief")\n',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('decideSkillSync maps hashes, mtimes, and versions to MVP conflict policy', () => {
  const source = {
    version: '1.2.0',
    updatedAt: 1_000,
    sha256: 'source-hash',
  };

  assert.deepEqual(decideSkillSync(source), {
    action: 'install',
    reason: 'missing',
  });
  assert.deepEqual(decideSkillSync(source, { sha256: 'source-hash' }), {
    action: 'noop',
    reason: 'hash_match',
  });
  assert.deepEqual(
    decideSkillSync(source, { version: '1.2.0', sha256: 'remote-hash', mtime: 1_100 }),
    {
      action: 'external_change',
      reason: 'same_version_remote_newer',
    },
  );
  assert.deepEqual(
    decideSkillSync(source, { version: '1.1.0', sha256: 'remote-hash', mtime: 900 }),
    {
      action: 'install',
      reason: 'remote_outdated',
    },
  );
  assert.deepEqual(
    decideSkillSync(source, { version: '1.1.0', sha256: 'remote-hash', mtime: 1_100 }),
    {
      action: 'conflict',
      reason: 'remote_outdated_but_newer_mtime',
    },
  );
  assert.deepEqual(
    decideSkillSync(source, { version: '1.3.0', sha256: 'remote-hash', mtime: 900 }),
    {
      action: 'conflict',
      reason: 'remote_newer_version',
    },
  );
});
