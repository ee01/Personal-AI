import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const requireFromMemoryService = createRequire(
  new URL('../memory-service/package.json', import.meta.url),
);
const AdmZip = requireFromMemoryService('adm-zip');

interface MemoryBackupManifest {
  format: string;
  formatVersion: number;
  transport: string;
  exportedAt: string;
  userId: string;
  includes: Array<{
    path: string;
    layer: 'A' | 'B' | 'C';
    sizeBytes: number;
    modifiedAt: number;
    sha256: string;
    required: boolean;
  }>;
  layers: {
    A: { paths: string[] };
    B: { paths: string[] };
    C: {
      generated: string[];
      failed: Array<{ path: string; reason: string }>;
      skipped: string[];
    };
  };
}

interface ImportResult {
  mode: 'merge' | 'replace';
  importedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  database: {
    action: 'merged' | 'replaced';
    changedRows?: number;
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
  };
  warnings: string[];
}

interface ImportPreviewResult {
  mode: 'merge' | 'replace';
  dryRun: true;
  inspectedAt: string;
  restoredLayers: Array<'A' | 'B'>;
  backup: {
    userId: string;
    exportedAt: string;
    formatVersion: number;
    includeCount: number;
    layers: {
      A: number;
      B: number;
      C: {
        generated: number;
        failed: number;
        skipped: number;
      };
    };
  };
  database: {
    action: 'would_merge' | 'would_replace';
    importedRows: number;
    tableRows: Record<string, number>;
    skippedTables: string[];
  };
  files: {
    written: number;
    overwritten: number;
    preserved: number;
    deleted: number;
    writtenPaths: string[];
    overwrittenPaths: string[];
    preservedPaths: string[];
    deletedPaths: string[];
  };
  warnings: string[];
}

const EXPECTED_DERIVED_PATHS = [
  'derived/messages/messages-overview.md',
  'derived/profile/profile-overview.md',
  'derived/timelines/entity-property-timeline.md',
  'derived/relationships/relationship-overview.md',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function parseContentDispositionFilename(
  contentDisposition: string | null,
): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function unzipArchive(zipPath: string, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await execFile('unzip', ['-q', zipPath, '-d', outputDir]);
}

function createZipWithUnmanifestedUserFile(
  sourceZipPath: string,
  targetZipPath: string,
): void {
  const zip = new AdmZip(sourceZipPath);
  zip.addFile(
    'user/unmanifested.md',
    Buffer.from('# Unmanifested\n\nThis file is not declared in manifest.json.\n'),
  );
  zip.writeZip(targetZipPath);
}

function createZipWithInvalidManifest(targetZipPath: string): void {
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from('{ this is not json'));
  zip.writeZip(targetZipPath);
}

function createZipWithUnsupportedManifestPath(targetZipPath: string): void {
  const zip = new AdmZip();
  const now = Date.now();
  const unsupportedContent = Buffer.from('console.log("not a backup markdown file");\n');
  const memoryDbContent = Buffer.from('not a sqlite database');
  const configContent = Buffer.from('{}\n');
  const manifest = {
    format: 'personal-ai-memory-backup',
    formatVersion: 1,
    transport: 'zip',
    exportedAt: new Date(now).toISOString(),
    userId: 'verify-user',
    includes: [
      {
        path: 'user/memory.db',
        layer: 'A',
        sizeBytes: memoryDbContent.byteLength,
        modifiedAt: now,
        sha256: sha256(memoryDbContent),
        required: true,
      },
      {
        path: 'user/config.json',
        layer: 'A',
        sizeBytes: configContent.byteLength,
        modifiedAt: now,
        sha256: sha256(configContent),
        required: true,
      },
      {
        path: 'user/agent/payload.js',
        layer: 'B',
        sizeBytes: unsupportedContent.byteLength,
        modifiedAt: now,
        sha256: sha256(unsupportedContent),
        required: false,
      },
    ],
    layers: {
      A: {
        paths: ['user/memory.db', 'user/config.json'],
      },
      B: {
        paths: ['user/agent/payload.js'],
      },
      C: {
        generated: [],
        failed: [],
        skipped: [],
      },
    },
  };

  zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  zip.addFile('user/memory.db', memoryDbContent);
  zip.addFile('user/config.json', configContent);
  zip.addFile('user/agent/payload.js', unsupportedContent);
  zip.writeZip(targetZipPath);
}

async function ensureOkResponse(response: Response, label: string): Promise<void> {
  if (response.ok) {
    return;
  }

  throw new Error(`${label}: ${response.status} ${await response.text()}`);
}

async function main(): Promise<void> {
  const workspaceDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'personal-ai-memory-backup-'),
  );
  const dataDir = path.join(workspaceDir, 'data');
  const exportDir = path.join(workspaceDir, 'exported');
  const extractedDir = path.join(workspaceDir, 'extracted');
  const userId = 'verify-user';

  await fs.mkdir(exportDir, { recursive: true });

  process.env.DATA_DIR = dataDir;
  process.env.LOG_LEVEL = 'error';

  const { buildApp } = await import('../memory-service/src/server.ts');
  const { app, userContextManager } = await buildApp();

  let address = '';

  try {
    address = await app.listen({ port: 0, host: '127.0.0.1' });
    const baseUrl = `${address}/api/v1`;
    const userHeaders = {
      Accept: 'application/json',
      'X-User-Id': userId,
    };

    const initialContext = userContextManager.getContext(userId);
    const userDir = initialContext.userDataManager.rootDir;
    const now = Date.now();

    initialContext.userDataManager.writeFile(
      'projects/project-alpha.md',
      '# Project Alpha\n\nThis is the exported version.\n',
    );
    initialContext.userDataManager.writeFile(
      'daily/2026-03-17.md',
      '# Daily Log\n\nBackup checkpoint.\n',
    );
    initialContext.userDataManager.writeFile(
      'reports/backup-report.md',
      '# Weekly Snapshot\n\nGenerated from backup seed.\n',
    );
    initialContext.userDataManager.writeFile(
      'entities/people/john-doe.md',
      '# John Doe\n\nEntity profile markdown.\n',
    );
    initialContext.userDataManager.writeFile(
      'skills/react.md',
      '# React\n\nSkill note markdown.\n',
    );
    initialContext.userDataManager.writeFile(
      'rehearsals/reh-alpha.md',
      '# Rehearsal Alpha\n\nRemember this during restore validation.\n',
    );
    initialContext.userDataManager.writeFile(
      'source-memory/capsule-alpha.md',
      '# Source Memory Alpha\n\nSaved source capsule markdown.\n',
    );
    initialContext.userDataManager.writeFile(
      'USER_CORE.md',
      '# User Core\n\nExported root markdown.\n',
    );
    await fs.writeFile(
      path.join(userDir, 'config.json'),
      `${JSON.stringify({ reflectionEnabled: true }, null, 2)}\n`,
      'utf-8',
    );

    initialContext.db
      .prepare(
        `INSERT OR REPLACE INTO entities (id, type, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'project-alpha',
        'Project',
        'Project Alpha',
        'Seed backup entity',
        now,
        now,
      );

    initialContext.db
      .prepare(
        `INSERT OR REPLACE INTO messages_raw (
          id, content, source_type, timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('msg-backup', 'Backup message body', 'manual', now, now, now);

    initialContext.db
      .prepare(
        `INSERT INTO entity_properties (
          entity_id, property_key, property_value, value_type, tx_start, confidence, is_final, status, action_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'project-alpha',
        'phase',
        'execution',
        'text',
        now,
        0.92,
        1,
        'active',
        'set',
      );

    const exportResponse = await fetch(`${baseUrl}/export`, {
      method: 'POST',
      headers: {
        ...userHeaders,
        Accept: 'application/zip',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'backup_zip',
      }),
    });

    await ensureOkResponse(exportResponse, 'Export failed');

    const exportArrayBuffer = await exportResponse.arrayBuffer();
    const exportBuffer = Buffer.from(exportArrayBuffer);
    const exportFileName =
      parseContentDispositionFilename(
        exportResponse.headers.get('content-disposition'),
      ) || 'personal-ai-memory-backup.zip';
    const exportFilePath = path.join(exportDir, exportFileName);
    await fs.writeFile(exportFilePath, exportBuffer);

    const exportHashBeforeImport = sha256(exportBuffer);

    await unzipArchive(exportFilePath, extractedDir);

    const manifestPath = path.join(extractedDir, 'manifest.json');
    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf-8'),
    ) as MemoryBackupManifest;

    assert(manifest.format === 'personal-ai-memory-backup', 'Unexpected backup format');
    assert(manifest.formatVersion === 1, 'Unexpected backup format version');
    assert(manifest.transport === 'zip', 'Unexpected backup transport');
    assert(manifest.userId === userId, 'Manifest userId mismatch');
    assert(await pathExists(path.join(extractedDir, 'user', 'memory.db')), 'Backup zip is missing user/memory.db');
    assert(await pathExists(path.join(extractedDir, 'user', 'config.json')), 'Backup zip is missing user/config.json');
    assert(await pathExists(path.join(extractedDir, 'user', 'projects', 'project-alpha.md')), 'Backup zip is missing exported markdown');
    assert(await pathExists(path.join(extractedDir, 'user', 'entities', 'people', 'john-doe.md')), 'Backup zip is missing entity markdown');
    assert(await pathExists(path.join(extractedDir, 'user', 'skills', 'react.md')), 'Backup zip is missing skill markdown');
    assert(await pathExists(path.join(extractedDir, 'user', 'rehearsals', 'reh-alpha.md')), 'Backup zip is missing rehearsal markdown');
    assert(await pathExists(path.join(extractedDir, 'user', 'source-memory', 'capsule-alpha.md')), 'Backup zip is missing source-memory markdown');
    assert(await pathExists(path.join(extractedDir, 'user', 'USER_CORE.md')), 'Backup zip is missing root markdown');

    for (const relativePath of EXPECTED_DERIVED_PATHS) {
      assert(await pathExists(path.join(extractedDir, relativePath)), `Backup zip is missing derived snapshot ${relativePath}`);
      assert(
        manifest.includes.some((entry) => entry.path === relativePath && entry.layer === 'C'),
        `Manifest is missing derived snapshot ${relativePath}`,
      );
    }
    assert(
      manifest.includes.some((entry) => entry.path === 'user/rehearsals/reh-alpha.md' && entry.layer === 'B'),
      'Manifest is missing rehearsal markdown as a layer B file',
    );
    assert(
      manifest.includes.some((entry) => entry.path === 'user/source-memory/capsule-alpha.md' && entry.layer === 'B'),
      'Manifest is missing source-memory markdown as a layer B file',
    );

    const messagesOverview = await fs.readFile(
      path.join(extractedDir, 'derived/messages/messages-overview.md'),
      'utf-8',
    );
    assert(messagesOverview.includes('Backup message body'), 'Derived messages snapshot is not readable');
    assert(!(await pathExists(path.join(userDir, 'derived'))), 'Export should not write derived snapshots into data/users');

    initialContext.userDataManager.writeFile(
      'projects/project-alpha.md',
      '# Project Alpha\n\nThis content only exists locally before merge.\n',
    );
    initialContext.userDataManager.writeFile(
      'reports/local-only.md',
      '# Local Only\n\nKeep this file on merge.\n',
    );
    await fs.rm(path.join(userDir, 'entities', 'people', 'john-doe.md'), {
      force: true,
    });
    initialContext.db
      .prepare(
        `INSERT OR REPLACE INTO entities (id, type, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'local-only-entity',
        'Topic',
        'Local Only Entity',
        'Should survive merge',
        now + 1,
        now + 1,
      );

    const dryRunMergeForm = new FormData();
    dryRunMergeForm.append(
      'file',
      new Blob([exportBuffer], { type: 'application/zip' }),
      exportFileName,
    );
    dryRunMergeForm.append('mode', 'merge');
    dryRunMergeForm.append('dryRun', 'true');

    const dryRunMergeResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: dryRunMergeForm,
    });

    await ensureOkResponse(dryRunMergeResponse, 'Merge import dry-run failed');
    const dryRunMergeResult = (await dryRunMergeResponse.json()) as ImportPreviewResult;

    assert(dryRunMergeResult.dryRun === true, 'Merge dry-run response should be marked dryRun');
    assert(dryRunMergeResult.mode === 'merge', 'Merge dry-run mode mismatch');
    assert(dryRunMergeResult.database.action === 'would_merge', 'Merge dry-run database action mismatch');
    assert(dryRunMergeResult.backup.userId === userId, 'Merge dry-run should report backup user');
    assert(dryRunMergeResult.backup.includeCount === manifest.includes.length, 'Merge dry-run include count mismatch');
    assert(
      dryRunMergeResult.files.overwrittenPaths.includes('projects/project-alpha.md'),
      'Merge dry-run should report overwritten project file',
    );
    assert(
      dryRunMergeResult.files.preservedPaths.includes('reports/local-only.md'),
      'Merge dry-run should report preserved local-only file',
    );
    assert(
      (dryRunMergeResult.database.tableRows.entities ?? 0) >= 1,
      'Merge dry-run should report imported entity rows',
    );
    assert(
      initialContext.userDataManager
        .readFile('projects/project-alpha.md')
        ?.includes('only exists locally before merge'),
      'Merge dry-run must not overwrite local project file',
    );
    assert(
      initialContext.userDataManager.readFile('entities/people/john-doe.md') === null,
      'Merge dry-run must not restore backup-only markdown files',
    );
    assert(
      Boolean(
        initialContext.db
          .prepare('SELECT id FROM entities WHERE id = ?')
          .get('local-only-entity'),
      ),
      'Merge dry-run must not remove local-only database rows',
    );

    const invalidModeForm = new FormData();
    invalidModeForm.append(
      'file',
      new Blob([exportBuffer], { type: 'application/zip' }),
      exportFileName,
    );
    invalidModeForm.append('mode', 'overwrite');

    const invalidModeResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: invalidModeForm,
    });
    const invalidModeBody = await invalidModeResponse.text();

    assert(invalidModeResponse.status === 400, 'Invalid import mode should be rejected');
    assert(
      invalidModeBody.includes('Import mode must be merge or replace'),
      'Invalid import mode response should explain the accepted modes',
    );

    const tamperedExportFilePath = path.join(exportDir, 'tampered-unmanifested.zip');
    createZipWithUnmanifestedUserFile(exportFilePath, tamperedExportFilePath);
    const tamperedExportBuffer = await fs.readFile(tamperedExportFilePath);
    const tamperedForm = new FormData();
    tamperedForm.append(
      'file',
      new Blob([tamperedExportBuffer], { type: 'application/zip' }),
      'tampered-unmanifested.zip',
    );
    tamperedForm.append('dryRun', 'true');

    const tamperedResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: tamperedForm,
    });
    const tamperedBody = await tamperedResponse.text();

    assert(
      tamperedResponse.status === 400,
      'Import dry-run should reject files not declared in manifest',
    );
    assert(
      tamperedBody.includes('Zip contains file not listed in manifest: user/unmanifested.md'),
      'Unmanifested file response should explain the manifest mismatch',
    );

    const invalidManifestZipPath = path.join(exportDir, 'invalid-manifest.zip');
    createZipWithInvalidManifest(invalidManifestZipPath);
    const invalidManifestBuffer = await fs.readFile(invalidManifestZipPath);
    const invalidManifestForm = new FormData();
    invalidManifestForm.append(
      'file',
      new Blob([invalidManifestBuffer], { type: 'application/zip' }),
      'invalid-manifest.zip',
    );
    invalidManifestForm.append('dryRun', 'true');

    const invalidManifestResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: invalidManifestForm,
    });
    const invalidManifestBody = await invalidManifestResponse.text();

    assert(
      invalidManifestResponse.status === 400,
      'Import dry-run should reject invalid manifest JSON with a 400',
    );
    assert(
      invalidManifestBody.includes('Backup manifest is not valid JSON'),
      'Invalid manifest response should explain the JSON parse failure',
    );

    const unsupportedManifestPathZipPath = path.join(exportDir, 'unsupported-manifest-path.zip');
    createZipWithUnsupportedManifestPath(unsupportedManifestPathZipPath);
    const unsupportedManifestPathBuffer = await fs.readFile(unsupportedManifestPathZipPath);
    const unsupportedManifestPathForm = new FormData();
    unsupportedManifestPathForm.append(
      'file',
      new Blob([unsupportedManifestPathBuffer], { type: 'application/zip' }),
      'unsupported-manifest-path.zip',
    );
    unsupportedManifestPathForm.append('dryRun', 'true');

    const unsupportedManifestPathResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: unsupportedManifestPathForm,
    });
    const unsupportedManifestPathBody = await unsupportedManifestPathResponse.text();

    assert(
      unsupportedManifestPathResponse.status === 400,
      'Import dry-run should reject manifest-listed files outside the backup contract',
    );
    assert(
      unsupportedManifestPathBody.includes('Backup manifest contains unsupported user file: user/agent/payload.js'),
      'Unsupported path response should explain the backup contract mismatch',
    );

    const mergeForm = new FormData();
    mergeForm.append(
      'file',
      new Blob([exportBuffer], { type: 'application/zip' }),
      exportFileName,
    );
    mergeForm.append('mode', 'merge');

    const mergeResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: mergeForm,
    });

    await ensureOkResponse(mergeResponse, 'Merge import failed');
    const mergeResult = (await mergeResponse.json()) as ImportResult;
    const mergeContext = userContextManager.getContext(userId);

    assert(mergeResult.mode === 'merge', 'Merge response mode mismatch');
    assert(
      mergeContext.userDataManager
        .readFile('projects/project-alpha.md')
        ?.includes('exported version'),
      'Merge should restore the exported project file content',
    );
    assert(
      mergeContext.userDataManager
        .readFile('reports/local-only.md')
        ?.includes('Keep this file on merge'),
      'Merge should preserve local-only files that are not in the backup',
    );
    assert(
      mergeContext.userDataManager
        .readFile('entities/people/john-doe.md')
        ?.includes('Entity profile markdown'),
      'Merge should restore entity markdown files from the backup',
    );
    assert(
      mergeContext.userDataManager
        .readFile('skills/react.md')
        ?.includes('Skill note markdown'),
      'Merge should restore skill markdown files from the backup',
    );
    assert(
      mergeContext.userDataManager
        .readFile('rehearsals/reh-alpha.md')
        ?.includes('Remember this during restore validation'),
      'Merge should restore rehearsal markdown files from the backup',
    );
    assert(
      mergeContext.userDataManager
        .readFile('source-memory/capsule-alpha.md')
        ?.includes('Saved source capsule markdown'),
      'Merge should restore source-memory markdown files from the backup',
    );
    assert(mergeResult.files.preserved >= 1, 'Merge should report preserved files');
    assert(
      Boolean(
        mergeContext.db
          .prepare('SELECT id FROM entities WHERE id = ?')
          .get('local-only-entity'),
      ),
      'Merge should preserve local-only database rows',
    );
    assert(
      Boolean(
        mergeContext.db
          .prepare('SELECT id FROM entities WHERE id = ?')
          .get('project-alpha'),
      ),
      'Merge should keep imported database rows readable',
    );
    assert(!(await pathExists(path.join(userDir, 'derived'))), 'Merge import should not restore derived snapshots into user data');

    mergeContext.userDataManager.writeFile(
      'reports/replace-delete-me.md',
      '# Replace Delete Me\n\nThis file must disappear after replace.\n',
    );
    mergeContext.db
      .prepare(
        `INSERT OR REPLACE INTO entities (id, type, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'replace-only-entity',
        'Topic',
        'Replace Only Entity',
        'Should disappear on replace',
        now + 2,
        now + 2,
      );

    const dryRunReplaceForm = new FormData();
    dryRunReplaceForm.append(
      'file',
      new Blob([exportBuffer], { type: 'application/zip' }),
      exportFileName,
    );
    dryRunReplaceForm.append('mode', 'replace');
    dryRunReplaceForm.append('dryRun', 'true');

    const dryRunReplaceResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: dryRunReplaceForm,
    });

    await ensureOkResponse(dryRunReplaceResponse, 'Replace import dry-run failed');
    const dryRunReplaceResult = (await dryRunReplaceResponse.json()) as ImportPreviewResult;

    assert(dryRunReplaceResult.mode === 'replace', 'Replace dry-run mode mismatch');
    assert(dryRunReplaceResult.database.action === 'would_replace', 'Replace dry-run database action mismatch');
    assert(
      dryRunReplaceResult.files.deletedPaths.includes('reports/local-only.md'),
      'Replace dry-run should report local-only file deletion',
    );
    assert(
      dryRunReplaceResult.files.deletedPaths.includes('reports/replace-delete-me.md'),
      'Replace dry-run should report newly-created file deletion',
    );
    assert(
      mergeContext.userDataManager
        .readFile('reports/replace-delete-me.md')
        ?.includes('must disappear after replace'),
      'Replace dry-run must not delete local files',
    );
    assert(
      Boolean(
        mergeContext.db
          .prepare('SELECT id FROM entities WHERE id = ?')
          .get('replace-only-entity'),
      ),
      'Replace dry-run must not delete local-only database rows',
    );

    const replaceForm = new FormData();
    replaceForm.append(
      'file',
      new Blob([exportBuffer], { type: 'application/zip' }),
      exportFileName,
    );
    replaceForm.append('mode', 'replace');

    const replaceResponse = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: userHeaders,
      body: replaceForm,
    });

    await ensureOkResponse(replaceResponse, 'Replace import failed');
    const replaceResult = (await replaceResponse.json()) as ImportResult;
    const replaceContext = userContextManager.getContext(userId);

    assert(replaceResult.mode === 'replace', 'Replace response mode mismatch');
    assert(
      replaceContext.userDataManager.readFile('reports/local-only.md') === null,
      'Replace should delete files not present in the backup',
    );
    assert(
      replaceContext.userDataManager.readFile('reports/replace-delete-me.md') === null,
      'Replace should delete newly-created local files',
    );
    assert(
      replaceContext.userDataManager
        .readFile('projects/project-alpha.md')
        ?.includes('exported version'),
      'Replace should restore the exported project file',
    );
    assert(
      replaceContext.userDataManager
        .readFile('entities/people/john-doe.md')
        ?.includes('Entity profile markdown'),
      'Replace should restore entity markdown files from the backup',
    );
    assert(
      replaceContext.userDataManager
        .readFile('skills/react.md')
        ?.includes('Skill note markdown'),
      'Replace should restore skill markdown files from the backup',
    );
    assert(
      replaceContext.userDataManager
        .readFile('rehearsals/reh-alpha.md')
        ?.includes('Remember this during restore validation'),
      'Replace should restore rehearsal markdown files from the backup',
    );
    assert(
      replaceContext.userDataManager
        .readFile('source-memory/capsule-alpha.md')
        ?.includes('Saved source capsule markdown'),
      'Replace should restore source-memory markdown files from the backup',
    );
    assert(replaceResult.files.deleted >= 1, 'Replace should report deleted files');
    assert(
      !replaceContext.db
        .prepare('SELECT id FROM entities WHERE id = ?')
        .get('replace-only-entity'),
      'Replace should remove local-only database rows',
    );
    assert(
      Boolean(
        replaceContext.db
          .prepare('SELECT id FROM entities WHERE id = ?')
          .get('project-alpha'),
      ),
      'Replace should restore backup database rows',
    );
    assert(!(await pathExists(path.join(userDir, 'derived'))), 'Replace import should not restore derived snapshots into user data');

    const exportBufferAfterImport = await fs.readFile(exportFilePath);
    const exportHashAfterImport = sha256(exportBufferAfterImport);
    assert(
      exportHashBeforeImport === exportHashAfterImport,
      'Exported zip hash changed after import flow',
    );

    const summary = {
      exportFilePath,
      exportHash: exportHashAfterImport,
      manifest: {
        includeCount: manifest.includes.length,
        derivedGenerated: manifest.layers.C.generated.length,
        derivedFailed: manifest.layers.C.failed.length,
      },
      dryRunMerge: {
        overwrittenFiles: dryRunMergeResult.files.overwritten,
        preservedFiles: dryRunMergeResult.files.preserved,
        importedRows: dryRunMergeResult.database.importedRows,
      },
      merge: {
        preservedFiles: mergeResult.files.preserved,
        overwrittenFiles: mergeResult.files.overwritten,
        databaseChangedRows: mergeResult.database.changedRows ?? 0,
      },
      dryRunReplace: {
        deletedFiles: dryRunReplaceResult.files.deleted,
        importedRows: dryRunReplaceResult.database.importedRows,
      },
      replace: {
        deletedFiles: replaceResult.files.deleted,
        writtenFiles: replaceResult.files.written,
      },
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (address) {
      await app.close();
    } else {
      await app.close();
    }
    userContextManager.closeAll();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
