import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';

const USER_ID = 'skill-user';

describe('Personal Skill Library API', () => {
  const fetchMock = vi.fn();
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-skills-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    const context = userContextManager.getContext(USER_ID);
    const db = context.db;
    db.prepare('DELETE FROM skill_share_links').run();
    db.prepare('DELETE FROM skill_platform_bindings').run();
    db.prepare('DELETE FROM skill_versions').run();
    db.prepare('DELETE FROM personal_skills').run();
    db.prepare('DELETE FROM skill_platform_sync_settings').run();
    db.prepare("DELETE FROM notification_records WHERE type = 'skill_suggestion'").run();
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({ openClawEnabled: false }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function createSuggestion(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
      payload: {
        slug: 'jira-headcount-trend-report',
        title: 'Jira Headcount Trend Report',
        summary: 'Turn repeated Jira headcount analysis into a reusable workflow.',
        scope: 'work',
        risk: 'medium',
        trigger: 'Jira headcount or assignee trend request',
        notUse: 'Missing project key or date range',
        sources: ['Jira', 'Codex'],
        repetition: '近 30 天 5 次相似任务',
        workflow: [
          { title: 'Confirm scope', desc: 'Ask for project key and date range.', tools: ['ask_user'] },
          { title: 'Normalize export', desc: 'Deduplicate assignees.', tools: ['python'] },
        ],
        evidence: [
          {
            title: 'Daily Summary',
            desc: 'Sophia and Esone worked on Jira data extraction.',
            kind: 'daily',
            evidenceState: 'complete',
            episodeId: 'ep-jira',
          },
        ],
        sourceEpisodes: [{ id: 'ep-jira', title: 'Jira analysis', date: '2026-04-30' }],
        notify: true,
        ...overrides,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().skill;
  }

  function openClawJsonResponse(payload: unknown) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output_text: JSON.stringify(payload) }),
    };
  }

  function openClawTextResponse(text: string) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output_text: text }),
    };
  }

  function escapedOpenClawJsonText(payload: unknown, rounds = 1) {
    let text = JSON.stringify(payload, null, 2);
    for (let index = 0; index < rounds; index += 1) {
      text = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
    }
    return text;
  }

  function localFilesystemSha(
    skillMd: string,
    files: Array<{ path?: string; relativePath?: string; content: string; sha256?: string; byteSize?: number }> = [],
  ) {
    return createHash('sha256')
      .update(JSON.stringify({
        skillMd,
        files: files
          .map((file) => ({
            path: file.relativePath || file.path || '',
            content: file.content || '',
            sha256:
              file.sha256 ||
              createHash('sha256').update(file.content || '').digest('hex'),
            byteSize:
              file.byteSize ?? Buffer.byteLength(file.content || '', 'utf8'),
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      }))
      .digest('hex');
  }

  it('keeps suggestions out of the main list until promoted', async () => {
    const suggestion = await createSuggestion();

    const activeBefore = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: { 'x-user-id': USER_ID },
    });
    expect(activeBefore.statusCode).toBe(200);
    expect(activeBefore.json().total).toBe(0);

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().total).toBe(1);
    expect(inbox.json().items[0].status).toBe('suggestion');

    const useRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });
    expect(useRes.statusCode).toBe(200);
    expect(useRes.json().skill.status).toBe('active');

    const activeAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: { 'x-user-id': USER_ID },
    });
    expect(activeAfter.json().total).toBe(1);
    expect(activeAfter.json().items[0].bindings[0].platform).toBe('personal_ai');
  });

  it('serves tokenized skill URLs with ETag support', async () => {
    const suggestion = await createSuggestion({
      files: [
        {
          relativePath: 'scripts/report.py',
          content: 'print("report")\n',
          sha256: 'report-script-sha',
          byteSize: 16,
        },
      ],
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: { reviewConfirmed: true },
    });

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${suggestion.id}`,
      headers: { 'x-user-id': USER_ID },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json().skill;
    expect(detail.share.urlPath).toContain('/skills/jira-headcount-trend-report%40v0.1');
    const [sharePath, shareQuery] = String(detail.share.urlPath).split('?');
    const skillMdPath = `${sharePath}/SKILL.md?${shareQuery}`;
    const packagePath = `${sharePath}/package.json?${shareQuery}`;
    const filePath = `${sharePath}/files/scripts/report.py?${shareQuery}`;

    const htmlRes = await app.inject({
      method: 'GET',
      url: detail.share.urlPath,
    });
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.body).toContain('package.json');
    expect(htmlRes.body).toContain('/SKILL.md?token=');
    expect(htmlRes.body).toContain('/files/scripts/report.py?token=');

    const mdRes = await app.inject({
      method: 'GET',
      url: skillMdPath,
    });
    expect(mdRes.statusCode).toBe(200);
    expect(mdRes.body).toContain('# Jira Headcount Trend Report');
    expect(mdRes.headers.etag).toBe(detail.share.etag);

    const notModified = await app.inject({
      method: 'GET',
      url: skillMdPath,
      headers: { 'if-none-match': detail.share.etag },
    });
    expect(notModified.statusCode).toBe(304);

    const packageRes = await app.inject({
      method: 'GET',
      url: packagePath,
    });
    expect(packageRes.statusCode).toBe(200);
    expect(packageRes.json().files[0]).toMatchObject({
      relativePath: 'scripts/report.py',
      content: 'print("report")\n',
    });

    const fileRes = await app.inject({
      method: 'GET',
      url: filePath,
    });
    expect(fileRes.statusCode).toBe(200);
    expect(fileRes.body).toBe('print("report")\n');
  });

  it('manages sync settings with platform-level constraints', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/sync-settings',
      headers: { 'x-user-id': USER_ID },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.some((item: any) => item.platform === 'openclaw')).toBe(true);

    const manualRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/skills/sync-settings/chatgpt_gpts',
      headers: { 'x-user-id': USER_ID },
      payload: { enabled: true },
    });
    expect(manualRes.statusCode).toBe(200);
    expect(manualRes.json().setting.enabled).toBe(false);

    const codexRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/skills/sync-settings/codex',
      headers: { 'x-user-id': USER_ID },
      payload: { enabled: true },
    });
    expect(codexRes.statusCode).toBe(200);
    expect(codexRes.json().setting.enabled).toBe(true);
  });

  it('imports OpenClaw installed skills as suggestions during sync run', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const context = userContextManager.getContext(USER_ID);
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
      }),
    );

    fetchMock
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          total: 2,
          skills: [
            {
              slug: 'weather',
              title: 'Weather',
              description: 'Check weather from an installed OpenClaw skill.',
              version: 'v1',
              sha256: 'weather-package-sha',
              mtime: 1_000,
            },
            {
              slug: 'quarter-output-filters',
              title: 'Quarter Output Filters',
              description: 'Create quarterly output filters.',
              version: 'v0.2',
              sha256: 'quarter-package-sha',
              mtime: 1_010,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          skill: {
            slug: 'weather',
            title: 'Weather',
            description: 'Check weather from an installed OpenClaw skill.',
            version: 'v1',
            sha256: 'weather-package-sha',
            mtime: 1_000,
            skillMd: '# Weather\n\nUse when the user asks for forecasts.',
            files: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          skill: {
            slug: 'quarter-output-filters',
            title: 'Quarter Output Filters',
            description: 'Create quarterly output filters.',
            version: 'v0.2',
            sha256: 'quarter-package-sha',
            mtime: 1_010,
            skillMd: '# Quarter Output Filters\n\nUse for quarterly output setup.',
            files: [
              {
                path: 'scripts/run_quarter_output_filters.py',
                content: 'print("quarter")\n',
                sha256: 'script-sha',
                byte_size: 17,
              },
            ],
          },
        }),
      );

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw', limit: 10 },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().status).toBe('succeeded');
    expect(syncRes.json().platforms[0]).toMatchObject({
      platform: 'openclaw',
      processed: 2,
      imported: 2,
      updated: 0,
      hasMore: false,
    });

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().total).toBe(2);
    const quarter = inbox
      .json()
      .items.find((item: any) => item.slug === 'quarter-output-filters');
    expect(quarter.bindings[0]).toMatchObject({
      platform: 'openclaw',
      state: 'installed',
      installedVersion: 'v0.2',
      installedSha256: 'quarter-package-sha',
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${quarter.id}`,
      headers: { 'x-user-id': USER_ID },
    });
    expect(detail.json().skill.activeVersion.files[0]).toMatchObject({
      relativePath: 'scripts/run_quarter_output_filters.py',
      content: 'print("quarter")\n',
      sha256: 'script-sha',
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      openClawJsonResponse({
        ok: true,
        total: 2,
        skills: [
          { slug: 'weather', sha256: 'weather-package-sha' },
          { slug: 'quarter-output-filters', sha256: 'quarter-package-sha' },
        ],
      }),
    );
    const secondSync = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw', limit: 10 },
    });
    expect(secondSync.statusCode).toBe(200);
    expect(secondSync.json().platforms[0]).toMatchObject({
      processed: 0,
      imported: 0,
      skipped: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('imports OpenClaw packages returned as escaped JSON text', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const context = userContextManager.getContext(USER_ID);
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
      }),
    );

    fetchMock
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          total: 1,
          skills: [
            {
              slug: 'webinar-release-tracker',
              title: 'Webinar Release Tracker',
              description: 'Manage webinar Jira tickets.',
              version: 'v1',
              sha256: 'webinar-sha',
              mtime: 1_000,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        openClawTextResponse(
          escapedOpenClawJsonText(
            {
              ok: true,
              skill: {
                slug: 'webinar-release-tracker',
                title: 'Webinar Release Tracker',
                description: 'Manage webinar Jira tickets.',
                version: 'v1',
                sha256: 'webinar-sha',
                mtime: 1_000,
                skillMdBase64: Buffer.from(
                  '# Webinar Release Tracker\n\nCreate "Webinar Ticket" Jira tasks.',
                  'utf8',
                ).toString('base64'),
                files: [],
              },
            },
            2,
          ),
        ),
      );

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw', limit: 10, q: 'webinar' },
    });

    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().status).toBe('succeeded');
    expect(syncRes.json().platforms[0]).toMatchObject({
      processed: 1,
      imported: 1,
    });

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inbox.json().items[0]).toMatchObject({
      slug: 'webinar-release-tracker',
      status: 'suggestion',
      suggestedFrom: 'openclaw',
    });
  });

  it('pushes active Personal AI skills to OpenClaw when remote is missing', async () => {
    const suggestion = await createSuggestion({
      slug: 'meeting-prep',
      title: 'Meeting Prep',
      currentVersion: 'v1',
      skillMd: '# Meeting Prep\n\nPrepare meetings from memory.',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });

    vi.stubGlobal('fetch', fetchMock);
    const context = userContextManager.getContext(USER_ID);
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
      }),
    );
    fetchMock
      .mockResolvedValueOnce(openClawJsonResponse({ ok: true, total: 0, skills: [] }))
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          skill: {
            slug: 'meeting-prep',
            action: 'installed',
            version: 'v1',
            sha256: 'pushed-sha',
            mtime: 2_000,
          },
        }),
      );

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw' },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().platforms[0]).toMatchObject({
      pushed: 1,
      imported: 0,
      pulled: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const detail = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/meeting-prep',
      headers: { 'x-user-id': USER_ID },
    });
    const openclawBinding = detail
      .json()
      .skill.bindings.find((binding: any) => binding.platform === 'openclaw');
    expect(openclawBinding).toMatchObject({
      state: 'installed',
      installedSha256: 'pushed-sha',
    });
  });

  it('stages newer OpenClaw versions as reviewable external changes before applying them', async () => {
    const suggestion = await createSuggestion({
      slug: 'weather',
      title: 'Weather',
      currentVersion: 'v1',
      skillMd: '# Weather\n\nOld weather workflow.',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });

    vi.stubGlobal('fetch', fetchMock);
    const context = userContextManager.getContext(USER_ID);
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
      }),
    );
    fetchMock
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          total: 1,
          skills: [
            {
              slug: 'weather',
              title: 'Weather',
              description: 'New weather workflow.',
              version: 'v2',
              sha256: 'remote-weather-v2-sha',
              mtime: 9_999_999_999,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        openClawJsonResponse({
          ok: true,
          skill: {
            slug: 'weather',
            title: 'Weather',
            description: 'New weather workflow.',
            version: 'v2',
            sha256: 'remote-weather-v2-sha',
            mtime: 9_999_999_999,
            skillMd: '# Weather\n\nNew weather workflow.',
            files: [],
          },
        }),
      );

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw' },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().platforms[0]).toMatchObject({
      externalChanges: 1,
      pushed: 0,
    });

    const unchangedDetail = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/weather',
      headers: { 'x-user-id': USER_ID },
    });
    expect(unchangedDetail.json().skill.currentVersion).toBe('v1');
    expect(unchangedDetail.json().skill.activeVersion.skillMd).toContain('Old weather workflow');

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().total).toBe(1);
    const externalChange = inbox.json().items[0];
    expect(externalChange).toMatchObject({
      slug: 'weather-openclaw-change',
      status: 'suggestion',
      reviewRequired: true,
    });

    const blockedUse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${externalChange.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });
    expect(blockedUse.statusCode).toBe(400);
    expect(blockedUse.json().error).toMatch(/Review required/);

    const confirmedUse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${externalChange.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: { reviewConfirmed: true },
    });
    expect(confirmedUse.statusCode).toBe(200);
    expect(confirmedUse.json().skill).toMatchObject({
      slug: 'weather',
      status: 'active',
      currentVersion: 'v2',
      currentSha256: 'remote-weather-v2-sha',
    });
    expect(confirmedUse.json().skill.activeVersion.skillMd).toContain('New weather workflow');

    const dismissedList = await app.inject({
      method: 'GET',
      url: '/api/v1/skills?filter=dismissed',
      headers: { 'x-user-id': USER_ID },
    });
    expect(dismissedList.json().items[0]).toMatchObject({
      slug: 'weather-openclaw-change',
      dismissReason: 'applied_external_change',
    });
  });

  it('syncs local Desktop App platforms bidirectionally through Memory Service', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/v1/skills/sync-settings/codex',
      headers: { 'x-user-id': USER_ID },
      payload: { enabled: true },
    });
    const suggestion = await createSuggestion({
      slug: 'meeting-prep',
      title: 'Meeting Prep',
      currentVersion: 'v1',
      skillMd: '# Meeting Prep\n\nPrepare meetings from memory.',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });

    const pushRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/local-platform',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'codex', skills: [] },
    });
    expect(pushRes.statusCode).toBe(200);
    expect(pushRes.json().packagesToInstall).toHaveLength(1);
    expect(pushRes.json().packagesToInstall[0]).toMatchObject({
      slug: 'meeting-prep',
      version: 'v1',
    });
    const installPackage = pushRes.json().packagesToInstall[0];
    const filesystemSha = localFilesystemSha(
      installPackage.skillMd,
      installPackage.files,
    );
    expect(installPackage.sha256).toBe(filesystemSha);

    const echoedPushRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/local-platform',
      headers: { 'x-user-id': USER_ID },
      payload: {
        platform: 'codex',
        skills: [
          {
            slug: 'meeting-prep',
            title: 'Meeting Prep',
            description: 'Prepare meetings from memory.',
            version: 'v1',
            sha256: filesystemSha,
            mtime: 1,
            skillMd: installPackage.skillMd,
            files: [],
          },
        ],
      },
    });
    expect(echoedPushRes.statusCode).toBe(200);
    expect(echoedPushRes.json()).toMatchObject({
      externalChanges: 0,
      pushed: 0,
      skipped: 1,
    });
    expect(echoedPushRes.json().packagesToInstall).toHaveLength(0);

    const pullRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/local-platform',
      headers: { 'x-user-id': USER_ID },
      payload: {
        platform: 'codex',
        skills: [
          {
            slug: 'meeting-prep',
            title: 'Meeting Prep',
            description: 'Updated locally.',
            version: 'v2',
            sha256: 'local-v2-sha',
            mtime: 9_999_999_999,
            skillMd: '# Meeting Prep\n\nUpdated locally.',
            files: [],
          },
        ],
      },
    });
    expect(pullRes.statusCode).toBe(200);
    expect(pullRes.json()).toMatchObject({ externalChanges: 1, pushed: 0 });

    const detailBeforeReview = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/meeting-prep',
      headers: { 'x-user-id': USER_ID },
    });
    expect(detailBeforeReview.json().skill.currentVersion).toBe('v1');

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    const externalChange = inbox
      .json()
      .items.find((item: any) => item.slug === 'meeting-prep-codex-change');
    expect(externalChange).toMatchObject({
      status: 'suggestion',
      reviewRequired: true,
    });

    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${externalChange.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: { reviewConfirmed: true },
    });
    expect(applyRes.statusCode).toBe(200);
    expect(applyRes.json().skill.currentVersion).toBe('v2');
    expect(applyRes.json().skill.currentSha256).toBe('local-v2-sha');
  });

  it('reports malformed OpenClaw JSON as a sync failure', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const context = userContextManager.getContext(USER_ID);
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
      }),
    );
    fetchMock.mockResolvedValueOnce(openClawTextResponse('I can list the skills, but not JSON.'));

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/sync/run',
      headers: { 'x-user-id': USER_ID },
      payload: { platform: 'openclaw', limit: 10 },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().status).toBe('partial_failed');
    expect(syncRes.json().platforms[0].errors[0].error).toMatch(/strict JSON/);

    const settings = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/sync-settings',
      headers: { 'x-user-id': USER_ID },
    });
    const openclaw = settings
      .json()
      .items.find((item: any) => item.platform === 'openclaw');
    expect(openclaw.lastError).toMatch(/strict JSON/);
  });

  it('requires explicit review confirmation before promoting risky suggestions', async () => {
    const suggestion = await createSuggestion({
      slug: 'external-script-skill',
      title: 'External Script Skill',
      risk: 'high',
      sources: ['openclaw'],
      suggestedFrom: 'openclaw',
      workflow: [
        {
          title: 'Run helper',
          desc: 'Execute the imported helper script.',
          tools: ['bash'],
        },
      ],
      evidence: [
        {
          title: 'OpenClaw export',
          desc: 'Imported package metadata.',
          kind: 'openclaw',
          evidenceState: 'partial',
        },
      ],
      files: [
        {
          relativePath: 'scripts/helper.sh',
          content: 'echo helper\n',
        },
      ],
    });

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${suggestion.id}`,
      headers: { 'x-user-id': USER_ID },
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().skill.reviewRequired).toBe(true);
    expect(detailRes.json().skill.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/高风险/),
        expect.stringMatching(/外部 agent/),
        expect.stringMatching(/脚本或资源文件/),
        expect.stringMatching(/证据链/),
        expect.stringMatching(/工具调用/),
      ]),
    );

    const inboxRes = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxRes.statusCode).toBe(200);
    expect(inboxRes.json().items[0].reviewRequired).toBe(true);
    expect(inboxRes.json().items[0].reviewReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/脚本或资源文件/),
        expect.stringMatching(/证据链/),
        expect.stringMatching(/工具调用/),
      ]),
    );

    const blockedUse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });
    expect(blockedUse.statusCode).toBe(400);
    expect(blockedUse.json().error).toMatch(/Review required/);

    const confirmedUse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: { reviewConfirmed: true },
    });
    expect(confirmedUse.statusCode).toBe(200);
    expect(confirmedUse.json().skill.status).toBe('active');
    expect(confirmedUse.json().skill.reviewRequired).toBe(false);
  });

  it('snoozes and dismisses only pending suggestions', async () => {
    const suggestion = await createSuggestion({
      slug: 'snoozeable-skill',
      title: 'Snoozeable Skill',
    });

    const snoozeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/snooze`,
      headers: { 'x-user-id': USER_ID },
      payload: { days: 3 },
    });
    expect(snoozeRes.statusCode).toBe(200);
    expect(snoozeRes.json().skill.status).toBe('suggestion');
    expect(snoozeRes.json().skill.snoozedUntil).toBeGreaterThan(
      snoozeRes.json().skill.updatedAt,
    );

    const inboxAfterSnooze = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxAfterSnooze.statusCode).toBe(200);
    expect(inboxAfterSnooze.json().total).toBe(0);

    const context = userContextManager.getContext(USER_ID);
    context.db
      .prepare('UPDATE personal_skills SET snoozed_until = ? WHERE id = ?')
      .run(1, suggestion.id);
    const inboxAfterDue = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxAfterDue.json().total).toBe(1);

    const dismissRes = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/dismiss`,
      headers: { 'x-user-id': USER_ID },
      payload: { reason: 'not_relevant' },
    });
    expect(dismissRes.statusCode).toBe(200);
    expect(dismissRes.json().skill.status).toBe('dismissed');
    expect(dismissRes.json().skill.dismissReason).toBe('not_relevant');

    const inboxAfterDismiss = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxAfterDismiss.json().total).toBe(0);

    const dismissedList = await app.inject({
      method: 'GET',
      url: '/api/v1/skills?filter=dismissed',
      headers: { 'x-user-id': USER_ID },
    });
    expect(dismissedList.json().total).toBe(1);

    const activeSuggestion = await createSuggestion({
      slug: 'active-cannot-dismiss',
      title: 'Active Cannot Dismiss',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${activeSuggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });
    const dismissActive = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${activeSuggestion.id}/dismiss`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });
    expect(dismissActive.statusCode).toBe(400);
    expect(dismissActive.json().error).toMatch(/Only suggestions/);
  });

  it('deduplicates repeated suggestions by cluster and dismissal cooldown', async () => {
    const first = await createSuggestion({
      slug: 'clustered-skill',
      title: 'Clustered Skill',
      suggestionClusterKey: 'flight:clustered-skill',
      notify: true,
    });

    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
      payload: {
        slug: 'renamed-clustered-skill',
        title: 'Renamed Clustered Skill',
        summary: 'Same source cluster should not create another inbox card.',
        suggestionClusterKey: 'flight:clustered-skill',
        notify: true,
      },
    });
    expect(duplicateRes.statusCode).toBe(201);
    expect(duplicateRes.json().skill.id).toBe(first.id);

    const context = userContextManager.getContext(USER_ID);
    const notificationCount = context.db
      .prepare(
        "SELECT COUNT(*) AS count FROM notification_records WHERE type = 'skill_suggestion'",
      )
      .get() as { count: number };
    expect(notificationCount.count).toBe(1);

    const inboxAfterDuplicate = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxAfterDuplicate.json().total).toBe(1);

    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${first.id}/dismiss`,
      headers: { 'x-user-id': USER_ID },
      payload: { reason: 'not_useful' },
    });

    const cooledDuplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
      payload: {
        slug: 'clustered-skill-again',
        title: 'Clustered Skill Again',
        suggestionClusterKey: 'flight:clustered-skill',
      },
    });
    expect(cooledDuplicate.statusCode).toBe(201);
    expect(cooledDuplicate.json().skill).toMatchObject({
      id: first.id,
      status: 'dismissed',
    });

    const inboxAfterCooldownSuppression = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
    });
    expect(inboxAfterCooldownSuppression.json().total).toBe(0);

    const oldDismissedAt = Math.floor(Date.now() / 1000) - 31 * 86400;
    context.db
      .prepare('UPDATE personal_skills SET dismissed_at = ?, updated_at = ? WHERE id = ?')
      .run(oldDismissedAt, oldDismissedAt, first.id);

    const revivedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
      payload: {
        slug: 'clustered-skill',
        title: 'Clustered Skill',
        suggestionClusterKey: 'flight:clustered-skill',
      },
    });
    expect(revivedRes.statusCode).toBe(201);
    expect(revivedRes.json().skill.id).not.toBe(first.id);
    expect(revivedRes.json().skill.slug).toBe('clustered-skill-2');
    expect(revivedRes.json().skill.status).toBe('suggestion');
  });

  it('blocks share generation when skill content looks secret-bearing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/suggestions',
      headers: { 'x-user-id': USER_ID },
      payload: {
        slug: 'secret-skill',
        title: 'Secret Skill',
        summary: 'Should not be shareable.',
        skillMd: 'Use apiKey = "abcdefghijklmnopqrstuvwxyz123456" for this workflow.',
      },
    });
    const suggestion = res.json().skill;
    await app.inject({
      method: 'POST',
      url: `/api/v1/skills/suggestions/${suggestion.id}/use`,
      headers: { 'x-user-id': USER_ID },
      payload: {},
    });

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${suggestion.id}`,
      headers: { 'x-user-id': USER_ID },
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().skill.share).toBeUndefined();
    expect(detailRes.json().skill.shareError).toMatch(/secret/i);
  });
});
