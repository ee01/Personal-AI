/**
 * WEBPAGE_ANALYSIS_VIA_LOCAL_KEY gate tests (2026-08-25 client-side-first
 * policy, enforced per the memory-foundation cost work):
 *   default → backend route DISABLED (typed 403, no LLM spend)
 *   false   → route re-enabled as explicit fallback (schema still applies)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generate: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    generateJSON: vi.fn().mockResolvedValue({ decision: 'skip' }),
    getTargetHealthSnapshot: () => [],
  }),
  LLMClient: vi.fn(),
}));


import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { resetConfigForTests } from '../config.js';

const VALID_BODY = {
  url: 'https://example.com/article',
  title: 'Example article',
  mainContent: 'A'.repeat(200),
  interactionSignals: {},
  entityHints: [],
};

describe('WEBPAGE_ANALYSIS_VIA_LOCAL_KEY gate', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeEach(async () => {
    db = getTestDb();
    delete process.env.WEBPAGE_ANALYSIS_VIA_LOCAL_KEY;
    // The synced production .env sets WEBPAGE_ANALYSIS_MODEL — clear it so
    // resolveWebpageAnalysisLlmClient returns the mocked default client.
    process.env.WEBPAGE_ANALYSIS_MODEL = '';
    resetConfigForTests();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.WEBPAGE_ANALYSIS_VIA_LOCAL_KEY;
  });

  it('default: backend route disabled with a typed 403 and no LLM spend', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/webpage-analysis',
      payload: VALID_BODY,
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body).toMatchObject({
      error: 'webpage_analysis_backend_disabled',
      viaLocalKey: true,
      reason: 'webpage_analysis_runs_client_side',
    });
  });

  it('explicit "true" behaves the same as default', async () => {
    process.env.WEBPAGE_ANALYSIS_VIA_LOCAL_KEY = 'true';
    resetConfigForTests();
    const result = await buildApp({ db });
    const res = await result.app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/webpage-analysis',
      payload: VALID_BODY,
    });
    expect(res.statusCode).toBe(403);
    await result.app.close();
  });

  it('false re-enables the route (proceeds past the gate to the quota/LLM path)', async () => {
    process.env.WEBPAGE_ANALYSIS_VIA_LOCAL_KEY = 'false';
    resetConfigForTests();
    const result = await buildApp({ db });
    const res = await result.app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/webpage-analysis',
      payload: VALID_BODY,
    });
    // Past the gate: the mocked LLM returns a skip decision.
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('promptVersion');
    await result.app.close();
  });
});
