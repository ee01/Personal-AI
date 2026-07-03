import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const assistMock = vi.hoisted(() => vi.fn());

vi.mock('../core/ComposerAssistService.js', () => ({
  ComposerAssistService: vi.fn().mockImplementation(() => ({
    assist: assistMock,
  })),
}));

import { composerAssistRoutes } from '../routes/composerAssist.js';
import type { ComposerAssistResponse } from '../types/index.js';

const requestPayload = {
  surface: 'ringcentral_message',
  contextType: 'message_thread',
  debug: true,
};

function successResponse(): ComposerAssistResponse {
  return {
    available: true,
    suggestionType: 'reply_context',
    title: 'Ready',
    summary: 'Ready',
    insertText: 'Ready',
    evidence: [],
    riskLevel: 'low',
    previewRequired: false,
    confidence: 0.8,
    queryTimeMs: 1,
  };
}

async function buildRouteOnlyApp() {
  const app = Fastify();
  app.addHook('preHandler', async (request) => {
    (request as any).userContext = { db: {} };
    (request as any).userId = 'test.user';
  });
  await app.register(composerAssistRoutes);
  await app.ready();
  return app;
}

describe('Composer Assist route guard', () => {
  afterEach(() => {
    delete process.env.COMPOSER_ASSIST_MAX_CONCURRENT;
    delete process.env.COMPOSER_ASSIST_ROUTE_TIMEOUT_MS;
    assistMock.mockReset();
  });

  it('returns a quick busy fallback when another compose request is active', async () => {
    process.env.COMPOSER_ASSIST_MAX_CONCURRENT = '1';
    const app = await buildRouteOnlyApp();
    let resolveFirst:
      | ((value: ComposerAssistResponse) => void)
      | undefined;

    assistMock
      .mockImplementationOnce(
        () =>
          new Promise<ComposerAssistResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(successResponse());

    const firstRequest = app.inject({
      method: 'POST',
      url: '/composer/assist',
      payload: requestPayload,
    });
    await vi.waitFor(() => expect(assistMock).toHaveBeenCalledTimes(1));

    const busy = await app.inject({
      method: 'POST',
      url: '/composer/assist',
      payload: requestPayload,
    });

    expect(busy.statusCode).toBe(200);
    expect(busy.headers['retry-after']).toBe('2');
    expect(busy.json()).toMatchObject({
      available: false,
      suggestionType: 'none',
      debug: {
        rejectedReason: 'composer_assist_busy',
        activeRequests: 1,
        maxConcurrent: 1,
      },
    });
    expect(assistMock).toHaveBeenCalledTimes(1);

    resolveFirst?.(successResponse());
    expect((await firstRequest).statusCode).toBe(200);
    await app.close();
  });
});
