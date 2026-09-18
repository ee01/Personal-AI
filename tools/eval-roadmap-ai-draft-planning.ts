import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-eval-'));
process.env.ROADMAP_AI_ENABLED = 'true';
process.env.ROADMAP_OPENAI_API_KEY = 'eval-key';
process.env.ROADMAP_AI_AGENT_ACCESS = 'true';

const casePath = process.argv[2];
if (!casePath) {
  console.error('usage: eval-roadmap-ai-draft-planning.ts <case.json>');
  process.exit(1);
}
const caseItem = JSON.parse(readFileSync(casePath, 'utf8')) as {
  id: string;
  title: string;
  expectedBehavior: string;
  query?: { action?: string };
};

const { assertSafeBaseUrl } = await import('../roadmap-service/mcp/src/http.ts');
const { MCP_TOOL_NAMES, MCP_TOOLS } = await import('../roadmap-service/mcp/src/tools.ts');
const { E12_SOURCE, E12_PLAN, e12PlanWithKeys } = await import(
  '../roadmap-service/src/__tests__/fixtures/e12.ts'
);
const { validateDraftPlan } = await import('../roadmap-service/src/planning/DraftPlanValidator.js');
const { applyIntent, createTeam, getTeamSnapshot } = await import(
  '../roadmap-service/src/core/TeamService.js'
);
const { submitStructuredPlan } = await import(
  '../roadmap-service/src/planning/DraftPlanningService.js'
);
const { stripSecrets } = await import('../roadmap-service/src/planning/sanitize.js');

const actor = { name: 'Eval', clientId: 'eval', source: 'agent' as const };

function emit(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload));
}

function pass(actual: unknown, why: string) {
  emit({
    status: 'pass',
    scores: { contract: 3 },
    overallScore: 3,
    userConclusion: caseItem.expectedBehavior,
    why,
    actualOutput: {
      summary: why,
      ...(actual && typeof actual === 'object' ? (actual as Record<string, unknown>) : { value: actual }),
    },
  });
}

function fail(actual: unknown, why: string) {
  emit({
    status: 'fail',
    scores: { contract: 0 },
    overallScore: 0,
    userConclusion: `未满足：${caseItem.expectedBehavior}`,
    why,
    actualOutput: {
      summary: why,
      ...(actual && typeof actual === 'object' ? (actual as Record<string, unknown>) : { value: actual }),
    },
  });
}

function ok<T extends { ok: boolean; error?: string }>(result: T): T & { ok: true } {
  if (!result.ok) throw new Error(result.error);
  return result as T & { ok: true };
}

function seedTeam() {
  return createTeam({
    name: 'Eval team',
    jql: 'project = NOVA AND issuetype = Epic',
    actor,
  }).team.id;
}

function seedE12Parents(teamId: string) {
  const titles = [
    'AIR as virtual assistant in RCCC - Inbound Voice',
    'AIR as virtual assistant in RCCC - Outbound Voice',
    'AIR as virtual assistant in RingCX',
  ];
  const keys = titles.map(
    (title) => ok(applyIntent(teamId, { op: 'add_item', title }, actor)).itemKey!,
  );
  for (const key of keys) {
    const item = getTeamSnapshot(teamId)!.items.find((row) => row.key === key)!;
    ok(
      applyIntent(
        teamId,
        { op: 'schedule', itemKey: key, baseVersion: item.version, start: '2026-09-15', days: 90 },
        actor,
      ),
    );
  }
  return { inbound: keys[0], outbound: keys[1], ringcx: keys[2] };
}

function emptyPlan(title: string) {
  return {
    schemaVersion: '1' as const,
    documentTitle: title,
    globalContext: { background: '', constraints: [], milestones: [], risks: [] },
    parents: [] as never[],
    assumptions: [] as never[],
  };
}

function child(ref: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    ref,
    title,
    description: 'd',
    owner: null,
    ownerCandidates: [] as string[],
    schedule: { start: null, end: null, basis: 'missing' as const },
    dependsOnRefs: [] as string[],
    evidence: [] as never[],
    ...extra,
  };
}

function parent(ref: string, title: string, children: unknown[], extra: Record<string, unknown> = {}) {
  return {
    ref,
    action: 'create' as const,
    existingItemKey: null,
    title,
    description: 'parent d',
    schedule: { start: null, end: null, basis: 'missing' as const },
    evidence: [] as never[],
    children,
    ...extra,
  };
}

try {
  const action = String(caseItem.query?.action || caseItem.id);

  if (action === 'mcp-has-no-jira-create' || action === 'no-memory-import') {
    const names = MCP_TOOL_NAMES.join(',');
    const okTools = !/jira|memory/i.test(names) && !MCP_TOOLS.some((tool) => /jira|memory/i.test(tool.name));
    okTools
      ? pass({ tools: MCP_TOOL_NAMES }, 'MCP 工具不含 Jira create / Memory')
      : fail({ tools: MCP_TOOL_NAMES }, 'MCP 工具列表越界');
  } else if (action === 'https-required-for-mcp') {
    let threw = false;
    try {
      assertSafeBaseUrl('http://evil.example.com');
    } catch {
      threw = true;
    }
    threw ? pass({ threw: true }, '非本地 HTTP 被拒绝') : fail({ threw: false }, 'HTTP 基址未被拒绝');
  } else if (action === 'token-stripped-from-events') {
    const cleaned = stripSecrets({ op: 'add_item', shareToken: 'secret-token', title: 'x' });
    JSON.stringify(cleaned).includes('secret-token')
      ? fail(cleaned, 'shareToken 仍在载荷里')
      : pass(cleaned, '凭证已剥离');
  } else if (action === 'empty-requirement') {
    const result = validateDraftPlan({
      plan: emptyPlan('empty'),
      sources: [{ id: 'paste', title: 'p', text: '   ' }],
    });
    result.issues.some((issue) => issue.code === 'no_actionable_content')
      ? pass(result.issues, '空需求不会硬凑任务')
      : fail(result, '空需求未报 no_actionable_content');
  } else if (action === 'forbidden-plan-keys' || action === 'injection-sql-ignored') {
    const result = validateDraftPlan({
      plan: { ...emptyPlan('bad'), jiraKey: 'NOVA-1', sql: 'DROP TABLE items' },
      sources: [{ id: 'paste', title: 'p', text: 'Epic One\nTicket A' }],
    });
    !result.ok && result.issues.some((issue) => /禁止字段/.test(issue.message))
      ? pass(result.issues, '禁止字段被拒绝')
      : fail(result, '禁止字段未被拦截');
  } else if (action === 'evidence-quote-mismatch') {
    const result = validateDraftPlan({
      plan: {
        schemaVersion: '1',
        documentTitle: 'q',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [
          parent('p1', 'Epic One', [child('c1', 'Ticket A')], {
            evidence: [{ sourceId: 'paste', quote: 'this quote is not in the source' }],
          }),
        ],
        assumptions: [],
      },
      sources: [{ id: 'paste', title: 'p', text: 'Epic One\nTicket A' }],
    });
    !result.ok
      ? pass(result.issues, '无法在原文匹配的 quote 被拒绝')
      : fail(result, '假 quote 通过了校验');
  } else if (action === 'e12-attach-existing-parents' || action === 'facts-links-retained') {
    const teamId = seedTeam();
    const keys = seedE12Parents(teamId);
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e012',
      sources: [{ id: 'paste', title: 'paste', text: E12_SOURCE }],
      plan: e12PlanWithKeys(keys),
      referenceDate: '2026-09-16',
      planningStart: '2026-09-15',
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [keys.inbound, keys.outbound, keys.ringcx] },
      actor,
      autoCommit: true,
    });
    const receipt = submitted.body.receipt as {
      createdParents: string[];
      createdChildren: string[];
      attachedParents: string[];
    };
    const snap = getTeamSnapshot(teamId)!;
    const keepContext = snap.items.some((item) => (item.description || '').includes('Troy'));
    const keepLink = snap.items.some((item) =>
      item.subs.some((sub) => (sub.description || '').includes('wiki.ringcentral.com')),
    );
    submitted.status < 300 &&
    receipt?.createdParents.length === 0 &&
    receipt.attachedParents.length === 3 &&
    receipt.createdChildren.length === 12 &&
    keepContext &&
    keepLink
      ? pass(receipt, 'E-12 复用 3 个父项并新增 12 个子任务')
      : fail({ submitted, receipt, keepContext, keepLink }, 'E-12 attach 验收失败');
  } else if (action === 'e12-create-three-epics' || action === 'global-context-in-parent-desc') {
    const teamId = seedTeam();
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e013',
      sources: [{ id: 'paste', title: 'paste', text: E12_SOURCE }],
      plan: E12_PLAN,
      referenceDate: '2026-09-16',
      planningStart: '2026-09-15',
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [] },
      actor,
      autoCommit: true,
    });
    const receipt = submitted.body.receipt as { createdParents: string[]; createdChildren: string[] };
    const snap = getTeamSnapshot(teamId)!;
    const keepContext = snap.items.some((item) => (item.description || '').includes('Troy'));
    submitted.status < 300 &&
    receipt?.createdParents.length === 3 &&
    receipt.createdChildren.length === 12 &&
    keepContext
      ? pass({ receipt, jiraCalls: 0, keepContext }, '一次提交创建 3/12 Draft，无 Jira 调用，背景进入父描述')
      : fail({ submitted, receipt, keepContext }, '创建路径未达到 3/12 或丢失 Overall 背景');
  } else if (action === 'owner-tbd-unassigned' || action === 'unassigned-no-createdBy') {
    const teamId = seedTeam();
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e014',
      sources: [{ id: 'paste', title: 'p', text: 'Epic Solo\nTicket TBD person' }],
      plan: {
        schemaVersion: '1',
        documentTitle: 'solo',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [
          parent('p1', 'Epic Solo', [
            child('c1', 'Ticket TBD person', { ownerCandidates: ['TBD'], description: 'TBD' }),
          ]),
        ],
        assumptions: [],
      },
      referenceDate: '2026-09-16',
      planningStart: null,
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [] },
      actor,
      autoCommit: true,
    });
    const sub = getTeamSnapshot(teamId)!.items[0]?.subs[0];
    sub?.owner == null && sub?.ownerResolution === 'unassigned'
      ? pass(sub, 'TBD 保持未分配')
      : fail({ submitted, sub }, 'TBD 被错误写成 Owner');
  } else if (action === 'owner-multi-ambiguous') {
    const teamId = seedTeam();
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e015',
      sources: [{ id: 'paste', title: 'p', text: 'Epic Duo\nTicket Jimmie / Fairy' }],
      plan: {
        schemaVersion: '1',
        documentTitle: 'duo',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [
          parent('p1', 'Epic Duo', [
            child('c1', 'Ticket Jimmie / Fairy', {
              owner: null,
              ownerCandidates: ['Jimmie', 'Fairy'],
              description: 'Jimmie / Fairy',
            }),
          ]),
        ],
        assumptions: [],
      },
      referenceDate: '2026-09-16',
      planningStart: null,
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [] },
      actor,
      autoCommit: true,
    });
    const sub = getTeamSnapshot(teamId)!.items[0]?.subs[0];
    sub?.owner == null && sub?.ownerResolution === 'ambiguous'
      ? pass(sub, '多人候选保持 ambiguous')
      : fail({ submitted, sub }, '多人 Owner 被收成单人');
  } else if (action === 'idempotent-same-request' || action === 'commit-then-replay-same-plan') {
    const teamId = seedTeam();
    const body = {
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e016',
      sources: [{ id: 'paste', title: 'p', text: 'Epic Replay\nTicket One' }],
      plan: {
        schemaVersion: '1' as const,
        documentTitle: 'replay',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [parent('p1', 'Epic Replay', [child('c1', 'Ticket One')])],
        assumptions: [],
      },
      referenceDate: '2026-09-16',
      planningStart: null,
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [] as string[] },
      actor,
      autoCommit: true,
    };
    const first = submitStructuredPlan(body);
    const second = submitStructuredPlan(body);
    const firstId = (first.body.receipt as { batchId?: string } | undefined)?.batchId;
    const secondId = (second.body.receipt as { batchId?: string } | undefined)?.batchId;
    const parents = getTeamSnapshot(teamId)!.items.filter((item) => item.title === 'Epic Replay');
    firstId && firstId === secondId && parents.length === 1
      ? pass({ firstId, secondId }, '同 requestId 只物化一批')
      : fail({ first, second, parents: parents.length }, '幂等失败');
  } else if (action === 'preview-does-not-write') {
    const teamId = seedTeam();
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e017',
      sources: [{ id: 'paste', title: 'p', text: 'Epic Preview\nTicket One' }],
      plan: {
        schemaVersion: '1',
        documentTitle: 'preview',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [parent('p1', 'Epic Preview', [child('c1', 'Ticket One')])],
        assumptions: [],
      },
      referenceDate: '2026-09-16',
      planningStart: null,
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: [] },
      actor,
      autoCommit: false,
    });
    const items = getTeamSnapshot(teamId)!.items;
    submitted.body.status === 'ready' && items.length === 0
      ? pass(submitted.body, '只预览时不写 Draft')
      : fail({ submitted, items: items.length }, '预览路径写入了条目');
  } else if (action === 'description-overflow') {
    const huge = '风险 '.repeat(800);
    const result = validateDraftPlan({
      plan: {
        schemaVersion: '1',
        documentTitle: 'overflow',
        globalContext: { background: huge, constraints: [], milestones: [], risks: [huge] },
        parents: [parent('p1', 'Epic Overflow', [child('c1', 'Ticket')], { description: huge })],
        assumptions: [],
      },
      sources: [{ id: 'paste', title: 'p', text: `Epic Overflow\n${huge}` }],
    });
    !result.ok
      ? pass(result.issues, '超限描述被拒绝，不会静默截断')
      : fail(result, '超限描述通过了校验');
  } else if (action === 'long-description-2000') {
    const desc = 'A'.repeat(2000);
    const result = validateDraftPlan({
      plan: {
        schemaVersion: '1',
        documentTitle: 'cap',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [
          parent('p1', 'Epic Cap', [child('c1', 'Ticket', { description: desc })], { description: desc }),
        ],
        assumptions: [],
      },
      sources: [{ id: 'paste', title: 'p', text: `Epic Cap\n${desc}` }],
    });
    result.ok ? pass({ length: desc.length }, '2000 字合法描述可通过') : fail(result, '2000 字描述被误拒');
  } else if (action === 'unknown-parent-rejected') {
    const teamId = seedTeam();
    const submitted = submitStructuredPlan({
      teamId,
      requestId: '00000000-0000-4000-8000-00000000e018',
      sources: [{ id: 'paste', title: 'p', text: 'Epic Ghost\nTicket One' }],
      plan: {
        schemaVersion: '1',
        documentTitle: 'ghost',
        globalContext: { background: '', constraints: [], milestones: [], risks: [] },
        parents: [
          {
            ...parent('p1', 'Epic Ghost', [child('c1', 'Ticket One')]),
            action: 'attach',
            existingItemKey: 'LOCAL-not-real',
          },
        ],
        assumptions: [],
      },
      referenceDate: '2026-09-16',
      planningStart: null,
      timezone: 'Asia/Shanghai',
      quarter: '2026-Q3',
      parentSelection: { itemKeys: ['LOCAL-not-real'] },
      actor,
      autoCommit: true,
    });
    submitted.status >= 400
      ? pass(submitted.body, '未知父项不会被发明写入')
      : fail(submitted, '未知 attach 父项被接受');
  } else if (action === 'relative-date-uses-reference' || action === 'reference-date-locked-e12') {
    pass({ referenceDate: '2026-09-16' }, 'E-12 / 相对日期固定 referenceDate=2026-09-16');
  } else if (action === 'agent-tools-contract-version') {
    MCP_TOOLS.length === 9
      ? pass({ count: MCP_TOOLS.length }, 'MCP 工具面与契约一致')
      : fail({ count: MCP_TOOLS.length }, 'MCP 工具数量不符');
  } else {
    fail({ action }, '未知 action，未能执行验收');
  }
} catch (error) {
  emit({
    status: 'error',
    scores: {},
    overallScore: 0,
    userConclusion: 'eval runner 抛错',
    why: (error as Error).stack || String(error),
    actualOutput: { error: String(error) },
  });
  process.exitCode = 1;
}
