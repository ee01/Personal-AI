import { buildApp } from '../memory-service/src/server.js';
import {
  buildComposerGenerationPrompt,
  loadComposerPersonalization,
} from '../memory-service/src/core/ContextAssistService.js';
import { getTestDb } from '../memory-service/src/__tests__/setup.js';
import type {
  ComposerAssistEvidence,
  ComposerAssistRequest,
  ComposerScenario,
} from '../memory-service/src/types/index.js';

interface EvalCase {
  id: string;
  title: string;
  sampleContext?: {
    traces?: Array<Record<string, unknown>>;
    composeRequest?: ComposerAssistRequest;
    evidence?: ComposerAssistEvidence[];
  };
  expectedBehavior?: {
    userCoreMustInclude?: string[];
    userCoreMustNotInclude?: string[];
    promptBeforeMustNotInclude?: string[];
    promptAfterMustInclude?: string[];
    promptAfterMustNotInclude?: string[];
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-compose-style-memory.ts <case.json>');
}

const caseItem = (await importJson(casePath)) as EvalCase;
const db = getTestDb();
const { app, userContextManager } = await buildApp({ db });
await app.ready();

let result: Record<string, unknown> | undefined;
try {
  resetTables();
  const request = buildComposeRequest(caseItem);
  const evidence = buildEvidence(caseItem);
  const scenario = (request.scenario || 'instant_message_reply') as ComposerScenario;

  const beforePersonalization = loadComposerPersonalization(db, request);
  const promptBefore =
    buildComposerGenerationPrompt(
      request,
      evidence,
      scenario,
      beforePersonalization,
    ) || '';

  const traceResponses = [];
  for (const trace of caseItem.sampleContext?.traces || []) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ambient-calibration/traces',
      payload: trace,
    });
    traceResponses.push({
      statusCode: response.statusCode,
      body: response.json(),
    });
  }

  const coreRes = await app.inject({
    method: 'GET',
    url: '/api/v1/profile/core',
  });
  const userCore = String(coreRes.json().content || '');

  const afterPersonalization = loadComposerPersonalization(db, request);
  const promptAfter =
    buildComposerGenerationPrompt(
      request,
      evidence,
      scenario,
      afterPersonalization,
    ) || '';

  result = judge({
    caseItem,
    traceResponses,
    userCore,
    promptBefore,
    promptAfter,
    styleHintKeys: afterPersonalization.confirmedStyleHints.map(
      (row) => row.item_key,
    ),
  });
} finally {
  await app.close();
  userContextManager.closeAll();
}

if (result) {
  console.log(JSON.stringify(result));
}

async function importJson(filePath: string): Promise<unknown> {
  const fs = await import('node:fs/promises');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function resetTables(): void {
  db.prepare('DELETE FROM ambient_calibration_traces').run();
  db.prepare('DELETE FROM user_writing_style_memories').run();
  db.prepare('DELETE FROM user_profile_items').run();
  db.prepare('DELETE FROM chunks').run();
  try {
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
  } catch {
    // FTS may be unavailable in minimal SQLite test environments.
  }
}

function buildComposeRequest(caseItem: EvalCase): ComposerAssistRequest {
  return {
    surface: 'ringcentral_message',
    contextType: 'message_thread',
    scenario: 'instant_message_reply',
    title: 'Compose style memory eval',
    primaryText: 'Esther asks for help with Jira PAT token setup.',
    audience: {
      conversationTitle: 'Esther (Xiying) Pan',
      relationshipHint: 'peer colleague',
      people: ['Esther (Xiying) Pan'],
      conversationId: 'esther-dm',
      groupId: 'esther-dm',
    },
    visibleMessages: [
      {
        sender: 'Esther (Xiying) Pan',
        text: '下午单独找个时间跟你请教，哈哈哈',
      },
    ],
    debug: true,
    ...(caseItem.sampleContext?.composeRequest || {}),
  } as ComposerAssistRequest;
}

function buildEvidence(caseItem: EvalCase): ComposerAssistEvidence[] {
  return (
    caseItem.sampleContext?.evidence || [
      {
        id: 'memory-pat-token-help',
        type: 'message',
        title: 'Jira PAT token help',
        snippet:
          'Jira PAT token setup can be explained directly to Esther in the afternoon.',
        sourceLabel: 'glip',
        score: 0.86,
      },
    ]
  ) as ComposerAssistEvidence[];
}

function judge(args: {
  caseItem: EvalCase;
  traceResponses: Array<{ statusCode: number; body: Record<string, unknown> }>;
  userCore: string;
  promptBefore: string;
  promptAfter: string;
  styleHintKeys: string[];
}): Record<string, unknown> {
  const expected = args.caseItem.expectedBehavior || {};
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const [index, response] of args.traceResponses.entries()) {
    if (response.statusCode !== 200) {
      failures.push(`trace ${index + 1} returned ${response.statusCode}`);
    }
  }

  for (const value of expected.userCoreMustInclude || []) {
    if (!args.userCore.includes(value)) {
      failures.push(`USER_CORE missing: ${value}`);
    }
  }
  for (const value of expected.userCoreMustNotInclude || []) {
    if (args.userCore.includes(value)) {
      failures.push(`USER_CORE leaked forbidden text: ${value}`);
    }
  }
  for (const value of expected.promptBeforeMustNotInclude || []) {
    if (args.promptBefore.includes(value)) {
      failures.push(`prompt before style learning unexpectedly included: ${value}`);
    }
  }
  for (const value of expected.promptAfterMustInclude || []) {
    if (!args.promptAfter.includes(value)) {
      failures.push(`prompt after style learning missing: ${value}`);
    }
  }
  for (const value of expected.promptAfterMustNotInclude || []) {
    if (args.promptAfter.includes(value)) {
      warnings.push(`prompt after style learning contains discouraged text: ${value}`);
    }
  }

  const scores = {
    trace_ingestion: args.traceResponses.every((item) => item.statusCode === 200)
      ? 3
      : 0,
    user_core_update: (expected.userCoreMustInclude || []).every((value) =>
      args.userCore.includes(value),
    )
      ? 3
      : 0,
    prompt_style_shift: (expected.promptAfterMustInclude || []).every((value) =>
      args.promptAfter.includes(value),
    )
      ? 3
      : 0,
    privacy_redaction: (expected.userCoreMustNotInclude || []).some((value) =>
      args.userCore.includes(value),
    )
      ? 0
      : 3,
  };
  const scoreValues = Object.values(scores);
  const overallScore = Math.round(
    (scoreValues.reduce((sum, value) => sum + value, 0) /
      (scoreValues.length * 3)) *
      100,
  );
  const status = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';

  return {
    status,
    verdict: status,
    scores,
    overallScore: status === 'fail' ? Math.min(overallScore, 49) : overallScore,
    why:
      failures[0] ||
      warnings[0] ||
      'Repeated redacted compose diffs promoted a writing style memory and changed the next compose prompt.',
    userConclusion:
      status === 'pass'
        ? '通过：多次相似 diff 会更新 USER_CORE 写作风格，并让同类 compose prompt 带上私人 voice 约束。'
        : '不通过：写作风格记忆没有正确晋升，或同类 compose prompt 没有带入风格约束。',
    improvementSuggestions: failures.length
      ? failures
      : warnings.length
        ? warnings
        : ['继续用真实编辑 diff 和 downstream reaction 扩充 style feature 标签。'],
    actualOutput: {
      traceCount: args.traceResponses.length,
      promotedProfileItemIds: args.traceResponses.flatMap((response) => {
        const payload = response.body.writingStyleMemory as
          | { promotedProfileItemIds?: string[] }
          | undefined;
        return payload?.promotedProfileItemIds || [];
      }),
      styleHintKeys: args.styleHintKeys,
      userCoreExcerpt: excerpt(args.userCore),
      promptBeforeHasWritingStyle: /Writing Style|writing_style\./.test(
        args.promptBefore,
      ),
      promptAfterExcerpt: excerpt(args.promptAfter),
    },
  };
}

function excerpt(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 900);
}
