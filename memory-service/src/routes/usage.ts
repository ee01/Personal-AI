/**
 * Usage analytics routes (registered under /api/v1).
 *
 *   POST /usage/telemetry   — ingest frontend usage events (normal user auth).
 *   POST /usage/my-link     — issue HMAC dashboard link (self via X-User-Id;
 *                             all requires ANALYTICS_ADMIN_TOKEN).
 *   GET  /usage/report      — aggregated report (admin token or signed token).
 *   GET  /usage/users       — active users (admin/all) or self only (self).
 *   GET  /usage/dashboard   — HTML report (admin token or signed token).
 *
 * Auth:
 * - ANALYTICS_ADMIN_TOKEN (header/query) ⇒ scope=all
 * - HMAC signed token (header/query) ⇒ scope=self|all from claims
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { getConfig } from '../config.js';
import {
  getAnalyticsStore,
  isAnalyticsCorruptionError,
  type AnalyticsStore,
  type DailyActivityRow,
  type ErrorKindAggregateRow,
  type UsageAggregateRow,
  type UsageSide,
} from '../analytics/AnalyticsStore.js';
import {
  CAPABILITY_LABELS_ZH,
  normalizeCapability,
  type CapabilityKey,
} from '../analytics/capabilityMap.js';
import { estimateCostUsd } from '../analytics/pricing.js';

/** Background-feature LLM token alert threshold for a single UTC day. */
const BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS = parsePositiveIntEnv(
  process.env.BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS,
  200_000,
);

function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
import { renderDashboardHtml } from '../analytics/dashboard.js';
import {
  signUsageToken,
  verifyUsageToken,
  type UsageTokenScope,
} from '../analytics/usageToken.js';
import { isValidUserId } from '../utils/userIdentity.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelemetryEvent {
  ts?: number;
  side?: string;
  capability?: string;
  feature?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  status?: string;
  errorKind?: string;
  route?: string;
  requestId?: string;
}

interface TelemetryBody {
  events?: TelemetryEvent[];
}

type ReportRange = '24h' | '7d' | '30d';
type SideFilter = 'all' | UsageSide;

interface AggregateBucket {
  callCount: number;
  failCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estCostUsd: number;
}

interface CapabilityReportRow extends AggregateBucket {
  capability: CapabilityKey;
  label: string;
  apiCallCount: number;
  usageCount: number;
  userCount: number;
  bySide: Record<UsageSide, AggregateBucket>;
  features?: Array<{
    detail: string;
    detailKind: 'feature' | 'route';
    side: UsageSide;
    callCount: number;
    failCount: number;
    totalTokens: number;
    estCostUsd: number;
  }>;
}

interface UserReportRow {
  userId: string;
  llmCallCount: number;
  apiCallCount: number;
  usageCount: number;
  totalTokens: number;
  estCostUsd: number;
  lastTs: number;
  topCapabilities: Array<{
    capability: CapabilityKey;
    label: string;
    usageCount: number;
  }>;
}

interface UsageReport {
  range: ReportRange;
  user: string;
  side: SideFilter;
  viewer: {
    scope: UsageTokenScope;
    userId: string | null;
  };
  generatedAt: number;
  windowStart: number;
  totals: AggregateBucket & { flaggedCost: boolean; apiCallCount: number };
  byCapability: CapabilityReportRow[];
  byModel: Array<{ model: string; flagged: boolean } & AggregateBucket>;
  bySide: Record<UsageSide, AggregateBucket>;
  byUser: UserReportRow[];
  /** Failure counts by errorKind/side/capability (B9 follow-up: dashboard-visible). */
  errorBreakdown: ErrorKindAggregateRow[];
  /**
   * Background (scheduler-driven) feature whose token burn today exceeds
   * BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS — the guardrail that would have
   * caught the reflection-default-enabled incident (see
   * docs/features/usage_analytics.md, 成本治理与 2026-08 事故复盘) days earlier.
   */
  backgroundLlmAlerts: Array<{
    feature: string;
    capability: CapabilityKey;
    totalTokens: number;
    thresholdTokens: number;
  }>;
  userCapabilityMatrix: {
    users: string[];
    capabilities: Array<{ capability: CapabilityKey; label: string }>;
    cells: number[][];
    tokenCells: number[][];
  } | null;
  dailyActivity: DailyActivityRow[];
  apiCalls: {
    total: number;
    byCapability: Array<{ capability: CapabilityKey; count: number }>;
    byRoute: Array<{ route: string; count: number }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rangeToMs(range: ReportRange): number {
  if (range === '30d') return 30 * 86_400_000;
  if (range === '7d') return 7 * 86_400_000;
  return 24 * 60 * 60 * 1000;
}

function parseRange(raw: unknown): ReportRange {
  return raw === '30d' ? '30d' : raw === '7d' ? '7d' : '24h';
}

function parseSide(raw: unknown): SideFilter {
  return raw === 'frontend' || raw === 'backend' ? raw : 'all';
}

function emptyBucket(): AggregateBucket {
  return {
    callCount: 0,
    failCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estCostUsd: 0,
  };
}

function labelFor(capability: CapabilityKey): string {
  return CAPABILITY_LABELS_ZH[capability] || capability;
}

/**
 * Prefer live pricing recompute so historical rows (e.g. deepseek-v4-pro before
 * it was added to MODEL_PRICING) still show non-zero cost in the report.
 */
function pricedCost(row: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  estCostUsd: number;
}): { cost: number; flagged: boolean } {
  const estimate = estimateCostUsd(
    row.model,
    row.promptTokens,
    row.completionTokens,
  );
  if (!estimate.flagged) {
    return { cost: estimate.estCostUsd, flagged: false };
  }
  return { cost: row.estCostUsd || 0, flagged: true };
}

function addToBucket(
  bucket: AggregateBucket,
  row: Pick<
    UsageAggregateRow,
    'callCount' | 'failCount' | 'promptTokens' | 'completionTokens'
  >,
  cost: number,
): void {
  bucket.callCount += row.callCount;
  bucket.failCount += row.failCount || 0;
  bucket.promptTokens += row.promptTokens;
  bucket.completionTokens += row.completionTokens;
  bucket.totalTokens += row.promptTokens + row.completionTokens;
  bucket.estCostUsd += cost;
}

/** Extract token from X-Analytics-Token header or ?token= query. */
function extractProvidedToken(request: FastifyRequest): string {
  const headerToken = request.headers['x-analytics-token'];
  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  const queryToken = (request.query as { token?: string } | undefined)?.token;
  return String(headerValue || queryToken || '').trim();
}

/** True when the raw ANALYTICS_ADMIN_TOKEN matches (break-glass all scope). */
function isAdminToken(provided: string): boolean {
  const configured = getConfig().analyticsAdminToken;
  return Boolean(configured) && provided === configured;
}

export interface AnalyticsViewer {
  scope: UsageTokenScope;
  userId: string | null;
  /** Token string to embed in dashboard HTML / subsequent fetches. */
  token: string;
}

/**
 * Resolve viewer from admin token or signed HMAC token.
 * Returns null when unauthorized.
 */
function resolveAnalyticsViewer(
  request: FastifyRequest,
): AnalyticsViewer | null {
  const provided = extractProvidedToken(request);
  if (!provided) return null;

  if (isAdminToken(provided)) {
    return { scope: 'all', userId: null, token: provided };
  }

  const secret = getConfig().analyticsTokenSecret;
  const claims = verifyUsageToken(provided, secret);
  if (!claims) return null;
  return {
    scope: claims.scope,
    userId: claims.userId,
    token: provided,
  };
}

function requireAnalyticsViewer(
  request: FastifyRequest,
  reply: FastifyReply,
): AnalyticsViewer | null {
  const viewer = resolveAnalyticsViewer(request);
  if (viewer) return viewer;
  reply
    .status(401)
    .send({ error: 'Unauthorized: invalid analytics token' });
  return null;
}

/**
 * Pricing management is admin-only — a `scope=self` link must never see or
 * change the price table (it would also leak into every self viewer's cost
 * totals via the shared override map).
 */
function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (isAdminToken(extractProvidedToken(request))) return true;
  reply.status(401).send({
    error: 'Unauthorized: ANALYTICS_ADMIN_TOKEN required',
  });
  return false;
}

/**
 * Force the report user filter under the viewer's scope.
 * self ⇒ always token.userId (ignore query user=).
 * all  ⇒ honor query, default 'all'.
 */
/**
 * A damaged usage.db is an operations problem, not a bug in the caller's
 * request: answer 503 with the repair command instead of a bare 500.
 */
function replyAnalyticsUnavailable(
  reply: FastifyReply,
  err: unknown,
): FastifyReply {
  const store = getAnalyticsStore();
  store?.markCorruptIfNeeded(err);
  return reply.status(503).send({
    error: 'analytics_store_corrupt',
    message:
      'Usage analytics database is damaged. Run "npm --prefix memory-service run repair:analytics" on the service host to salvage it.',
  });
}

function resolveReportUser(
  viewer: AnalyticsViewer,
  requestedUser: string | undefined,
): string {
  if (viewer.scope === 'self') {
    return viewer.userId || 'unknown';
  }
  return requestedUser?.trim() || 'all';
}

function buildReport(
  store: AnalyticsStore,
  range: ReportRange,
  user: string,
  nowMs: number,
  sideFilter: SideFilter = 'all',
  viewer: AnalyticsViewer = { scope: 'all', userId: null, token: '' },
): UsageReport {
  const sinceMs = nowMs - rangeToMs(range);
  const userFilter = user === 'all' ? undefined : user;

  const usageRows = store
    .getUsageAggregate({
      sinceMs,
      nowMs,
      userId: userFilter,
    })
    .filter((row) => sideFilter === 'all' || row.side === sideFilter);

  const totals = emptyBucket();
  type CapAcc = {
    total: AggregateBucket;
    bySide: Record<UsageSide, AggregateBucket>;
  };
  const byCapability = new Map<CapabilityKey, CapAcc>();
  const byModel = new Map<string, AggregateBucket>();
  const flaggedModels = new Set<string>();
  const bySide: Record<UsageSide, AggregateBucket> = {
    frontend: emptyBucket(),
    backend: emptyBucket(),
  };
  let flaggedCost = false;

  for (const row of usageRows) {
    const { cost, flagged } = pricedCost(row);
    if (flagged) flaggedCost = true;
    addToBucket(totals, row, cost);
    addToBucket(bySide[row.side], row, cost);

    const capAcc = byCapability.get(row.capability) ?? {
      total: emptyBucket(),
      bySide: { frontend: emptyBucket(), backend: emptyBucket() },
    };
    addToBucket(capAcc.total, row, cost);
    addToBucket(capAcc.bySide[row.side], row, cost);
    byCapability.set(row.capability, capAcc);

    const modelKey = row.model || 'unknown';
    if (flagged) flaggedModels.add(modelKey);
    const modelBucket = byModel.get(modelKey) ?? emptyBucket();
    addToBucket(modelBucket, row, cost);
    byModel.set(modelKey, modelBucket);
  }

  const includeApi = sideFilter !== 'frontend';
  const apiRows = includeApi
    ? store.getApiCallAggregate({
        sinceMs,
        nowMs,
        userId: userFilter,
      })
    : [];
  const apiByCapability = new Map<CapabilityKey, number>();
  const apiByRoute = new Map<string, number>();
  let apiTotal = 0;
  for (const row of apiRows) {
    apiTotal += row.count;
    apiByCapability.set(
      row.capability,
      (apiByCapability.get(row.capability) ?? 0) + row.count,
    );
    apiByRoute.set(row.route, (apiByRoute.get(row.route) ?? 0) + row.count);
  }

  const featureRows = store.getCapabilityFeatureAggregate({
    sinceMs,
    nowMs,
    userId: userFilter,
    side: sideFilter,
  });
  const featuresByCapability = new Map<
    CapabilityKey,
    CapabilityReportRow['features']
  >();
  for (const row of featureRows) {
    const list = featuresByCapability.get(row.capability) ?? [];
    list.push({
      detail: row.detail,
      detailKind: row.detailKind,
      side: row.side,
      callCount: row.callCount,
      failCount: row.failCount,
      totalTokens: row.promptTokens + row.completionTokens,
      estCostUsd: row.estCostUsd,
    });
    featuresByCapability.set(row.capability, list);
  }

  // Global user×capability aggregates (for userCount / byUser / matrix).
  const userCapLlm = store.getUserCapabilityAggregate({ sinceMs, nowMs });
  const userCapApi = includeApi
    ? store.getApiCallUserCapabilityAggregate({ sinceMs, nowMs })
    : [];

  const usersByCapability = new Map<CapabilityKey, Set<string>>();
  const usageByUserCap = new Map<
    string,
    Map<CapabilityKey, { usage: number; tokens: number; cost: number }>
  >();
  const userTotals = new Map<
    string,
    {
      llm: number;
      api: number;
      tokens: number;
      cost: number;
    }
  >();

  const touchUserCap = (
    userId: string,
    capability: CapabilityKey,
    patch: { usage?: number; tokens?: number; cost?: number },
  ) => {
    let caps = usageByUserCap.get(userId);
    if (!caps) {
      caps = new Map();
      usageByUserCap.set(userId, caps);
    }
    const cell = caps.get(capability) ?? { usage: 0, tokens: 0, cost: 0 };
    cell.usage += patch.usage ?? 0;
    cell.tokens += patch.tokens ?? 0;
    cell.cost += patch.cost ?? 0;
    caps.set(capability, cell);

    let users = usersByCapability.get(capability);
    if (!users) {
      users = new Set();
      usersByCapability.set(capability, users);
    }
    users.add(userId);
  };

  for (const row of userCapLlm) {
    if (userFilter && row.userId !== userFilter) continue;
    // Side-filtered reports still use global user×cap for ranking when side=all;
    // for frontend/backend filter we only count LLM usage (no side split in this aggregate).
    touchUserCap(row.userId, row.capability, {
      usage: row.llmCallCount,
      tokens: row.promptTokens + row.completionTokens,
      cost: row.estCostUsd,
    });
    const totalsRow = userTotals.get(row.userId) ?? {
      llm: 0,
      api: 0,
      tokens: 0,
      cost: 0,
    };
    totalsRow.llm += row.llmCallCount;
    totalsRow.tokens += row.promptTokens + row.completionTokens;
    totalsRow.cost += row.estCostUsd;
    userTotals.set(row.userId, totalsRow);
  }

  for (const row of userCapApi) {
    if (userFilter && row.userId !== userFilter) continue;
    touchUserCap(row.userId, row.capability, { usage: row.count });
    const totalsRow = userTotals.get(row.userId) ?? {
      llm: 0,
      api: 0,
      tokens: 0,
      cost: 0,
    };
    totalsRow.api += row.count;
    userTotals.set(row.userId, totalsRow);
  }

  // Merge API-only capabilities into byCapability (empty LLM buckets).
  if (includeApi) {
    for (const [capability] of apiByCapability) {
      if (!byCapability.has(capability)) {
        byCapability.set(capability, {
          total: emptyBucket(),
          bySide: { frontend: emptyBucket(), backend: emptyBucket() },
        });
      }
    }
  }

  const capabilityRows: CapabilityReportRow[] = [...byCapability.entries()]
    .map(([capability, acc]) => {
      const apiCallCount = includeApi
        ? apiByCapability.get(capability) ?? 0
        : 0;
      const usageCount =
        sideFilter === 'frontend'
          ? acc.total.callCount
          : acc.total.callCount + apiCallCount;
      return {
        capability,
        label: labelFor(capability),
        ...acc.total,
        apiCallCount,
        usageCount,
        userCount: usersByCapability.get(capability)?.size ?? 0,
        bySide: acc.bySide,
        features: featuresByCapability.get(capability) ?? [],
      };
    })
    .sort(
      (a, b) =>
        b.usageCount - a.usageCount || b.totalTokens - a.totalTokens,
    );

  const activeUsers = store.getActiveUsers(sinceMs);
  const lastTsByUser = new Map(
    activeUsers.map((row) => [row.userId, row.lastTs]),
  );

  let byUser: UserReportRow[] = [];
  let userCapabilityMatrix: UsageReport['userCapabilityMatrix'] = null;

  if (user === 'all') {
    byUser = [...userTotals.entries()]
      .map(([userId, totalsRow]) => {
        const caps = usageByUserCap.get(userId) ?? new Map();
        const topCapabilities = [...caps.entries()]
          .map(([capability, cell]) => ({
            capability,
            label: labelFor(capability),
            usageCount: cell.usage,
          }))
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 3);
        return {
          userId,
          llmCallCount: totalsRow.llm,
          apiCallCount: totalsRow.api,
          usageCount: totalsRow.llm + totalsRow.api,
          totalTokens: totalsRow.tokens,
          estCostUsd: totalsRow.cost,
          lastTs: lastTsByUser.get(userId) ?? 0,
          topCapabilities,
        };
      })
      .sort((a, b) => b.usageCount - a.usageCount);

    const matrixCaps = capabilityRows.slice(0, 10);
    const matrixUsers = byUser.slice(0, 15);
    const cells: number[][] = [];
    const tokenCells: number[][] = [];
    for (const u of matrixUsers) {
      const caps = usageByUserCap.get(u.userId) ?? new Map();
      cells.push(
        matrixCaps.map((c) => caps.get(c.capability)?.usage ?? 0),
      );
      tokenCells.push(
        matrixCaps.map((c) => caps.get(c.capability)?.tokens ?? 0),
      );
    }
    userCapabilityMatrix = {
      users: matrixUsers.map((u) => u.userId),
      capabilities: matrixCaps.map((c) => ({
        capability: c.capability,
        label: c.label,
      })),
      cells,
      tokenCells,
    };
  }

  const sortByCost = (a: AggregateBucket, b: AggregateBucket): number =>
    b.estCostUsd - a.estCostUsd || b.totalTokens - a.totalTokens;

  const errorBreakdown = store.getErrorKindAggregate({
    sinceMs,
    nowMs,
    userId: userFilter,
  });

  // Background-LLM alert always looks at "today" (UTC), independent of the
  // requested report range — a same-day burn spike is the thing worth
  // surfacing immediately, not something to wait for a 7d/30d window to show.
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);
  const backgroundLlmAlerts = store
    .getBackgroundLlmDailyTotals(todayStr)
    .filter((row) => row.totalTokens > BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS)
    .map((row) => ({
      feature: row.feature,
      capability: row.capability,
      totalTokens: row.totalTokens,
      thresholdTokens: BACKGROUND_LLM_ALERT_THRESHOLD_TOKENS,
    }));

  return {
    range,
    user,
    side: sideFilter,
    viewer: {
      scope: viewer.scope,
      userId: viewer.scope === 'self' ? viewer.userId : null,
    },
    generatedAt: nowMs,
    windowStart: sinceMs,
    totals: { ...totals, flaggedCost, apiCallCount: apiTotal },
    byCapability: capabilityRows,
    byModel: [...byModel.entries()]
      .map(([model, bucket]) => ({ model, flagged: flaggedModels.has(model), ...bucket }))
      .sort(sortByCost),
    bySide,
    byUser,
    userCapabilityMatrix,
    dailyActivity: store.getDailyActivity({
      sinceMs,
      nowMs,
      userId: userFilter,
    }),
    apiCalls: {
      total: apiTotal,
      byCapability: [...apiByCapability.entries()]
        .map(([capability, count]) => ({ capability, count }))
        .sort((a, b) => b.count - a.count),
      byRoute: [...apiByRoute.entries()]
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50),
    },
    errorBreakdown,
    backgroundLlmAlerts,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

const telemetryBodySchema = {
  type: 'object' as const,
  properties: {
    events: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          ts: { type: 'number' as const },
          side: { type: 'string' as const },
          capability: { type: 'string' as const },
          feature: { type: 'string' as const },
          model: { type: 'string' as const },
          promptTokens: { type: 'number' as const },
          completionTokens: { type: 'number' as const },
          status: { type: 'string' as const },
          errorKind: { type: 'string' as const },
          route: { type: 'string' as const },
          requestId: { type: 'string' as const },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TelemetryBody }>(
    '/usage/telemetry',
    { schema: { body: telemetryBodySchema } },
    async (request, reply) => {
      const store = getAnalyticsStore();
      if (!store) {
        return reply.status(503).send({ error: 'Analytics store unavailable' });
      }

      const events = Array.isArray(request.body?.events)
        ? request.body.events
        : [];
      const userId = request.userId ?? 'unknown';

      let ingested = 0;
      for (const event of events) {
        if (!event || typeof event !== 'object') continue;
        const side: UsageSide = event.side === 'backend' ? 'backend' : 'frontend';
        store.recordUsageEvent({
          ts: event.ts,
          userId,
          side,
          capability: normalizeCapability(event.capability),
          feature: event.feature ?? null,
          route: event.route ?? null,
          model: event.model ?? null,
          promptTokens: event.promptTokens ?? 0,
          completionTokens: event.completionTokens ?? 0,
          status: event.status === 'error' ? 'error' : 'ok',
          errorKind: event.errorKind ?? null,
          requestId: event.requestId ?? null,
        });
        ingested += 1;
      }

      return reply.status(200).send({ status: 'ok', ingested });
    },
  );

  app.post<{
    Body: { scope?: string; ttlDays?: number };
  }>('/usage/my-link', async (request, reply) => {
    const scopeRaw = request.body?.scope === 'all' ? 'all' : 'self';
    const secret = getConfig().analyticsTokenSecret;
    if (!secret) {
      return reply.status(503).send({
        error: 'Analytics token secret is not configured',
      });
    }

    let userId: string;
    let scope: UsageTokenScope;

    if (scopeRaw === 'all') {
      // Issuing all-scope requires the admin break-glass token in header.
      const adminProvided = extractProvidedToken(request);
      if (!isAdminToken(adminProvided)) {
        return reply.status(401).send({
          error:
            'Unauthorized: ANALYTICS_ADMIN_TOKEN required to issue all-scope link',
        });
      }
      userId = String(request.userId || '').trim() || 'admin';
      if (!isValidUserId(userId)) userId = 'admin';
      scope = 'all';
    } else {
      userId = String(request.userId || '').trim();
      if (!isValidUserId(userId) || userId === 'default') {
        return reply.status(400).send({
          error: 'Valid X-User-Id is required to issue a personal usage link',
        });
      }
      scope = 'self';
    }

    try {
      const { token, claims } = signUsageToken({
        userId,
        scope,
        secret,
        ttlDays: request.body?.ttlDays,
      });
      const path = `/usage/dashboard?token=${encodeURIComponent(token)}`;
      return reply.status(200).send({
        status: 'ok',
        token,
        path,
        scope: claims.scope,
        userId: claims.userId,
        expiresAt: claims.expiresAt,
      });
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Failed to issue token',
      });
    }
  });

  app.get<{
    Querystring: { range?: string; user?: string; side?: string; token?: string };
  }>('/usage/report', async (request, reply) => {
    const viewer = requireAnalyticsViewer(request, reply);
    if (!viewer) return reply;
    const store = getAnalyticsStore();
    if (!store) {
      return reply.status(503).send({ error: 'Analytics store unavailable' });
    }
    const range = parseRange(request.query.range);
    const user = resolveReportUser(viewer, request.query.user);
    const side = parseSide(request.query.side);
    try {
      const report = buildReport(store, range, user, Date.now(), side, viewer);
      return reply.status(200).send(report);
    } catch (err) {
      if (store.isCorrupt || isAnalyticsCorruptionError(err)) {
        return replyAnalyticsUnavailable(reply, err);
      }
      throw err;
    }
  });

  app.get<{ Querystring: { range?: string; token?: string } }>(
    '/usage/users',
    async (request, reply) => {
      const viewer = requireAnalyticsViewer(request, reply);
      if (!viewer) return reply;
      const store = getAnalyticsStore();
      if (!store) {
        return reply.status(503).send({ error: 'Analytics store unavailable' });
      }
      const range = parseRange(request.query.range);
      const sinceMs = Date.now() - rangeToMs(range);
      let users: ReturnType<AnalyticsStore['getActiveUsers']>;
      try {
        users = store.getActiveUsers(sinceMs);
      } catch (err) {
        if (store.isCorrupt || isAnalyticsCorruptionError(err)) {
          return replyAnalyticsUnavailable(reply, err);
        }
        throw err;
      }
      if (viewer.scope === 'self') {
        const selfId = viewer.userId || '';
        const selfOnly = users.filter((u) => u.userId === selfId);
        return reply.status(200).send({
          range,
          viewer: { scope: viewer.scope, userId: viewer.userId },
          users: selfOnly.length
            ? selfOnly
            : selfId
              ? [{ userId: selfId, eventCount: 0, lastTs: 0 }]
              : [],
        });
      }
      return reply.status(200).send({
        range,
        viewer: { scope: viewer.scope, userId: viewer.userId },
        users,
      });
    },
  );

  app.get<{ Querystring: { token?: string } }>(
    '/usage/dashboard',
    async (request, reply) => {
      const viewer = requireAnalyticsViewer(request, reply);
      if (!viewer) return reply;
      reply.type('text/html; charset=utf-8');
      return reply.send(
        renderDashboardHtml(viewer.token, {
          scope: viewer.scope,
          userId: viewer.userId,
        }),
      );
    },
  );

  // ---- Pricing management (admin-only) -----------------------------------

  app.get('/usage/pricing', async (request, reply) => {
    if (!requireAdminToken(request, reply)) return reply;
    const store = getAnalyticsStore();
    if (!store) {
      return reply.status(503).send({ error: 'Analytics store unavailable' });
    }
    try {
      return reply.status(200).send({ pricing: store.getPricingTable() });
    } catch (err) {
      if (store.isCorrupt || isAnalyticsCorruptionError(err)) {
        return replyAnalyticsUnavailable(reply, err);
      }
      throw err;
    }
  });

  const pricingEntrySchema = {
    type: 'object' as const,
    properties: {
      inputPer1M: { type: 'number' as const },
      outputPer1M: { type: 'number' as const },
      cacheReadPer1M: { type: 'number' as const, nullable: true },
      cacheWritePer1M: { type: 'number' as const, nullable: true },
      note: { type: 'string' as const, nullable: true },
    },
    required: ['inputPer1M', 'outputPer1M'],
    additionalProperties: false,
  };

  app.put<{
    Body: Record<
      string,
      {
        inputPer1M: number;
        outputPer1M: number;
        cacheReadPer1M?: number | null;
        cacheWritePer1M?: number | null;
        note?: string | null;
      }
    >;
  }>(
    '/usage/pricing',
    {
      schema: {
        body: {
          type: 'object' as const,
          additionalProperties: pricingEntrySchema,
        },
      },
    },
    async (request, reply) => {
      if (!requireAdminToken(request, reply)) return reply;
      const store = getAnalyticsStore();
      if (!store) {
        return reply.status(503).send({ error: 'Analytics store unavailable' });
      }
      const body = request.body || {};
      const entries = Object.entries(body).map(([model, entry]) => ({
        model,
        inputPer1M: entry.inputPer1M,
        outputPer1M: entry.outputPer1M,
        cacheReadPer1M: entry.cacheReadPer1M ?? null,
        cacheWritePer1M: entry.cacheWritePer1M ?? null,
        note: entry.note ?? null,
      }));
      if (entries.length === 0) {
        return reply.status(400).send({ error: 'No pricing entries provided' });
      }
      try {
        store.upsertPricing(entries);
        return reply.status(200).send({ status: 'ok', updated: entries.map((e) => e.model) });
      } catch (err) {
        if (store.isCorrupt || isAnalyticsCorruptionError(err)) {
          return replyAnalyticsUnavailable(reply, err);
        }
        throw err;
      }
    },
  );

  app.get<{ Querystring: { range?: string; token?: string } }>(
    '/usage/pricing/unpriced',
    async (request, reply) => {
      if (!requireAdminToken(request, reply)) return reply;
      const store = getAnalyticsStore();
      if (!store) {
        return reply.status(503).send({ error: 'Analytics store unavailable' });
      }
      const range = parseRange(request.query.range);
      const sinceMs = Date.now() - rangeToMs(range);
      try {
        return reply.status(200).send({ range, models: store.getUnpricedModels(sinceMs) });
      } catch (err) {
        if (store.isCorrupt || isAnalyticsCorruptionError(err)) {
          return replyAnalyticsUnavailable(reply, err);
        }
        throw err;
      }
    },
  );
}
