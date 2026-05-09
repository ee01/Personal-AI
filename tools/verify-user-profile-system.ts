import assert from 'node:assert/strict';

import { MemoryServiceClient } from '../src/services/MemoryServiceClient.ts';
import {
  buildUserProfileViewModel,
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
          evidenceRefs: [{ source: 'message', id: 'm-1' }],
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
  assert.equal(viewModel.profile.activityTrend.length, 7);
  assert.equal(viewModel.profile.heatmap.length, 168);
  assert.equal(viewModel.profile.allItems[0].lastSeen, (nowSeconds - 86_400) * 1000);
  assert.equal(viewModel.profile.statistics.lastActiveTime, (nowSeconds - 86_400) * 1000);
  assert.equal(viewModel.analysis.insights.focusAreas.includes('TypeScript'), true);
  assert.equal(viewModel.analysis.predictedInterests.length, 4);
  assert.equal(viewModel.analysis.predictedInterests[0].id, 'profile-6');
  assert.equal(viewModel.analysis.predictedInterests[0].status, 'pending_confirm');
  assert.equal(viewModel.analysis.predictedInterests[0].canUseForPersonalization, false);
  assert.equal(
    viewModel.analysis.predictedInterests.some(
      (item) =>
        item.id === 'profile-5' &&
        item.category === 'topics' &&
        item.evidenceCount === 1,
    ),
    true,
  );
}

function verifyEmptyPayloadIsRenderable() {
  const viewModel = buildUserProfileViewModel({ now: Date.UTC(2026, 4, 2) });

  assert.equal(viewModel.profile.allItems.length, 0);
  assert.equal(viewModel.profile.interests.projects.length, 0);
  assert.equal(viewModel.analysis.insights.focusAreas[0], '待补充');
  assert.equal(viewModel.profile.activityTrend.length, 7);
  assert.equal(viewModel.profile.heatmap.length, 168);
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

async function main() {
  verifyViewModelNormalization();
  verifyEmptyPayloadIsRenderable();
  await verifyProfileClientConfirmedOnlyQuery();
  await verifyProfileClientInferredItemQuery();
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
