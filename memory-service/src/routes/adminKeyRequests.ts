/**
 * Admin UI + API for approving device-key requests across users.
 *
 * Auth: ADMIN_API_TOKEN (falls back to ANALYTICS_ADMIN_TOKEN) via
 * `?token=` or `X-Admin-Token` / `X-Analytics-Token`. Self-authed in the
 * auth middleware so browsers can open the HTML page directly.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';

import { getConfig } from '../config.js';
import {
  decideDeviceKeyRequest,
  listDeviceKeyRequests,
  type DeviceKeyRequestRecord,
} from '../core/auth/deviceKeyRequests.js';
import { upsertIdentityAlias } from '../core/auth/identityAliases.js';
import { hasUserContent, countAllUserApiKeys } from '../core/auth/userClaim.js';
import { listUserApiKeys, revokeUserApiKey } from '../core/auth/userApiKeys.js';
import type { UserContextManager } from '../core/UserContextManager.js';

function expectedAdminToken(): string {
  const config = getConfig();
  return (
    String(config.adminApiToken || '').trim() ||
    String(config.analyticsAdminToken || '').trim()
  );
}

function readProvidedToken(request: FastifyRequest): string {
  const header =
    request.headers['x-admin-token'] || request.headers['x-analytics-token'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }
  const query = (request.query || {}) as { token?: string };
  return String(query.token || '').trim();
}

function tokensMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  const expected = expectedAdminToken();
  if (!expected) {
    reply.code(503).send({
      error: 'admin_token_not_configured',
      message: 'Set ADMIN_API_TOKEN or ANALYTICS_ADMIN_TOKEN.',
    });
    return false;
  }
  if (!tokensMatch(readProvidedToken(request), expected)) {
    reply.code(401).send({ error: 'admin_unauthorized' });
    return false;
  }
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ListedRequest extends DeviceKeyRequestRecord {
  userId: string;
  hasUserContent: boolean;
  keyCount: number;
  activeKeyPrefixes: string[];
}

function collectRequests(ucm: UserContextManager): ListedRequest[] {
  const listed: ListedRequest[] = [];
  for (const userId of ucm.getRegisteredUserIds()) {
    const ctx = ucm.getContext(userId);
    const rows = listDeviceKeyRequests(ctx.db);
    const keys = listUserApiKeys(ctx.db);
    for (const row of rows) {
      listed.push({
        ...row,
        userId,
        hasUserContent: hasUserContent(ctx.db),
        keyCount: countAllUserApiKeys(ctx.db),
        activeKeyPrefixes: keys.map((k) => k.keyPrefix),
      });
    }
  }
  listed.sort((a, b) => b.requestedAt - a.requestedAt);
  return listed;
}

function renderDashboard(token: string, rows: ListedRequest[]): string {
  const pending = rows.filter((r) => r.status === 'pending');
  const others = rows.filter((r) => r.status !== 'pending');
  const renderRow = (row: ListedRequest, showActions: boolean) => {
    const when = new Date(row.requestedAt * 1000).toISOString();
    const actions = showActions
      ? `<form method="POST" action="/api/v1/admin/key-requests/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}/approve?token=${encodeURIComponent(token)}" style="display:inline">
           <input type="hidden" name="revokeOthers" value="1" />
           <button type="submit">Approve + revoke others</button>
         </form>
         <form method="POST" action="/api/v1/admin/key-requests/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}/approve?token=${encodeURIComponent(token)}" style="display:inline">
           <button type="submit">Approve keep keys</button>
         </form>
         <form method="POST" action="/api/v1/admin/key-requests/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}/deny?token=${encodeURIComponent(token)}" style="display:inline">
           <button type="submit">Deny</button>
         </form>`
      : escapeHtml(row.status);
    return `<tr>
      <td><code>${escapeHtml(row.userId)}</code></td>
      <td><code>${escapeHtml(row.id.slice(0, 8))}…</code></td>
      <td>${escapeHtml(when)}</td>
      <td>${escapeHtml(row.googleEmail || '—')}</td>
      <td>${escapeHtml(row.deviceLabel || '—')}</td>
      <td>${escapeHtml(row.ip || '—')}</td>
      <td>${row.hasUserContent ? 'yes' : 'no'} / ${row.keyCount}</td>
      <td>${escapeHtml(row.activeKeyPrefixes.join(', ') || '—')}</td>
      <td>${escapeHtml(row.mismatchReason || '—')}</td>
      <td>${actions}</td>
    </tr>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Device key requests</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    code { font-size: 12px; }
    button { margin: 2px 4px 2px 0; }
    h1 { font-size: 20px; }
    h2 { font-size: 16px; margin-top: 28px; }
    .meta { color: #666; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Device key requests</h1>
  <p class="meta">${pending.length} pending · ${rows.length} total</p>
  <h2>Pending</h2>
  <table>
    <thead>
      <tr>
        <th>userId</th><th>request</th><th>requestedAt</th><th>googleEmail</th>
        <th>device</th><th>ip</th><th>content / keys</th><th>active prefixes</th>
        <th>reason</th><th>action</th>
      </tr>
    </thead>
    <tbody>
      ${pending.map((r) => renderRow(r, true)).join('') || '<tr><td colspan="10">No pending requests</td></tr>'}
    </tbody>
  </table>
  <h2>History</h2>
  <table>
    <thead>
      <tr>
        <th>userId</th><th>request</th><th>requestedAt</th><th>googleEmail</th>
        <th>device</th><th>ip</th><th>content / keys</th><th>active prefixes</th>
        <th>reason</th><th>status</th>
      </tr>
    </thead>
    <tbody>
      ${others.slice(0, 100).map((r) => renderRow(r, false)).join('') || '<tr><td colspan="10">No history</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export async function adminKeyRequestRoutes(
  app: FastifyInstance,
  options: { userContextManager: UserContextManager },
): Promise<void> {
  const { userContextManager: ucm } = options;

  app.get<{ Querystring: { token?: string } }>(
    '/admin/key-requests',
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return reply;
      const token = readProvidedToken(request);
      const accept = String(request.headers.accept || '');
      const rows = collectRequests(ucm);
      if (accept.includes('application/json')) {
        return reply.send({ requests: rows });
      }
      reply.type('text/html').send(renderDashboard(token, rows));
    },
  );

  const decide = async (
    request: FastifyRequest<{
      Params: { userId: string; id: string };
      Querystring: { token?: string; revokeOthers?: string };
      Body?: { revokeOthers?: boolean | string };
    }>,
    reply: FastifyReply,
    decision: 'approved' | 'denied',
  ) => {
    if (!requireAdmin(request, reply)) return reply;
    const userId = String(request.params.userId || '').trim();
    const id = String(request.params.id || '').trim();
    if (!userId || !id) {
      return reply.code(400).send({ error: 'invalid_params' });
    }
    const ctx = ucm.getContext(userId);
    const updated = decideDeviceKeyRequest(
      ctx.db,
      id,
      decision,
      'admin',
    );
    if (!updated) {
      return reply.code(404).send({ error: 'request_not_found_or_not_pending' });
    }

    if (decision === 'approved') {
      if (updated.googleEmail) {
        upsertIdentityAlias(ctx.db, updated.googleEmail, {
          addedBy: 'admin',
          source: 'admin_approval',
        });
      }
      const revokeOthers =
        String(
          request.query?.revokeOthers ||
            (request.body as { revokeOthers?: unknown } | undefined)
              ?.revokeOthers ||
            '',
        ) === '1' ||
        (request.body as { revokeOthers?: unknown } | undefined)?.revokeOthers ===
          true;
      if (revokeOthers) {
        for (const key of listUserApiKeys(ctx.db)) {
          revokeUserApiKey(ctx.db, key.id);
        }
      }
    }

    const accept = String(request.headers.accept || '');
    if (accept.includes('application/json') || request.method === 'POST' && accept.includes('json')) {
      return reply.send({ userId, request: updated });
    }
    // HTML form posts redirect back to the dashboard.
    const token = readProvidedToken(request);
    return reply.redirect(
      `/api/v1/admin/key-requests?token=${encodeURIComponent(token)}`,
    );
  };

  app.post<{
    Params: { userId: string; id: string };
    Querystring: { token?: string; revokeOthers?: string };
    Body?: { revokeOthers?: boolean | string };
  }>('/admin/key-requests/:userId/:id/approve', async (request, reply) =>
    decide(request, reply, 'approved'),
  );

  app.post<{
    Params: { userId: string; id: string };
    Querystring: { token?: string };
  }>('/admin/key-requests/:userId/:id/deny', async (request, reply) =>
    decide(request, reply, 'denied'),
  );
}
