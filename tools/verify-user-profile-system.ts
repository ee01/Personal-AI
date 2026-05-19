import assert from 'node:assert/strict';

import { MemoryServiceClient } from '../src/services/MemoryServiceClient.ts';
import { getProfileItemsForView } from '../src/services/UserProfileMessageHandler.ts';
import {
  buildUserProfileViewModel,
  filterAndSortProfileItems,
  normalizeUserProfilePayload,
} from '../src/services/userProfileViewModel.ts';

function verifyViewModelNormalization() {
  const now = Date.UTC(2026, 4, 2, 10, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const nowSeconds = Math.floor(now / 1000);
  const payload = {
    profile: {
      core: '# USER_CORE\n- Prefers concise status reports',
      items: [
        {
          id: 'profile-1',
          itemType: 'interest',
          itemKey: 'focus_project',
          itemValue: JSON.stringify({ name: 'Personal AI' }),
          confidence: 0.9,
          salienceScore: 0.8,
          mentionCount: 3,
          lastSeen: nowSeconds - 86_400,
          sourceKind: 'explicit',
          userConfirmed: true,
          status: 'active',
        },
        {
          id: 'profile-2',
          itemType: 'fact',
          itemKey: 'stakeholder_person',
          itemValue: 'Ada Chen',
          confidence: 0.7,
          salienceScore: 0.6,
          mentionCount: 2,
          lastSeen: now - 2 * dayMs,
          sourceKind: 'inferred',
          userConfirmed: false,
          status: 'active',
        },
        {
          id: 'profile-3',
          itemType: 'interest',
          itemKey: 'technology_stack',
          itemValue: 'TypeScript',
          confidence: 0.6,
          salienceScore: 0.5,
          mentionCount: 1,
          lastSeen: now - 3 * dayMs,
          sourceKind: 'inferred',
          userConfirmed: false,
          status: 'active',
        },
        {
          id: 'profile-4',
          itemType: 'interest',
          itemKey: 'old_topic',
          itemValue: 'Retracted topic',
          status: 'retracted',
        },
        {
          id: 'profile-5',
          itemType: 'interest',
          itemKey: 'memory_topic',
          itemValue: 'Personal AI',
          confidence: 0.55,
          salienceScore: 0.65,
          mentionCount: 1,
          lastSeen: now - 4 * dayMs,
          sourceKind: 'inferred',
          userConfirmed: false,
          status: 'active',
          evidenceRefs: [{
            sourceType: 'web',
            url: 'https://example.test/profile-launch-plan',
            snippet: 'Profile evidence from launch plan',
          }],
        },
        {
          id: 'profile-6',
          itemType: 'preference',
          itemKey: 'response_length',
          itemValue: '短回复',
          confidence: 0.4,
          salienceScore: 0.4,
          mentionCount: 1,
          lastSeen: now - 5 * dayMs,
          sourceKind: 'inferred',
          userConfirmed: false,
          status: 'pending_confirm',
          evidenceRefs: [{ source: 'message', id: 'm-2' }],
        },
      ],
      totalItems: 6,
    },
    analysis: {
      opinions: [{ id: 'opinion-1' }],
      totalOpinions: 1,
    },
  };

  const viewModel = normalizeUserProfilePayload(payload);

  assert.equal(viewModel.profile.core, payload.profile.core);
  assert.equal(viewModel.profile.totalItems, 6);
  assert.equal(viewModel.profile.loadedItems, 5);
  assert.equal(viewModel.profile.isTruncated, false);
  assert.equal(viewModel.profile.allItems.length, 5);
  assert.equal(viewModel.profile.interests.projects[0].name, 'Personal AI');
  assert.equal(viewModel.profile.interests.people[0].name, 'Ada Chen');
  assert.equal(viewModel.profile.interests.technologies[0].name, 'TypeScript');
  assert.equal(
    viewModel.profile.interests.topics.some((item) => item.id === 'profile-5'),
    true,
  );
  assert.equal(
    viewModel.profile.interests.people.some((item) => item.id === 'profile-5'),
    false,
  );
  assert.equal(viewModel.profile.statistics.totalInteractions, 8);
  assert.equal(viewModel.profile.statistics.confirmedItems, 1);
  assert.equal(viewModel.profile.statistics.inferredItems, 4);
  assert.equal(viewModel.profile.allItems[0].canUseForPersonalization, true);
  assert.equal(viewModel.profile.allItems[0].contextUseState, 'usable');
  assert.equal(
    viewModel.profile.allItems.find((item) => item.id === 'profile-6')?.canUseForPersonalization,
    false,
  );
  assert.equal(
    viewModel.profile.allItems.find((item) => item.id === 'profile-2')?.calibrationPriority,
    'high',
  );
  assert.equal(
    viewModel.profile.allItems.find((item) => item.id === 'profile-2')?.calibrationReason,
    '高影响但缺少可审计证据，建议优先确认或排除。',
  );
  assert.equal(
    viewModel.profile.allItems.find((item) => item.id === 'profile-6')?.calibrationPriority,
    'medium',
  );
  assert.equal(viewModel.profile.activityTrend.length, 7);
  assert.equal(viewModel.profile.heatmap.length, 168);
  assert.equal(viewModel.profile.allItems[0].lastSeen, (nowSeconds - 86_400) * 1000);
  assert.equal(viewModel.profile.statistics.lastActiveTime, (nowSeconds - 86_400) * 1000);
  assert.equal(viewModel.analysis.insights.focusAreas.includes('TypeScript'), true);
  assert.equal(viewModel.analysis.predictedInterests.length, 4);
  assert.equal(viewModel.analysis.predictedInterests[0].id, 'profile-6');
  assert.equal(viewModel.analysis.predictedInterests[0].status, 'pending_confirm');
  assert.equal(viewModel.analysis.predictedInterests[0].canUseForPersonalization, false);
  assert.equal(viewModel.analysis.reviewQueue.length, 4);
  assert.equal(viewModel.analysis.reviewQueue[0].id, 'profile-6');
  assert.equal(
    viewModel.analysis.reviewQueue.every((item) => item.canUseForPersonalization === false),
    true,
  );
  assert.equal(
    viewModel.analysis.predictedInterests.some(
      (item) =>
        item.id === 'profile-5' &&
        item.category === 'topics' &&
        item.evidenceCount === 1,
    ),
    true,
  );
  assert.equal(
    viewModel.profile.allItems.find((item) => item.id === 'profile-5')?.evidencePreview[0]?.sourceUrl,
    'https://example.test/profile-launch-plan',
  );
  assert.equal(
    viewModel.analysis.predictedInterests.find((item) => item.id === 'profile-5')?.evidencePreview[0]?.detail,
    'Profile evidence from launch plan',
  );

  const needsReviewItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    statusFilter: 'needsReview',
  });
  assert.deepEqual(
    needsReviewItems.map((item) => item.id),
    ['profile-6', 'profile-2', 'profile-3', 'profile-5'],
  );

  const highImpactItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    statusFilter: 'highImpact',
  });
  assert.deepEqual(
    highImpactItems.map((item) => item.id),
    ['profile-2', 'profile-3'],
  );

  const searchableItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    query: 'personal ai',
  });
  assert.deepEqual(
    searchableItems.map((item) => item.id),
    ['profile-5', 'profile-1'],
  );

  const evidenceSearchItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    query: 'launch plan',
  });
  assert.deepEqual(
    evidenceSearchItems.map((item) => item.id),
    ['profile-5'],
  );

  const usableItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    statusFilter: 'usable',
  });
  assert.deepEqual(
    usableItems.map((item) => item.id),
    ['profile-1'],
  );

  const newestItems = filterAndSortProfileItems(viewModel.profile.allItems, {
    sortMode: 'newest',
  });
  assert.equal(newestItems[0].id, 'profile-1');
  assert.equal(newestItems[newestItems.length - 1]?.id, 'profile-6');
}

function verifyEmptyPayloadIsRenderable() {
  const viewModel = buildUserProfileViewModel({ now: Date.UTC(2026, 4, 2) });

  assert.equal(viewModel.profile.allItems.length, 0);
  assert.equal(viewModel.profile.loadedItems, 0);
  assert.equal(viewModel.profile.isTruncated, false);
  assert.equal(viewModel.profile.interests.projects.length, 0);
  assert.equal(viewModel.analysis.insights.focusAreas[0], '待补充');
  assert.equal(viewModel.profile.activityTrend.length, 7);
  assert.equal(viewModel.profile.heatmap.length, 168);
}

function verifyTruncatedPayloadMetadata() {
  const viewModel = normalizeUserProfilePayload({
    profile: {
      items: [
        {
          id: 'profile-loaded-1',
          itemType: 'interest',
          itemKey: 'focus_project',
          itemValue: 'Loaded Project',
          status: 'active',
          userConfirmed: true,
        },
      ],
      totalItems: 3,
      truncated: true,
      viewLimit: 1,
    },
  });

  assert.equal(viewModel.profile.loadedItems, 1);
  assert.equal(viewModel.profile.totalItems, 3);
  assert.equal(viewModel.profile.isTruncated, true);
  assert.equal(viewModel.profile.viewLimit, 1);
}

async function verifyProfileClientConfirmedOnlyQuery() {
  let requestedUrl = '';
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (url: string) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://unit.test/api/v1',
      userId: 'tester',
      timeout: 1000,
    });
    await client.getProfileItems({
      type: 'interest',
      key: 'focus_project',
      confirmedOnly: true,
      limit: 5,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestedUrl, /confirmed_only=true/);
  assert.doesNotMatch(requestedUrl, /confirmedOnly/);
}

async function verifyProfileClientInferredItemQuery() {
  let requestedUrl = '';
  let requestedMethod = '';
  let requestedBody = '';
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    requestedUrl = String(url);
    requestedMethod = String(init?.method || '');
    requestedBody = String(init?.body || '');
    return new Response(JSON.stringify({ id: 'candidate-1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://unit.test/api/v1',
      userId: 'tester',
      timeout: 1000,
    });
    await client.createInferredProfileItem({
      itemType: 'interest',
      itemKey: 'web_project',
      itemValue: 'Personal AI',
      confidence: 0.42,
      evidenceRefs: [{ sourceType: 'web', url: 'https://example.test' }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestedUrl, /\/profile\/items\/inferred$/);
  assert.equal(requestedMethod, 'POST');
  assert.match(requestedBody, /"itemKey":"web_project"/);
}

async function verifyProfileClientRestoreItemQuery() {
  let requestedUrl = '';
  let requestedMethod = '';
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    requestedUrl = String(url);
    requestedMethod = String(init?.method || '');
    return new Response(JSON.stringify({ id: 'candidate-1', status: 'pending_confirm' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://unit.test/api/v1',
      userId: 'tester',
      timeout: 1000,
    });
    await client.restoreProfileItem('candidate-1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(requestedUrl, /\/profile\/items\/candidate-1\/restore$/);
  assert.equal(requestedMethod, 'POST');
}

async function verifyProfileItemsPaginationBoundaries() {
  const allItems = Array.from({ length: 450 }, (_, index) => ({
    id: `profile-${index + 1}`,
  }));
  const requests: Array<{ limit: number; offset: number }> = [];
  const client = {
    async getProfileItems(filters: { limit?: number; offset?: number }) {
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;
      requests.push({ limit, offset });
      return {
        items: allItems.slice(offset, offset + limit),
        total: allItems.length,
      };
    },
  } as any;

  const cappedPage = await getProfileItemsForView(client, 250);

  assert.equal(cappedPage.items.length, 250);
  assert.equal(cappedPage.total, 450);
  assert.equal(cappedPage.truncated, true);
  assert.equal(cappedPage.viewLimit, 250);
  assert.deepEqual(requests, [
    { limit: 200, offset: 0 },
    { limit: 50, offset: 200 },
  ]);

  requests.length = 0;
  const fullExportPage = await getProfileItemsForView(
    client,
    Number.POSITIVE_INFINITY,
  );

  assert.equal(fullExportPage.items.length, 450);
  assert.equal(fullExportPage.total, 450);
  assert.equal(fullExportPage.truncated, false);
  assert.equal(fullExportPage.viewLimit, undefined);
  assert.deepEqual(requests, [
    { limit: 200, offset: 0 },
    { limit: 200, offset: 200 },
    { limit: 200, offset: 400 },
  ]);
}

async function main() {
  verifyViewModelNormalization();
  verifyEmptyPayloadIsRenderable();
  verifyTruncatedPayloadMetadata();
  await verifyProfileClientConfirmedOnlyQuery();
  await verifyProfileClientInferredItemQuery();
  await verifyProfileClientRestoreItemQuery();
  await verifyProfileItemsPaginationBoundaries();
  console.log('verify-user-profile-system: ok');
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
