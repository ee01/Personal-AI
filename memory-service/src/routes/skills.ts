import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UserContextManager } from '../core/UserContextManager.js';
import {
  hashSkillFilesystemPackage,
  normalizeSkillSlug,
  SkillLibraryService,
  type CreateSkillSuggestionInput,
  type SkillPackageFile,
  type SkillSyncPackage,
} from '../core/SkillLibraryService.js';
import { OpenClawClient } from '../integrations/OpenClawClient.js';
import { OpenClawSkillSyncService } from '../integrations/OpenClawSkillSyncService.js';

interface SkillRouteQuery {
  filter?: 'active' | 'all' | 'dismissed';
  q?: string;
}

interface UpdateSyncSettingBody {
  enabled?: boolean;
}

interface CreateSuggestionBody extends CreateSkillSuggestionInput {}

interface SuggestionActionBody {
  reason?: string;
  days?: number;
  reviewConfirmed?: boolean;
}

interface SyncRunBody {
  platform?: string;
  limit?: number;
  q?: string;
  slugs?: string[];
}

interface LocalPlatformSkillPackage {
  slug: string;
  title?: string;
  description?: string;
  version?: string;
  sha256?: string;
  mtime?: number;
  root?: string;
  directory?: string;
  skillMdPath?: string;
  skillMd: string;
  files?: Array<{ path?: string; relativePath?: string; content: string; sha256?: string; byteSize?: number; byte_size?: number }>;
}

interface LocalPlatformSyncBody {
  platform: string;
  skills?: LocalPlatformSkillPackage[];
}

interface SkillSyncPlatformResult {
  platform: string;
  status: 'succeeded' | 'skipped' | 'failed';
  totalRemote?: number | null;
  candidates?: number;
  processed: number;
  imported: number;
  updated: number;
  pulled: number;
  pushed: number;
  externalChanges: number;
  skipped: number;
  hasMore?: boolean;
  errors: Array<{ slug?: string; error: string }>;
  note?: string;
}

function serviceForRequest(request: FastifyRequest): SkillLibraryService {
  return new SkillLibraryService(request.userContext.db, request.userId || 'default');
}

function parseShareTokenUserId(token: string): string | null {
  const [encoded] = token.split('.');
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8') || null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeSkillFilePath(relativePath: string): string {
  return relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function sendError(reply: FastifyReply, error: unknown, statusCode = 400) {
  const message = error instanceof Error ? error.message : String(error);
  return reply.status(statusCode).send({ error: message });
}

function suggestionActionStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  return /not found/i.test(message) ? 404 : 400;
}

function normalizeSyncLimit(value: unknown): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return 10;
  return Math.max(1, Math.min(25, Math.floor(candidate)));
}

function toPackageFiles(
  files: Array<{ path: string; content: string; sha256?: string; byteSize?: number }>,
): SkillPackageFile[] {
  return files.map((file) => ({
    relativePath: file.path,
    content: file.content,
    sha256: file.sha256,
    byteSize: file.byteSize,
  }));
}

function localPackageFiles(files: NonNullable<LocalPlatformSkillPackage['files']>): SkillPackageFile[] {
  return files
    .map((file) => ({
      relativePath: file.relativePath || file.path || '',
      content: file.content || '',
      sha256: file.sha256,
      byteSize: file.byteSize ?? file.byte_size,
    }))
    .filter((file) => file.relativePath && file.relativePath !== 'SKILL.md');
}

function localSkillMetadata(skill: LocalPlatformSkillPackage): Record<string, unknown> {
  const files = localPackageFiles(skill.files || []);
  const totalByteSize = files.reduce((sum, file) => sum + (file.byteSize || 0), 0);
  return {
    source: 'desktop_app_fs',
    sourceRoot: typeof skill.root === 'string' ? skill.root : undefined,
    sourceDirectory: typeof skill.directory === 'string' ? skill.directory : undefined,
    skillMdPath: typeof skill.skillMdPath === 'string' ? skill.skillMdPath : undefined,
    fileCount: files.length,
    totalByteSize,
  };
}

function skillPackageForPlatform(pkg: SkillSyncPackage, options?: { sha256?: string }) {
  return {
    slug: pkg.slug,
    title: pkg.title,
    description: pkg.summary,
    version: pkg.version,
    sha256: options?.sha256 || pkg.sha256,
    skillMd: pkg.skillMd,
    files: pkg.files.map((file) => ({
      path: file.relativePath,
      content: file.content,
      sha256: file.sha256,
      byteSize: file.byteSize,
    })),
  };
}

async function probeOpenClaw(request: FastifyRequest) {
  const openClaw = new OpenClawClient(request.userContext.userDataManager);
  if (!openClaw.isConfigured()) {
    return {
      platform: 'openclaw',
      ok: false,
      capability: 'api',
      error: 'OpenClaw is not configured',
    };
  }

  const response = await openClaw.request({
    path: '/v1/responses',
    method: 'POST',
    body: {
      model: 'openclaw',
      input:
        'Read-only Personal AI skill sync probe. Return exactly {"ok":true}. Do not modify anything.',
    },
  });

  return {
    platform: 'openclaw',
    ok: response.ok,
    capability: 'api',
    status: response.status,
    response: response.data ?? response.text,
  };
}

async function runOpenClawSkillSync(
  request: FastifyRequest,
  service: SkillLibraryService,
  limit: number,
  filter?: { q?: string; slugs?: string[] },
): Promise<SkillSyncPlatformResult> {
  const setting = service.getSyncSetting('openclaw');
  if (!setting?.enabled) {
    return {
      platform: 'openclaw',
      status: 'skipped',
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: 0,
      errors: [],
      note: 'OpenClaw sync is disabled.',
    };
  }

  const openClaw = new OpenClawClient(request.userContext.userDataManager);
  if (!openClaw.isConfigured()) {
    service.recordSyncProbe('openclaw', {
      ok: false,
      error: 'OpenClaw is not configured',
    });
    return {
      platform: 'openclaw',
      status: 'failed',
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: 0,
      errors: [{ error: 'OpenClaw is not configured' }],
    };
  }

  const sync = new OpenClawSkillSyncService(openClaw);
  try {
    const list = await sync.listInstalledSkills();
    const query = filter?.q?.trim().toLowerCase() || '';
    const slugSet = new Set(
      (filter?.slugs || []).map((slug) => normalizeSkillSlug(slug)),
    );
    const matchesFilter = (skill: {
      slug: string;
      title?: string;
      description?: string;
    }) => {
      if (slugSet.size > 0 && !slugSet.has(normalizeSkillSlug(skill.slug))) return false;
      if (!query) return true;
      return [skill.slug, skill.title || '', skill.description || '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    };
    const remoteBySlug = new Map(
      list.skills.map((skill) => [normalizeSkillSlug(skill.slug), skill]),
    );
    const remoteCandidates = list.skills.filter(matchesFilter);
    const pullQueue = remoteCandidates.filter((remote) => {
      const local = service.getSkillBySlug(remote.slug);
      if (!local) {
        return service.needsPlatformPackageImport({
          platform: 'openclaw',
          slug: remote.slug,
          sha256: remote.sha256,
        });
      }
      if (local.status !== 'active') {
        return service.needsPlatformPackageImport({
          platform: 'openclaw',
          slug: remote.slug,
          sha256: remote.sha256,
        });
      }
      if (local.currentSha256 && remote.sha256 === local.currentSha256) {
        service.recordPlatformSync({
          skillId: local.id,
          platform: 'openclaw',
          version: remote.version || local.currentVersion,
          sha256: remote.sha256,
          remoteMtime: remote.mtime,
        });
        return false;
      }
      return service.isExternalNewerThanSkill(local, remote);
    });
    const selected = pullQueue.slice(0, limit);
    const result: SkillSyncPlatformResult = {
      platform: 'openclaw',
      status: 'succeeded',
      totalRemote: list.total,
      candidates: pullQueue.length,
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: remoteCandidates.length - pullQueue.length,
      hasMore: pullQueue.length > selected.length,
      errors: [],
      note: list.notes,
    };

    for (const item of selected) {
      try {
        const pkg = await sync.exportSkillPackage(item.slug);
        const imported = service.importExternalSkillPackage({
          platform: 'openclaw',
          slug: pkg.slug,
          title: pkg.title || item.title,
          summary: pkg.description || item.description,
          version: pkg.version || item.version,
          skillMd: pkg.skillMd,
          files: toPackageFiles(pkg.files),
          sha256: pkg.sha256 || item.sha256,
          remoteMtime: pkg.mtime || item.mtime,
          metadata: {
            source: 'openclaw_responses',
            filePaths: pkg.files.map((file) => file.path),
          },
        });
        result.processed += 1;
        if (imported.status === 'created_suggestion') result.imported += 1;
        else if (imported.status === 'updated_active') result.pulled += 1;
        else if (imported.status === 'created_external_change') {
          result.externalChanges += 1;
        } else if (imported.status === 'updated_binding') {
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push({
          slug: item.slug,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const active of service.listActiveSyncPackages()) {
      if (!matchesFilter(active)) continue;
      const remote = remoteBySlug.get(normalizeSkillSlug(active.slug));
      if (remote?.sha256 === active.sha256) continue;
      if (remote && service.isExternalNewerThanSkill(
        {
          currentVersion: active.version,
          currentSha256: active.sha256,
          updatedAt: active.updatedAt,
        },
        remote,
      )) {
        continue;
      }
      try {
        const pushed = await sync.upsertSkillPackage(skillPackageForPlatform(active));
        result.processed += 1;
        result.pushed += pushed.action === 'noop' ? 0 : 1;
        if (pushed.action === 'noop') result.skipped += 1;
        service.recordPlatformSync({
          skillId: active.skillId,
          platform: 'openclaw',
          version: pushed.version || active.version,
          sha256: pushed.sha256 || active.sha256,
          remoteMtime: pushed.mtime,
          metadata: { source: 'personal_ai_push', action: pushed.action || 'updated' },
        });
      } catch (error) {
        result.errors.push({
          slug: active.slug,
          error: error instanceof Error ? error.message : String(error),
        });
        service.recordPlatformSync({
          skillId: active.skillId,
          platform: 'openclaw',
          version: active.version,
          sha256: active.sha256,
          state: 'blocked',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    service.recordSyncProbe('openclaw', {
      ok: result.errors.length === 0,
      error: result.errors[0]?.error,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    service.recordSyncProbe('openclaw', { ok: false, error: message });
    return {
      platform: 'openclaw',
      status: 'failed',
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: 0,
      errors: [{ error: message }],
    };
  }
}

async function syncOneActiveSkillToOpenClaw(
  request: FastifyRequest,
  service: SkillLibraryService,
  skillId: string,
): Promise<SkillSyncPlatformResult> {
  const baseResult = (): SkillSyncPlatformResult => ({
    platform: 'openclaw',
    status: 'succeeded',
    processed: 0,
    imported: 0,
    updated: 0,
    pulled: 0,
    pushed: 0,
    externalChanges: 0,
    skipped: 0,
    errors: [],
  });
  const result = baseResult();
  const setting = service.getSyncSetting('openclaw');
  if (!setting?.enabled) {
    return { ...result, status: 'skipped', note: 'OpenClaw sync is disabled.' };
  }

  const detail = service.getSkill(skillId);
  if (!detail?.activeVersion || detail.status !== 'active') {
    return { ...result, status: 'skipped', note: 'Skill is not active.' };
  }

  const openClaw = new OpenClawClient(request.userContext.userDataManager);
  if (!openClaw.isConfigured()) {
    return {
      ...result,
      status: 'failed',
      errors: [{ error: 'OpenClaw is not configured' }],
    };
  }

  const sync = new OpenClawSkillSyncService(openClaw);
  try {
    const active = service.toSyncPackage(detail);
    const list = await sync.listInstalledSkills();
    const remote = list.skills.find(
      (item) => normalizeSkillSlug(item.slug) === normalizeSkillSlug(active.slug),
    );
    if (remote?.sha256 === active.sha256) {
      service.recordPlatformSync({
        skillId: active.skillId,
        platform: 'openclaw',
        version: remote.version || active.version,
        sha256: remote.sha256,
        remoteMtime: remote.mtime,
      });
      return { ...result, skipped: 1 };
    }

    if (
      remote &&
      service.isExternalNewerThanSkill(
        {
          currentVersion: active.version,
          currentSha256: active.sha256,
          updatedAt: active.updatedAt,
        },
        remote,
      )
    ) {
      const pkg = await sync.exportSkillPackage(remote.slug);
      const imported = service.importExternalSkillPackage({
        platform: 'openclaw',
        slug: pkg.slug,
        title: pkg.title || remote.title,
        summary: pkg.description || remote.description,
        version: pkg.version || remote.version,
        skillMd: pkg.skillMd,
        files: toPackageFiles(pkg.files),
        sha256: pkg.sha256 || remote.sha256,
        remoteMtime: pkg.mtime || remote.mtime,
        metadata: {
          source: 'openclaw_responses',
          filePaths: pkg.files.map((file) => file.path),
        },
      });
      return {
        ...result,
        processed: 1,
        externalChanges: imported.status === 'created_external_change' ? 1 : 0,
        updated: imported.status === 'updated_binding' ? 1 : 0,
        skipped: imported.status === 'skipped' ? 1 : 0,
      };
    }

    const pushed = await sync.upsertSkillPackage(skillPackageForPlatform(active));
    service.recordPlatformSync({
      skillId: active.skillId,
      platform: 'openclaw',
      version: pushed.version || active.version,
      sha256: pushed.sha256 || active.sha256,
      remoteMtime: pushed.mtime,
      metadata: { source: 'personal_ai_push', action: pushed.action || 'updated' },
    });
    return {
      ...result,
      processed: 1,
      pushed: pushed.action === 'noop' ? 0 : 1,
      skipped: pushed.action === 'noop' ? 1 : 0,
    };
  } catch (error) {
    return {
      ...result,
      status: 'failed',
      errors: [{ error: error instanceof Error ? error.message : String(error) }],
    };
  }
}

function runLocalPlatformSkillSync(
  service: SkillLibraryService,
  body: LocalPlatformSyncBody,
): SkillSyncPlatformResult & { packagesToInstall: ReturnType<typeof skillPackageForPlatform>[] } {
  const platform = body.platform?.trim();
  if (!platform) {
    throw new Error('Local skill sync platform is required.');
  }
  const setting = service.getSyncSetting(platform);
  if (!setting?.enabled || setting.capability !== 'fs_via_desktop_app') {
    return {
      platform,
      status: 'skipped',
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: 0,
      errors: [],
      packagesToInstall: [],
      note: 'Platform local skill sync is disabled or unsupported.',
    };
  }

  const localBySlug = new Map(
    (body.skills || []).map((skill) => [normalizeSkillSlug(skill.slug), skill]),
  );
  const result: SkillSyncPlatformResult & {
    packagesToInstall: ReturnType<typeof skillPackageForPlatform>[];
  } = {
    platform,
    status: 'succeeded',
    totalRemote: body.skills?.length ?? 0,
    candidates: body.skills?.length ?? 0,
    processed: 0,
    imported: 0,
    updated: 0,
    pulled: 0,
    pushed: 0,
    externalChanges: 0,
    skipped: 0,
    errors: [],
    packagesToInstall: [],
  };

  for (const local of body.skills || []) {
    try {
      const existing = service.getSkillBySlug(local.slug);
      if (!existing) {
        const imported = service.importExternalSkillPackage({
          platform,
          slug: local.slug,
          title: local.title,
          summary: local.description,
          version: local.version,
          skillMd: local.skillMd,
          files: localPackageFiles(local.files || []),
          sha256: local.sha256,
          remoteMtime: local.mtime,
          metadata: localSkillMetadata(local),
        });
        result.processed += 1;
        if (imported.status === 'created_suggestion') result.imported += 1;
        else result.updated += 1;
        continue;
      }

      if (existing.status !== 'active') {
        service.recordPlatformSync({
          skillId: existing.id,
          platform,
          version: local.version || existing.currentVersion,
          sha256: local.sha256,
          remoteMtime: local.mtime,
          metadata: localSkillMetadata(local),
        });
        result.skipped += 1;
        continue;
      }

      if (
        local.sha256 &&
        (existing.currentSha256 === local.sha256 ||
          service.platformBindingMatchesSha(existing.id, platform, local.sha256))
      ) {
        service.recordPlatformSync({
          skillId: existing.id,
          platform,
          version: local.version || existing.currentVersion,
          sha256: local.sha256,
          remoteMtime: local.mtime,
          metadata: localSkillMetadata(local),
        });
        result.skipped += 1;
        continue;
      }

      if (service.isExternalNewerThanSkill(existing, local)) {
        const updated = service.importExternalSkillPackage({
          platform,
          slug: local.slug,
          title: local.title,
          summary: local.description,
          version: local.version,
          skillMd: local.skillMd,
          files: localPackageFiles(local.files || []),
          sha256: local.sha256,
          remoteMtime: local.mtime,
          metadata: localSkillMetadata(local),
        });
        result.processed += 1;
        if (updated.status === 'created_external_change') result.externalChanges += 1;
        else if (updated.status === 'created_suggestion') result.imported += 1;
        else if (updated.status === 'skipped') result.skipped += 1;
        else result.updated += 1;
      }
    } catch (error) {
      result.errors.push({
        slug: local.slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const active of service.listActiveSyncPackages()) {
    const local = localBySlug.get(normalizeSkillSlug(active.slug));
    if (
      local?.sha256 &&
      service.platformBindingMatchesSha(active.skillId, platform, local.sha256)
    ) {
      continue;
    }
    if (local?.sha256 === active.sha256) continue;
    if (
      local &&
      service.isExternalNewerThanSkill(
        {
          currentVersion: active.version,
          currentSha256: active.sha256,
          updatedAt: active.updatedAt,
        },
        local,
      )
    ) {
      continue;
    }
    const installPackage = skillPackageForPlatform(active, {
      sha256: hashSkillFilesystemPackage(active.skillMd, active.files),
    });
    result.packagesToInstall.push(installPackage);
    result.pushed += 1;
    service.recordPlatformSync({
      skillId: active.skillId,
      platform,
      version: active.version,
      sha256: installPackage.sha256,
      metadata: {
        source: 'personal_ai_desktop_push',
        pendingWrite: true,
        personalAiSha256: active.sha256,
      },
    });
  }

  result.status = result.errors.length > 0 ? 'failed' : 'succeeded';
  return result;
}

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SkillRouteQuery }>('/skills', async (request, reply) => {
    const service = serviceForRequest(request);
    return reply.status(200).send(service.listSkills(request.query));
  });

  app.get('/skills/suggestions', async (request, reply) => {
    const service = serviceForRequest(request);
    return reply.status(200).send(service.listSuggestions());
  });

  app.post<{ Body: CreateSuggestionBody }>(
    '/skills/suggestions',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const skill = service.createSuggestion(request.body);
        return reply.status(201).send({ skill });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: SuggestionActionBody }>(
    '/skills/suggestions/:id/use',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const skill = service.useSuggestion(request.params.id, {
          reviewConfirmed: Boolean(request.body?.reviewConfirmed),
        });
        let sync: SkillSyncPlatformResult | undefined;
        if (service.getSyncSetting('openclaw')?.enabled) {
          sync = await syncOneActiveSkillToOpenClaw(request, service, skill.id);
        }
        return reply.status(200).send({ skill: service.getSkill(skill.id) || skill, sync });
      } catch (error) {
        return sendError(reply, error, suggestionActionStatus(error));
      }
    },
  );

  app.post<{ Params: { id: string }; Body: SuggestionActionBody }>(
    '/skills/suggestions/:id/dismiss',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const skill = service.dismissSuggestion(request.params.id, request.body?.reason);
        return reply.status(200).send({ skill });
      } catch (error) {
        return sendError(reply, error, suggestionActionStatus(error));
      }
    },
  );

  app.post<{ Params: { id: string }; Body: SuggestionActionBody }>(
    '/skills/suggestions/:id/snooze',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const skill = service.snoozeSuggestion(request.params.id, request.body?.days);
        return reply.status(200).send({ skill });
      } catch (error) {
        return sendError(reply, error, suggestionActionStatus(error));
      }
    },
  );

  app.get('/skills/sync-settings', async (request, reply) => {
    const service = serviceForRequest(request);
    return reply.status(200).send({
      items: service.listSyncSettings(),
    });
  });

  app.put<{ Params: { platform: string }; Body: UpdateSyncSettingBody }>(
    '/skills/sync-settings/:platform',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const setting = service.updateSyncSetting(
          request.params.platform,
          Boolean(request.body?.enabled),
        );
        return reply.status(200).send({ setting });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { platform: string } }>(
    '/skills/bindings/:platform/probe',
    async (request, reply) => {
      const service = serviceForRequest(request);
      const { platform } = request.params;

      if (platform === 'openclaw') {
        try {
          const result = await probeOpenClaw(request);
          service.recordSyncProbe(platform, {
            ok: Boolean(result.ok),
            error: result.ok ? undefined : 'OpenClaw probe failed',
          });
          return reply.status(200).send(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          service.recordSyncProbe(platform, { ok: false, error: message });
          return reply.status(200).send({
            platform,
            ok: false,
            capability: 'api',
            error: message,
          });
        }
      }

      const setting = service.getSyncSetting(platform);
      return reply.status(200).send({
        platform,
        ok: Boolean(setting),
        capability: setting?.capability ?? 'manual_only',
        setting,
      });
    },
  );

  app.post<{ Body: SyncRunBody }>('/skills/sync/run', async (request, reply) => {
    const service = serviceForRequest(request);
    const settings = service.listSyncSettings();
    const active = service.listSkills({ filter: 'active' });
    const requestedPlatform = request.body?.platform || 'all';
    const limit = normalizeSyncLimit(request.body?.limit);
    const syncFilter = {
      q: request.body?.q,
      slugs: Array.isArray(request.body?.slugs) ? request.body.slugs : undefined,
    };
    const platformResults: SkillSyncPlatformResult[] = [];

    if (requestedPlatform === 'all' || requestedPlatform === 'openclaw') {
      platformResults.push(await runOpenClawSkillSync(request, service, limit, syncFilter));
    }

    if (requestedPlatform !== 'all' && requestedPlatform !== 'openclaw') {
      platformResults.push({
        platform: requestedPlatform,
        status: 'skipped',
        processed: 0,
        imported: 0,
        updated: 0,
        pulled: 0,
        pushed: 0,
        externalChanges: 0,
        skipped: 0,
        errors: [],
        note: 'This platform is handled by Desktop App or manual install in the current MVP.',
      });
    }

    const failed = platformResults.some(
      (result) => result.status === 'failed' || result.errors.length > 0,
    );
    return reply.status(200).send({
      status: failed ? 'partial_failed' : 'succeeded',
      processed: platformResults.reduce((sum, result) => sum + result.processed, 0),
      activeSkillCount: active.total,
      enabledPlatforms: settings
        .filter((setting) => setting.enabled)
        .map((setting) => setting.platform),
      limit,
      filter: {
        q: syncFilter.q || undefined,
        slugs: syncFilter.slugs,
      },
      platforms: platformResults,
    });
  });

  app.post<{ Body: LocalPlatformSyncBody }>(
    '/skills/sync/local-platform',
    async (request, reply) => {
      const service = serviceForRequest(request);
      try {
        const result = runLocalPlatformSkillSync(service, request.body);
        return reply.status(200).send({
          ...result,
          status: result.status === 'failed' ? 'partial_failed' : 'succeeded',
        });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string } }>('/skills/:id', async (request, reply) => {
    const service = serviceForRequest(request);
    const skill = service.getSkill(request.params.id);
    if (!skill) return reply.status(404).send({ error: 'Skill not found' });
    return reply.status(200).send({ skill });
  });
}

export async function publicSkillRoutes(
  app: FastifyInstance,
  opts: { userContextManager: UserContextManager },
): Promise<void> {
  function resolveService(request: FastifyRequest): SkillLibraryService | null {
    const token =
      typeof request.query === 'object' &&
      request.query &&
      'token' in request.query &&
      typeof (request.query as { token?: unknown }).token === 'string'
        ? (request.query as { token: string }).token
        : '';
    if (!token) return null;

    const userId = parseShareTokenUserId(token);
    if (!userId) return null;
    const context = opts.userContextManager.getContext(userId);
    return new SkillLibraryService(context.db, userId);
  }

  function resolveShared(request: FastifyRequest, reply: FastifyReply) {
    const token =
      typeof request.query === 'object' &&
      request.query &&
      'token' in request.query &&
      typeof (request.query as { token?: unknown }).token === 'string'
        ? (request.query as { token: string }).token
        : '';
    const slugVersion = (request.params as { slugVersion?: string }).slugVersion || '';
    const service = resolveService(request);
    if (!service) {
      reply.status(404).send({ error: 'Shared skill not found' });
      return null;
    }
    const detail = service.resolveSharedSkill(token, slugVersion);
    if (!detail?.activeVersion) {
      reply.status(404).send({ error: 'Shared skill not found' });
      return null;
    }
    const etag = `"${detail.activeVersion.sha256}"`;
    if (request.headers['if-none-match'] === etag) {
      reply.status(304).send();
      return null;
    }
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, max-age=60');
    return { service, detail };
  }

  app.get<{ Params: { slugVersion: string }; Querystring: { token?: string } }>(
    '/skills/:slugVersion',
    async (request, reply) => {
      const resolved = resolveShared(request, reply);
      if (!resolved) return;
      const { detail } = resolved;
      const version = detail.activeVersion!;
      const token = request.query.token || '';
      const slugVersion = request.params.slugVersion;
      const basePath = `/skills/${encodeURIComponent(slugVersion)}`;
      const query = `token=${encodeURIComponent(token)}`;
      const packageUrl = `${basePath}/package.json?${query}`;
      const skillMdUrl = `${basePath}/SKILL.md?${query}`;
      const fileLinks = version.files
        .map((file) => {
          const href = `${basePath}/files/${encodeSkillFilePath(file.relativePath)}?${query}`;
          const hashLabel = file.sha256 ? ` ${escapeHtml(file.sha256.slice(0, 12))}` : '';
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(file.relativePath)}</a><span class="muted">${hashLabel}</span></li>`;
        })
        .join('\n');
      const installPrompt = [
        `Install this Personal AI skill from ${packageUrl}.`,
        'Read package.json first; it contains SKILL.md plus the files array.',
        'If your installer needs separate files, fetch SKILL.md and every files/* link shown on the preview page.',
        'Preserve relative file paths when writing the skill directory.',
      ].join(' ');
      reply.type('text/html; charset=utf-8');
      return reply.send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(detail.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 880px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #111827; }
    a { color: #2563eb; }
    code, pre { background: #f3f4f6; border-radius: 6px; }
    pre { padding: 16px; overflow: auto; }
    .muted { color: #6b7280; }
    .panel { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0; }
    .links { margin: 8px 0 0; padding-left: 20px; }
  </style>
</head>
<body>
  <p class="muted">Personal AI Skill · ${escapeHtml(version.version)} · ${escapeHtml(version.sha256.slice(0, 12))}</p>
  <h1>${escapeHtml(detail.title)}</h1>
  <p>${escapeHtml(detail.summary)}</p>
  <section class="panel">
    <h2>完整安装</h2>
    <p>让你的 agent 先读取 <a href="${escapeHtml(packageUrl)}">package.json</a>；它包含 SKILL.md 和已打包的脚本/资源文件内容。</p>
    <pre>${escapeHtml(installPrompt)}</pre>
    <h3>直接链接</h3>
    <ul class="links">
      <li><a href="${escapeHtml(packageUrl)}">package.json</a> <span class="muted">完整 package</span></li>
      <li><a href="${escapeHtml(skillMdUrl)}">SKILL.md</a> <span class="muted">技能说明</span></li>
      ${fileLinks || '<li class="muted">这个版本没有额外 files。</li>'}
    </ul>
  </section>
  <h2>SKILL.md</h2>
  <pre>${escapeHtml(version.skillMd)}</pre>
</body>
</html>`);
    },
  );

  app.get<{ Params: { slugVersion: string }; Querystring: { token?: string } }>(
    '/skills/:slugVersion/SKILL.md',
    async (request, reply) => {
      const resolved = resolveShared(request, reply);
      if (!resolved) return;
      reply.type('text/markdown; charset=utf-8');
      return reply.send(resolved.detail.activeVersion!.skillMd);
    },
  );

  app.get<{ Params: { slugVersion: string }; Querystring: { token?: string } }>(
    '/skills/:slugVersion/package.json',
    async (request, reply) => {
      const resolved = resolveShared(request, reply);
      if (!resolved) return;
      reply.type('application/json; charset=utf-8');
      return reply.send(resolved.service.buildSharePackage(resolved.detail));
    },
  );

  app.get<{
    Params: { slugVersion: string; '*': string };
    Querystring: { token?: string };
  }>('/skills/:slugVersion/files/*', async (request, reply) => {
    const resolved = resolveShared(request, reply);
    if (!resolved) return;
    const relativePath = request.params['*'];
    const file = resolved.detail.activeVersion!.files.find(
      (candidate) => candidate.relativePath === relativePath,
    );
    if (!file) return reply.status(404).send({ error: 'Skill file not found' });
    reply.type('text/plain; charset=utf-8');
    return reply.send(file.content);
  });
}
