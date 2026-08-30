import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  DEFAULT_ASSIST_PREVIEW_LIMIT,
  buildComposerAssistDraftReceipt,
  buildComposerAssistInsertionReceipt,
  buildComposerAssistSourceRouteReceipt,
  buildComposerRehearsalCueScopeLabel,
  getComposerAssistThresholdForSurface,
  getComposerAssistPreviewText,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  normalizeComposerAssistSurfaceThresholds,
  sanitizeComposerAssistInsertText,
} from '../assistPreviewPolicy.ts';
import {
  isComposerAssistEnabledFromConfig,
  isComposerAssistIntentEnabledFromConfig,
} from '../assistConfig.ts';
import {
  buildComposerAssistClaimAttributionReceipt,
  buildComposerAssistRequestSignature,
  getComposerAssistProjectionReviewNote,
  getComposerAssistRequestGate,
  isComposerAssistProjectionBlocked,
  isComposerAssistSessionCurrent,
  isInsertableComposerAssist,
  shouldResetComposerAssistOnActivate,
  shouldReviewComposerAssistBeforeInsert,
} from '../ComposerGuardController.ts';

test('normalizeComposerAssistThreshold: defaults to 0.78 and clamps bounds', () => {
  assert.equal(normalizeComposerAssistThreshold(undefined), 0.78);
  assert.equal(DEFAULT_ASSIST_CONFIDENCE_THRESHOLD, 0.78);
  assert.equal(normalizeComposerAssistThreshold(0.1), 0.62);
  assert.equal(normalizeComposerAssistThreshold(0.99), 0.92);
  assert.equal(normalizeComposerAssistThreshold(undefined, 0.99), 0.92);
});

test('getNextComposerAssistThreshold: accepted feedback lowers non-linearly', () => {
  const first = getNextComposerAssistThreshold(0.78, 'accepted');
  const second = getNextComposerAssistThreshold(first, 'accepted');
  const firstDelta = 0.78 - first;
  const secondDelta = first - second;

  assert.ok(first < 0.78);
  assert.ok(second < first);
  assert.ok(firstDelta > secondDelta);
});

test('getNextComposerAssistThreshold: rejected feedback raises non-linearly', () => {
  const first = getNextComposerAssistThreshold(0.78, 'rejected');
  const second = getNextComposerAssistThreshold(first, 'rejected');
  const firstDelta = first - 0.78;
  const secondDelta = second - first;

  assert.ok(first > 0.78);
  assert.ok(second > first);
  assert.ok(firstDelta > secondDelta);
});

test('surface thresholds: normalize per-surface overrides and preserve global fallback', () => {
  const thresholds = normalizeComposerAssistSurfaceThresholds({
    chatgpt: 0.91,
    'chatgpt:draft_refine': 0.7,
    'ringcentral_message:draft_refine': 0.9,
    ringcentral_message: 0.55,
    jira_issue: 'not-a-number',
    '': 0.8,
  });

  assert.deepEqual(thresholds, {
    chatgpt: 0.91,
    'chatgpt:draft_refine': 0.7,
    'ringcentral_message:draft_refine': 0.9,
    ringcentral_message: 0.62,
  });
  assert.equal(
    getComposerAssistThresholdForSurface('chatgpt', thresholds, 0.78),
    0.91,
  );
  assert.equal(
    getComposerAssistThresholdForSurface(
      'chatgpt',
      thresholds,
      0.78,
      'draft_refine',
    ),
    0.7,
  );
  assert.equal(
    getComposerAssistThresholdForSurface(
      'ringcentral_message',
      thresholds,
      0.78,
      'draft_refine',
    ),
    0.9,
  );
  assert.equal(
    getComposerAssistThresholdForSurface('jira_issue', thresholds, 0.78),
    0.78,
  );
  assert.equal(
    getComposerAssistThresholdForSurface(
      'jira_issue',
      {},
      undefined,
      'draft_refine',
    ),
    0.86,
  );
  assert.equal(
    getComposerAssistThresholdForSurface(
      'chatgpt',
      {},
      undefined,
      'draft_refine',
    ),
    0.72,
  );
});

test('assist config: draft and refine switches gate independently under compose assist', () => {
  assert.equal(
    isComposerAssistEnabledFromConfig({ CONTEXT_ASSIST_ENABLED: false }),
    false,
  );
  assert.equal(
    isComposerAssistIntentEnabledFromConfig('draft_compose', {
      COMPOSE_DRAFT_ENABLED: false,
    }),
    false,
  );
  assert.equal(
    isComposerAssistIntentEnabledFromConfig('draft_refine', {
      COMPOSE_REFINE_ENABLED: false,
    }),
    false,
  );
  assert.equal(
    isComposerAssistIntentEnabledFromConfig('draft_compose', {
      CONTEXT_ASSIST_ENABLED: true,
      COMPOSE_ASSIST_ENABLED: true,
    }),
    true,
  );
});

test('getComposerAssistPreviewText: truncates hover previews but preserves locked previews', () => {
  const longSuggestion = 'A'.repeat(DEFAULT_ASSIST_PREVIEW_LIMIT + 24);

  const hoverPreview = getComposerAssistPreviewText(longSuggestion);
  assert.equal(hoverPreview.length, DEFAULT_ASSIST_PREVIEW_LIMIT + 3);
  assert.ok(hoverPreview.endsWith('...'));

  const lockedPreview = getComposerAssistPreviewText(longSuggestion, {
    forceFull: true,
  });
  assert.equal(lockedPreview, longSuggestion);
});

test('sanitizeComposerAssistInsertText: strips wrapper copy before preview or insert', () => {
  const insertText = sanitizeComposerAssistInsertText(
    'Personal AI context pack (review before sending):\n请结合 Orbit blocker 回复。\nPlease review and edit before sending.',
  );

  assert.equal(insertText, '请结合 Orbit blocker 回复。');
});

test('persona projection: review notes stay accurate and blocked suggestions are not insertable', () => {
  const base = {
    available: true,
    suggestionType: 'reply_context' as const,
    insertText: 'Status is on track.',
    evidence: [],
    riskLevel: 'low' as const,
    previewRequired: true,
    confidence: 0.9,
    queryTimeMs: 5,
  };
  const projection = {
    version: 1 as const,
    scene: 'ringcentral_message' as const,
    audienceType: 'manager' as const,
    audienceSource: 'confirmed_social_edge' as const,
    audienceConfidence: 1,
    representationMode: 'draft_preview_required' as const,
    voiceMode: 'write_as_user' as const,
    usedSlotKinds: ['writing_style' as const],
    usedCount: 1,
    blockedCount: 2,
    reasonCodes: ['blocked_sensitive_profile'],
    requiresPreview: true,
  };

  assert.equal(
    getComposerAssistProjectionReviewNote({
      ...base,
      personaProjection: projection,
    }),
    '已按当前场景省略未确认或敏感身份信息；仅插入草稿，不会发送。',
  );
  assert.equal(
    getComposerAssistProjectionReviewNote({
      ...base,
      personaProjection: { ...projection, blockedCount: 0 },
    }),
    '当前对象或场景要求先预览；仅插入草稿，不会发送。',
  );
  assert.equal(
    isComposerAssistProjectionBlocked({
      ...base,
      personaProjection: {
        ...projection,
        representationMode: 'blocked',
        requiresPreview: false,
      },
    }),
    true,
  );
});

test('claim attribution consequence always stays behind the existing review preview', () => {
  assert.equal(
    shouldReviewComposerAssistBeforeInsert({
      available: true,
      suggestionType: 'reply_context',
      insertText: '请按当前 owner 边界回复。',
      evidence: [],
      riskLevel: 'low',
      previewRequired: false,
      confidence: 0.9,
      queryTimeMs: 4,
      attributionReceipt: {
        status: 'downgraded',
        visibility: 'compact',
        summary: '采用 1 条；仅作背景 1 条',
        boundary: '只影响 Personal AI 如何使用派生记忆，不修改原始消息。',
        used: [{ kind: 'self:direct_assertion', label: '你 · 明确表达', count: 1 }],
        backgroundOnly: [{ kind: 'ai_agent:suggestion', label: 'AI · 建议', count: 1 }],
        blocked: [],
        claims: [],
        affectedHighResponsibility: false,
        correctedCount: 0,
      },
    }),
    true,
  );
});

test('used-only attribution receipt explains why Compose upgraded to locked review', () => {
  const assist = {
    available: true,
    suggestionType: 'reply_context' as const,
    insertText: '我来负责这个 follow-up。',
    evidence: [],
    riskLevel: 'low' as const,
    previewRequired: false,
    confidence: 0.9,
    queryTimeMs: 4,
    attributionReceipt: {
      status: 'downgraded' as const,
      visibility: 'compact' as const,
      summary: '采用 1 条',
      boundary: '只影响 Personal AI 如何使用派生记忆，不修改原始消息。',
      used: [
        {
          kind: 'self:commitment',
          label: '你 · 已接受承诺',
          count: 1,
        },
      ],
      backgroundOnly: [],
      blocked: [],
      claims: [
        {
          claimId: 'claim-commitment',
          sourceMessageId: 'message-commitment',
          revision: 1,
          excerpt: '我来负责这个 follow-up。',
          ownerKind: 'self' as const,
          ownerLabel: '你',
          speechMode: 'commitment' as const,
          verification: 'unverified' as const,
          commitment: 'accepted' as const,
          effect: 'used' as const,
          displayLabel: '你 · 已接受承诺',
          consequence: '可作为本轮直接证据',
          correctionAllowed: true,
          corrected: false,
        },
      ],
      affectedHighResponsibility: false,
      correctedCount: 0,
    },
  };

  assert.equal(shouldReviewComposerAssistBeforeInsert(assist), true);
  const presentation = buildComposerAssistClaimAttributionReceipt(assist);
  assert.ok(presentation);
  assert.equal(presentation.title, '已按归属采用证据');
  assert.equal(presentation.summary, '采用 1 条');
  assert.deepEqual(presentation.details, [
    '你 · 已接受承诺：可作为本轮直接证据',
  ]);

  const ordinary = { ...assist, attributionReceipt: undefined };
  assert.equal(shouldReviewComposerAssistBeforeInsert(ordinary), false);
  assert.equal(buildComposerAssistClaimAttributionReceipt(ordinary), null);
});

test('buildComposerAssistDraftReceipt: explains direct insert versus review boundaries', () => {
  const direct = buildComposerAssistDraftReceipt({
    contextType: 'message_thread',
    surface: 'ringcentral_message',
    suggestionType: 'reply_context',
    riskLevel: 'low',
    previewRequired: false,
    reviewRequired: false,
    evidenceTypes: ['message'],
    evidenceCount: 1,
  });

  assert.deepEqual(
    direct.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['插入对象', 'RingCentral 回复草稿', 'muted'],
      ['动作边界', '点击 icon 只插入草稿，不发送/提交', 'ok'],
      ['复核边界', '低风险，仍可编辑或撤销', 'ok'],
      ['建议依据', '1 条 · 消息记忆', 'ok'],
    ],
  );

  const review = buildComposerAssistDraftReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'context_pack',
    riskLevel: 'low',
    previewRequired: false,
    reviewRequired: true,
    evidenceTypes: ['rehearsal', 'source_memory'],
    evidenceCount: 2,
  });

  assert.deepEqual(
    review.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['插入对象', '外部 AI context pack', 'muted'],
      ['动作边界', '先锁定预览，确认后只插入草稿', 'warn'],
      ['复核边界', '预演提醒，需确认未来场景仍适合', 'warn'],
      ['建议依据', '2 条 · 预演提醒 / 资料记忆', 'ok'],
    ],
  );

  const promptPatch = buildComposerAssistDraftReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'prompt_patch',
    riskLevel: 'medium',
    previewRequired: true,
    reviewRequired: false,
    evidenceTypes: ['source_memory'],
    evidenceCount: 1,
  });

  assert.deepEqual(
    promptPatch.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['插入对象', '外部 AI prompt 补丁', 'muted'],
      ['动作边界', '点击 icon 只插入草稿，不发送/提交', 'ok'],
      ['复核边界', '后端要求预览确认', 'warn'],
      ['建议依据', '1 条 · 资料记忆', 'ok'],
    ],
  );

  const rewrite = buildComposerAssistDraftReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'rewrite_prompt',
    riskLevel: 'high',
    previewRequired: true,
    reviewRequired: true,
    evidenceCount: 0,
  });

  assert.deepEqual(
    rewrite.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['插入对象', '外部 AI 完整 prompt', 'muted'],
      ['动作边界', '先锁定完整预览，确认后替换原 prompt', 'warn'],
      ['复核边界', '高风险，需核对事实/语气/敏感信息', 'warn'],
      ['建议依据', '0 条证据，按当前草稿保守处理', 'muted'],
    ],
  );
});

test('buildComposerAssistInsertionReceipt: explains post-insert target and side-effect boundaries', () => {
  const webAi = buildComposerAssistInsertionReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'context_pack',
  });

  assert.equal(webAi.title, '已追加上下文');
  assert.equal(
    webAi.detail,
    '写入目标：外部 AI context pack；没有提交 prompt、没有发送给外部 AI；约 10 秒内可撤销；撤销窗口结束后才记录 accepted 和脱敏校准信号。',
  );

  const promptPatch = buildComposerAssistInsertionReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'prompt_patch',
  });

  assert.equal(promptPatch.title, '已追加 prompt 补丁');
  assert.equal(
    promptPatch.detail,
    '写入目标：外部 AI prompt 补丁；没有提交 prompt、没有发送给外部 AI；约 10 秒内可撤销；撤销窗口结束后才记录 accepted 和脱敏校准信号。',
  );

  const rewrite = buildComposerAssistInsertionReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    suggestionType: 'rewrite_prompt',
    insertMode: 'replace_draft',
  });

  assert.equal(rewrite.title, '已替换原 prompt');
  assert.equal(
    rewrite.detail,
    '写入目标：外部 AI 完整 prompt；没有提交 prompt、没有发送给外部 AI；约 10 秒内可撤销；撤销窗口结束后才记录 accepted 和脱敏校准信号。',
  );

  const ringCentral = buildComposerAssistInsertionReceipt({
    contextType: 'message_thread',
    surface: 'ringcentral_thread',
    suggestionType: 'reply_context',
  });

  assert.equal(
    ringCentral.detail,
    '写入目标：RingCentral thread 回复草稿；没有发送 RingCentral 消息；约 10 秒内可撤销；撤销窗口结束后才记录 accepted 和脱敏校准信号。',
  );
});

test('buildComposerAssistSourceRouteReceipt: explains source routing by compose surface', () => {
  const ringCentral = buildComposerAssistSourceRouteReceipt({
    contextType: 'message_thread',
    surface: 'ringcentral_thread',
    scenario: 'thread_reply',
    sourceTypes: ['glip', 'manual', 'source_memory', 'rehearsal'],
  });

  assert.deepEqual(
    ringCentral.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['场景路由', 'RingCentral thread 回复', 'muted'],
      ['当前上下文', 'thread root + 可见回复', 'muted'],
      ['允许召回', '4 类：聊天 / 手动 / 资料 / 预演', 'ok'],
      ['路由边界', 'thread 优先，不混主会话；草稿只作语气/去重', 'ok'],
      ['刷新口径', '换 thread 会重算；同一回复框再次 focus 从缓存恢复，不沿用主会话', 'ok'],
    ],
  );

  const jira = buildComposerAssistSourceRouteReceipt({
    contextType: 'jira_issue',
    surface: 'jira_issue',
    scenario: 'jira_comment',
    sourceTypes: ['jira', 'glip', 'meeting', 'source_memory', 'rehearsal'],
  });

  assert.equal(jira.rows[0].value, 'Jira comment');
  assert.equal(jira.rows[1].value, 'issue 字段、描述、评论');
  assert.equal(jira.rows[3].value, 'issue 优先，草稿只作语气/去重');

  const webAi = buildComposerAssistSourceRouteReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    provider: 'chatgpt',
    scenario: 'compose_to_ai',
    sourceTypes: [
      'ai_chat',
      'codex_cli',
      'glip',
      'jira',
      'meeting',
      'calendar',
      'source_memory',
    ],
  });

  assert.deepEqual(
    webAi.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['场景路由', 'chatgpt prompt', 'muted'],
      ['当前上下文', '当前 prompt + 可见 AI turns', 'muted'],
      ['允许召回', '7 类：AI 对话 / Agent 会话 / 聊天 / Jira / 会议 / 日历 +1', 'ok'],
      [
        '路由边界',
        '当前 AI 自身历史已排除；只插 context pack，不提交',
        'warn',
      ],
      ['刷新口径', 'prompt 或 AI turns 变化会重算；拒绝只影响当前 prompt', 'ok'],
    ],
  );

  const promptPatch = buildComposerAssistSourceRouteReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    provider: 'chatgpt',
    scenario: 'compose_to_ai',
    suggestionType: 'prompt_patch',
    sourceTypes: ['codex_cli', 'jira'],
  });

  assert.deepEqual(
    promptPatch.rows.map((row) => [row.label, row.value, row.tone]),
    [
      ['场景路由', 'chatgpt prompt', 'muted'],
      ['当前上下文', '当前 prompt + 可见 AI turns', 'muted'],
      ['允许召回', '2 类：Agent 会话 / Jira', 'ok'],
      [
        '路由边界',
        '当前 AI 自身历史已排除；只插 prompt 补丁，不提交',
        'warn',
      ],
      ['刷新口径', 'prompt 或 AI turns 变化会重算；拒绝只影响当前 prompt', 'ok'],
    ],
  );

  const rewrite = buildComposerAssistSourceRouteReceipt({
    contextType: 'web_agent_prompt',
    surface: 'chatgpt',
    provider: 'chatgpt',
    scenario: 'compose_to_ai',
    suggestionType: 'rewrite_prompt',
    sourceTypes: ['codex_cli', 'source_memory'],
  });

  assert.equal(
    rewrite.rows[3].value,
    '当前 AI 自身历史已排除；只替换完整 prompt，不提交',
  );
});

test('buildComposerRehearsalCueScopeLabel: summarizes matched cue scope before generic reasons', () => {
  const label = buildComposerRehearsalCueScopeLabel({
    metadata: {
      matchedCues: {
        people: ['Colin Liu'],
        groupIds: ['colin-group'],
        issueKeys: ['MTR-148115'],
        topics: ['review owner'],
      },
    },
    whyRelevant: ['人物：Colin Liu', '同群聊'],
  });

  assert.equal(
    label,
    '人物 Colin Liu / Issue MTR-148115 / 群聊 colin-group / 主题 review owner',
  );

  assert.equal(
    buildComposerRehearsalCueScopeLabel({
      metadata: {},
      whyRelevant: ['人物：Colin Liu', '同群聊'],
    }),
    '人物：Colin Liu / 同群聊',
  );
});

test('isComposerAssistEnabledFromConfig: context and compose toggles both gate the feature', () => {
  assert.equal(isComposerAssistEnabledFromConfig(undefined), true);
  assert.equal(isComposerAssistEnabledFromConfig({}), true);
  assert.equal(
    isComposerAssistEnabledFromConfig({ CONTEXT_ASSIST_ENABLED: false }),
    false,
  );
  assert.equal(
    isComposerAssistEnabledFromConfig({ COMPOSE_ASSIST_ENABLED: false }),
    false,
  );
  assert.equal(
    isComposerAssistEnabledFromConfig({
      CONTEXT_ASSIST_ENABLED: true,
      COMPOSE_ASSIST_ENABLED: true,
    }),
    true,
  );
});

test('composer assist request gate suppresses duplicate in-flight and failed retries', () => {
  const signature = buildComposerAssistRequestSignature(
    'thread:staff-slides',
    2,
    'draft_compose',
  );

  assert.equal(
    signature,
    'thread:staff-slides|revision:2|intent:draft_compose',
  );
  assert.equal(
    buildComposerAssistRequestSignature(
      'thread:staff-slides',
      2,
      'draft_refine',
    ),
    'thread:staff-slides|revision:2|intent:draft_refine',
  );
  assert.deepEqual(
    getComposerAssistRequestGate({
      signature,
      inFlightSignature: signature,
      now: 1_000,
    }),
    { suppress: true, reason: 'in_flight' },
  );
  assert.deepEqual(
    getComposerAssistRequestGate({
      signature,
      retryBlockedUntil: 4_500,
      now: 1_500,
    }),
    { suppress: true, reason: 'failure_cooldown', retryAfterMs: 3_000 },
  );
  assert.deepEqual(
    getComposerAssistRequestGate({
      signature,
      retryBlockedUntil: 1_500,
      now: 1_500,
    }),
    { suppress: false },
  );
});

test('available reply_refine is insertable below the work refine display threshold', () => {
  assert.equal(
    isInsertableComposerAssist({
      available: true,
      suggestionType: 'reply_refine',
      insertMode: 'replace_draft',
      insertText:
        'Sounds good, thanks Esone Qiu! Happy to help prep the demo before Weekly Sync.',
      evidence: [],
      riskLevel: 'low',
      previewRequired: true,
      confidence: 0.75,
      queryTimeMs: 20,
    }),
    true,
  );
  assert.equal(
    isInsertableComposerAssist({
      available: true,
      suggestionType: 'reply_refine',
      insertMode: 'append_patch',
      insertText: 'Sounds good, thanks Esone Qiu!',
      evidence: [],
      riskLevel: 'low',
      previewRequired: true,
      confidence: 0.9,
      queryTimeMs: 20,
    }),
    false,
  );
});

test('composer remount with the same identity keeps the cached assist session', () => {
  assert.equal(
    shouldResetComposerAssistOnActivate({
      previousContextKey: 'ringcentral|6543474694|ringcentral_thread|root-1|thread',
      nextContextKey: 'ringcentral|6543474694|ringcentral_thread|root-1|thread',
      draftChangedWithoutInput: false,
    }),
    false,
  );
  assert.equal(
    shouldResetComposerAssistOnActivate({
      previousContextKey: 'ringcentral|6543474694|ringcentral_message||main',
      nextContextKey: 'ringcentral|6543474694|ringcentral_thread|root-1|thread',
      draftChangedWithoutInput: false,
    }),
    true,
  );
  assert.equal(
    isComposerAssistSessionCurrent(
      {
        contextKey: 'ringcentral|6543474694|ringcentral_thread|root-1|thread',
        draftRevision: 0,
        pageHref: 'https://app.ringcentral.com/messages/6543474694',
      },
      {
        contextKey: 'ringcentral|6543474694|ringcentral_thread|root-1|thread',
        draftRevision: 0,
        pageHref: 'https://app.ringcentral.com/messages/6543474694',
      },
      'https://app.ringcentral.com/messages/6543474694',
    ),
    true,
  );
});
