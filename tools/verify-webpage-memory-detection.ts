import assert from 'node:assert/strict';

import {
  CONTEXT_SITE_MUTE_TTL_MS,
  formatContextSiteMuteRemaining,
  getContextSiteMuteExpiresAt,
  hasSensitiveUrlSignal,
  isLowValueContextHost,
  isSensitiveControlDescriptor,
  isContextSiteMuteActive,
  normalizeContextSiteMuteHost,
  normalizeContextPageUrl,
  pruneContextSiteMuteRecord,
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from '../src/web-intelligence/contextRecallGuards';

assert.equal(
  sanitizeContextExternalUrl('https://example.com/source?a=1'),
  'https://example.com/source?a=1',
);
assert.equal(
  sanitizeContextExternalUrl('/source', 'https://example.com/page'),
  'https://example.com/source',
);
assert.equal(sanitizeContextExternalUrl('javascript:alert(1)'), null);
assert.equal(sanitizeContextExternalUrl('data:text/html,hello'), null);

assert.equal(sanitizeExploreRoute('#/timeline?focus=abc'), '#/timeline?focus=abc');
assert.equal(sanitizeExploreRoute('memory-exploring.html#/timeline'), null);
assert.equal(sanitizeExploreRoute('javascript:alert(1)'), null);
assert.equal(sanitizeExploreRoute('#/timeline\n?focus=abc'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=abc%20def'), '#/timeline?focus=abc%20def');
assert.equal(sanitizeExploreRoute('#/timeline?focus=abc" onclick="alert(1)'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=<img>'), null);
assert.equal(sanitizeExploreRoute('#/timeline?focus=`template`'), null);

assert.equal(isLowValueContextHost('www.google.com'), true);
assert.equal(isLowValueContextHost('m.youtube.com'), true);
assert.equal(isLowValueContextHost('docs.google.com'), false);
assert.equal(isLowValueContextHost('notgoogle.com'), false);

assert.equal(
  normalizeContextPageUrl(
    'https://user:pass@example.com/docs?utm_source=mail&b=2&a=1&fbclid=abc#section',
  ),
  'https://example.com/docs?a=1&b=2',
);
assert.equal(
  normalizeContextPageUrl('https://example.com/callback?code=oauth-code'),
  null,
);
assert.equal(normalizeContextPageUrl('javascript:alert(1)'), null);

assert.equal(hasSensitiveUrlSignal('https://example.com/login'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/settings/password'), true);
assert.equal(hasSensitiveUrlSignal('https://login.example.com/dashboard'), true);
assert.equal(hasSensitiveUrlSignal('https://billing.example.com/dashboard'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/oauth/callback'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/callback?code=abc'), true);
assert.equal(hasSensitiveUrlSignal('https://example.com/wiki/authentication-design'), false);
assert.equal(hasSensitiveUrlSignal('https://auth0.com/docs'), false);
assert.equal(hasSensitiveUrlSignal('https://example.com/wiki/project-falcon'), false);

assert.equal(isSensitiveControlDescriptor({ type: 'password' }), true);
assert.equal(
  isSensitiveControlDescriptor({ autocomplete: 'one-time-code' }),
  true,
);
assert.equal(
  isSensitiveControlDescriptor({ name: 'jira-search-query', type: 'search' }),
  false,
);

const now = 1_700_000_000_000;
assert.equal(normalizeContextSiteMuteHost(' Example.COM. '), 'example.com');
assert.equal(isContextSiteMuteActive(now - 1_000, now), true);
assert.equal(isContextSiteMuteActive(now - CONTEXT_SITE_MUTE_TTL_MS - 1, now), false);
assert.equal(getContextSiteMuteExpiresAt(now), now + CONTEXT_SITE_MUTE_TTL_MS);
assert.equal(formatContextSiteMuteRemaining(now - 2 * 60 * 60 * 1000, now), '22 小时后恢复');
assert.deepEqual(
  pruneContextSiteMuteRecord(
    {
      ' Example.COM. ': now - 1_000,
      'expired.example': now - CONTEXT_SITE_MUTE_TTL_MS - 1,
      invalid: 'not-number',
    },
    now,
  ),
  {
    record: { 'example.com': now - 1_000 },
    changed: true,
  },
);

console.log('[verify-webpage-memory-detection] helper checks passed');
