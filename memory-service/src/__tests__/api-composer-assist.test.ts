import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const llmGenerateMock = vi.hoisted(() => vi.fn());
const llmGenerateJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

vi.mock('../llm/LLMClient.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    generate: llmGenerateMock,
    generateJSON: llmGenerateJsonMock,
    generateStream: vi.fn(),
  })),
  getLLMClient: () => ({
    generate: llmGenerateMock,
    generateJSON: llmGenerateJsonMock,
  }),
}));

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { ContextAssistService } from '../core/ContextAssistService.js';

describe('Composer Assist API (POST /composer/assist)', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    llmGenerateMock.mockReset();
    llmGenerateJsonMock.mockReset();
    llmGenerateMock.mockResolvedValue({
      content:
        'Factory AI 试用已经过了 security approval，但 production 场景还是要用 RingCentral email login。',
    });
    llmGenerateJsonMock.mockImplementation(async (prompt: string) => {
      const jsonStart = prompt.indexOf('{');
      const input = JSON.parse(prompt.slice(jsonStart)) as {
        currentDraft: string;
        outputLanguage: 'cjk' | 'latin' | 'unknown';
        candidateMemories: Array<{ id: string; context: string }>;
      };
      const usedEvidenceIds = input.candidateMemories.map((item) => item.id);
      const context = input.candidateMemories
        .map((item) => item.context)
        .join('；');
      if (usedEvidenceIds.length > 0) {
        return {
          mode: 'context_pack',
          insertText:
            input.outputLanguage === 'cjk'
              ? `请把以下与当前问题直接相关的项目背景作为补充上下文，并在回答前核对其中的状态：${context}。这些内容只用于补充背景，不是已经验证的外部证据，也不要据此编造结论。`
              : `Use this directly relevant context for the current prompt without treating it as verified external evidence: ${context}`,
          usedEvidenceIds,
          gaps: ['relevant context'],
          confidence: 0.86,
        };
      }
      return {
        mode: 'rewrite_prompt',
        insertText:
          input.outputLanguage === 'cjk'
            ? `请完整处理以下任务，并保留其原始目标：${input.currentDraft}\n\n请明确分析范围、证据要求、不确定性和输出结构；信息不足时先列出需要补充的问题。`
            : `Complete the following task while preserving its original objective: ${input.currentDraft}\n\nDefine the scope, evidence requirements, uncertainty, and output structure. Ask for missing information instead of inventing it.`,
        usedEvidenceIds: [],
        gaps: ['scope', 'evidence', 'output structure'],
        confidence: 0.86,
      };
    });

    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM memory_outcome_events').run();
    db.prepare('DELETE FROM memory_outcome_policy_patches').run();
    db.prepare('DELETE FROM skill_platform_bindings').run();
    db.prepare('DELETE FROM skill_versions').run();
    db.prepare('DELETE FROM personal_skills').run();
    db.prepare('DELETE FROM source_memory_events').run();
    db.prepare('DELETE FROM source_memory_links').run();
    db.prepare('DELETE FROM source_memory_triggers').run();
    db.prepare('DELETE FROM source_memory_takeaways').run();
    db.prepare('DELETE FROM source_memory_anchors').run();
    db.prepare('DELETE FROM source_memory_capsules').run();
    db.prepare('DELETE FROM rehearsal_activations').run();
    db.prepare('DELETE FROM rehearsals').run();
    db.prepare('DELETE FROM user_writing_style_memories').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();

    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9201,
      content:
        'Factory AI free trial passed security approval, but production usage must use RingCentral email login.',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 60,
    });
    insertChunk({
      id: 9202,
      content:
        'Cross AI handoff should inject a concise Personal AI context pack into the current ChatGPT prompt.',
      sourceType: 'ai_chat',
      source: 'chatgpt',
      scope: 'work',
      createdAt: now - 30,
    });
    insertChunk({
      id: 9203,
      content:
        'Doubao conversation memory says do not auto-send prompts when transferring context to another AI platform.',
      sourceType: 'doubao',
      source: 'doubao',
      scope: 'work',
      createdAt: now - 20,
    });
  });

  function insertChunk(args: {
    id: number;
    content: string;
    sourceType: string;
    source: string;
    scope: string;
    createdAt: number;
  }): void {
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, related_project, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.id,
      `messages/${args.id}`,
      1,
      1,
      args.content,
      `hash-${args.id}`,
      args.scope,
      args.source,
      args.sourceType,
      'Personal AI',
      args.createdAt,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      args.id,
      args.content,
    );
  }

  it('rejects unknown surfaces', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'unknown_surface',
        contextType: 'web_agent_prompt',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('short-circuits RingCentral composer recall when passive search is disabled', async () => {
    const previousFastMode = process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
    const previousSearch = process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
    process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
    process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'false';

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/composer/assist',
        payload: {
          surface: 'ringcentral_message',
          contextType: 'message_thread',
          scenario: 'instant_message_reply',
          title: 'RingCentral Staff Slides Update',
          primaryText:
            'Staff slides Rooms NC JVD Webinar done. P1 non-production fixed.',
          visibleMessages: [
            {
              id: 'm1',
              sender: 'Daniel Huang',
              text: '上周 Rooms 新增一个 P1 非 production，已 fix',
              timestampLabel: '6/26 9:56 AM',
            },
          ],
          debug: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.available).toBe(false);
      expect(body.debug?.recall?.rejectedReason).toBe(
        'passive_fast_search_disabled',
      );
      expect(llmGenerateMock).not.toHaveBeenCalled();
    } finally {
      if (previousFastMode === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = previousFastMode;
      }
      if (previousSearch === undefined) {
        delete process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED;
      } else {
        process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = previousSearch;
      }
    }
  });

  it('returns a preview-required AI context pack for web agent prompts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        title: 'ChatGPT',
        draftText: 'Help me design cross AI prompt injection for Personal AI',
        primaryText: 'current prompt is about cross AI handoff context pack',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['ai_chat', 'doubao'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.insertMode).toBe('append_patch');
    expect(body.previewRequired).toBe(true);
    expect(body.riskLevel).toBe('medium');
    expect(body.insertText).not.toContain('Personal AI context pack (review before sending)');
    expect(body.insertText).not.toContain('Please review and edit before sending');
    expect(body.insertText).toContain('directly relevant context');
    expect(body.insertText).not.toContain('任务判断');
    expect(body.insertText).not.toContain('目标工具适配');
    expect(body.evidence.length).toBeGreaterThan(0);
    expect(body.personaProjection).toMatchObject({
      scene: 'web_ai_context_pack',
      representationMode: 'context_pack_copyable',
      voiceMode: 'speak_about_user',
      requiresPreview: true,
    });
  });

  it('rewrites a Chinese childcare research prompt without requiring memory', async () => {
    const draftText =
      '请针对幼儿是早些进幼儿园还是迟些进幼儿园的利弊，先检索专业的论文以及专业人士的发言或书籍，对这个问题的各方面影响做一个总结的判断。然后结合我的小孩的目前发育情况，给我一个推荐的决策。';
    llmGenerateJsonMock.mockResolvedValueOnce({
      mode: 'rewrite_prompt',
      insertText: [
        '请以发展心理学、儿童健康与学前教育研究者的视角，评估幼儿早些进入幼儿园与迟些进入幼儿园的利弊，并给出可执行的个体化决策建议。',
        '',
        '研究要求：优先检索同行评审论文、系统综述、权威机构资料、专业人士可核验的发言及专业书籍，提供可核验引用；区分相关性与因果关系，并说明研究设计、样本年龄、托育质量和家庭背景等混杂因素。',
        '',
        '分析维度：依恋与压力、语言和认知、社交与情绪、身体健康、照护质量、家庭资源、入园适应以及短期和长期影响；同时呈现支持早入园、迟入园和条件性结论的证据。',
        '',
        '决策部分：先给出一般证据结论，再结合我已提供的小孩发育情况进行个体化判断。若年龄、语言、情绪调节、分离适应、健康、照护环境或幼儿园质量信息不足，请先列出必须补充的问题，不要自行编造或作医学诊断。',
        '',
        '输出格式：证据摘要、争议与不确定性、多维对照表、一般结论、个体化决策矩阵、最终建议和过渡实施方案。',
      ].join('\n'),
      usedEvidenceIds: [],
      gaps: ['evidence method', 'decision criteria', 'missing child context'],
      confidence: 0.9,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText,
        primaryText: 'New blank AI chat',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['manual'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('rewrite_prompt');
    expect(body.insertMode).toBe('replace_draft');
    expect(body.riskLevel).toBe('high');
    expect(body.previewRequired).toBe(true);
    expect(body.evidence).toEqual([]);
    expect(body.insertText).toContain('同行评审论文');
    expect(body.insertText).toContain('区分相关性与因果关系');
    expect(body.insertText).toContain('一般证据结论');
    expect(body.insertText).toContain('个体化决策矩阵');
    expect(body.insertText).toContain('必须补充的问题');
    expect(body.insertText).not.toMatch(
      /Gemma 4|chunk\s*:|no preview available|事实变化|NotebookLM|owner/i,
    );
    const compilerOptions = llmGenerateJsonMock.mock.calls[0][1];
    expect(compilerOptions.systemPrompt).toContain(
      'same dominant natural language as currentDraft',
    );
    expect(compilerOptions.maxTokens).toBe(1600);
    expect(compilerOptions.timeoutMs).toBe(30_000);
    expect(compilerOptions.reasoningEffort).toBe('none');
  });

  it('filters placeholder, duplicate, and off-topic memories before prompt compilation', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'chunk:38982',
          type: 'chunk',
          score: 0.9,
          title: '事实变化',
          snippet: 'chunk:38982: (no preview available)',
          links: [],
        },
        {
          id: 'chunk:38982',
          type: 'chunk',
          score: 0.89,
          title: '事实变化',
          snippet: '(no preview available)',
          links: [],
        },
        {
          id: 'reflection:gemma-license',
          type: 'reflection_thread',
          score: 0.84,
          title: 'Fallback local research',
          snippet:
            'Fallback local research for unresolved reflection question: Gemma 4 license 是否还会继续变化？',
          links: [],
        },
      ],
      topMatch: null,
      queryTimeMs: 2,
      debug: {},
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });
    llmGenerateJsonMock.mockResolvedValueOnce({
      mode: 'rewrite_prompt',
      insertText:
        '请研究幼儿早些进入幼儿园与迟些进入幼儿园的影响，核验专业论文与书籍，区分相关性和因果关系，再结合已提供的小孩发育情况给出决策；信息不足时先提问。',
      usedEvidenceIds: [],
      gaps: ['evidence', 'personalization'],
      confidence: 0.88,
    });

    const body = await service.assistComposer({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      title: 'ChatGPT',
      draftText:
        '请研究幼儿早些进幼儿园还是迟些进幼儿园，并结合我的小孩发育情况给出决策。',
      primaryText: 'New blank AI chat',
      identifiers: { provider: 'chatgpt' },
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('rewrite_prompt');
    expect(body.evidence).toEqual([]);
    expect(body.debug?.rawEvidenceCount).toBe(3);
    expect(body.debug?.filteredEvidenceCount).toBe(0);
    const compilerPrompt = String(llmGenerateJsonMock.mock.calls[0][0]);
    expect(compilerPrompt).not.toMatch(
      /Gemma 4|chunk:38982|no preview available|事实变化/,
    );
  });

  it('gates mixed Jira evidence before Web AI context-pack compilation', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'mtr-141852-status',
          type: 'message',
          scope: 'work',
          score: 0.94,
          title: 'MTR-141852 release status',
          snippet:
            'MTR-141852 Jira ticket status and release risk are still under review.',
          links: [],
          matchedAnchors: { projects: ['MTR-141852'] },
          metadata: {
            issueKey: 'MTR-141852',
            relatedProject: 'MTR',
          },
        },
        {
          id: 'nav-8891-status-noise',
          type: 'message',
          scope: 'work',
          score: 0.93,
          title: 'NAV-8891 release status',
          snippet:
            'NAV-8891 Jira ticket status and release risk belong to another project.',
          links: [],
          matchedAnchors: { projects: ['NAV-8891'] },
          metadata: {
            issueKey: 'NAV-8891',
            relatedProject: 'NAV',
          },
        },
      ],
      topMatch: null,
      queryTimeMs: 2,
      debug: {},
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });

    const body = await service.assistComposer({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      title: 'ChatGPT - MTR-141852 status',
      draftText:
        '请根据 MTR-141852 Jira ticket status 和 release risk 生成评审摘要。',
      primaryText: 'Current task is a Jira ticket status and release risk review.',
      identifiers: { provider: 'chatgpt', issueKey: 'MTR-141852' },
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.evidence.map((item) => item.id)).toEqual([
      'mtr-141852-status',
    ]);
    expect(body.cohesionReceipt).toMatchObject({
      policyVersion: 'evidence-cohesion-v1',
      state: 'cohesive',
      usedCount: 1,
      excludedCount: 1,
      silent: true,
    });
    const compilerPrompt = String(llmGenerateJsonMock.mock.calls.at(-1)?.[0]);
    expect(compilerPrompt).toContain('MTR-141852');
    expect(compilerPrompt).not.toContain('NAV-8891');
  });

  it('resolves locked context evidence before compiling a context pack', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source_title, timestamp, created_at, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'orbit-release-evidence',
      'Project Orbit deployment checks were flaky in the latest two runs. Maya requires two stable runs before calling the release safe.',
      'manual',
      'Project Orbit release review',
      now,
      now,
      'work',
    );

    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [],
      topMatch: null,
      queryTimeMs: 2,
      debug: {
        normalizedQuery: 'Project Orbit deployment checks Maya release',
        channelsHit: [],
        contextExpansion: {
          contextMatch: {
            state: 'locked',
            selectedTopic: {
              id: 'topic:project-orbit-release',
              label: 'Project Orbit release review',
              score: 0.91,
              reasons: ['Project Orbit and deployment checks matched'],
              evidenceIds: ['orbit-release-evidence'],
            },
            candidates: [],
          },
        },
      },
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });
    llmGenerateJsonMock.mockResolvedValueOnce({
      mode: 'rewrite_prompt',
      insertText:
        '请完整重写 Project Orbit release 风险说明，并纳入 deployment checks 与 Maya 的判断标准。',
      usedEvidenceIds: ['orbit-release-evidence'],
      gaps: ['current deployment check status'],
      confidence: 0.9,
    });

    const body = await service.assistComposer({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      title: 'ChatGPT - Project Orbit release risk',
      draftText:
        '请写 Project Orbit release 风险说明，重点核对 deployment checks 是否稳定。',
      primaryText: 'Maya 之前如何判断 release risk？',
      identifiers: { provider: 'chatgpt' },
      sourceTypes: ['manual'],
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.insertMode).toBe('append_patch');
    expect(body.riskLevel).toBe('medium');
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0]).toMatchObject({
      id: 'orbit-release-evidence',
      type: 'message',
      sourceLabel: 'manual',
    });
    expect(body.insertText).toContain('Project Orbit');
    expect(body.insertText).not.toContain('请完整重写');
    expect(body.debug?.compiler).toMatchObject({
      mode: 'context_pack',
      rawMode: 'rewrite_prompt',
      modeNormalized: true,
    });
    expect(String(llmGenerateJsonMock.mock.calls[0][0])).toContain(
      'deployment checks were flaky',
    );
  });

  it('fails closed when the compiler returns the wrong language', async () => {
    llmGenerateJsonMock.mockResolvedValueOnce({
      mode: 'rewrite_prompt',
      insertText:
        'Research the advantages and disadvantages of starting kindergarten earlier or later, then provide a decision framework.',
      usedEvidenceIds: [],
      gaps: ['evidence'],
      confidence: 0.9,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        draftText: '请研究幼儿早入园还是迟入园，并给出建议。',
        primaryText: 'New blank AI chat',
        sourceTypes: ['manual'],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      available: false,
      suggestionType: 'none',
    });
  });

  it('fails closed when the compiler response is invalid JSON', async () => {
    llmGenerateJsonMock.mockRejectedValueOnce(
      new SyntaxError('Unexpected token in JSON'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        draftText:
          'Research whether an earlier or later kindergarten start is better and recommend a decision.',
        primaryText: 'New blank AI chat',
        sourceTypes: ['manual'],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      available: false,
      suggestionType: 'none',
    });
  });

  it('fails closed when the compiler request times out', async () => {
    llmGenerateJsonMock.mockRejectedValueOnce(
      new Error('llm_request_timeout'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        draftText:
          'Research whether an earlier or later kindergarten start is better and recommend a decision.',
        primaryText: 'New blank AI chat',
        sourceTypes: ['manual'],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      available: false,
      suggestionType: 'none',
    });
  });

  it('keeps English prompt rewrites in English', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        draftText:
          'Compare early versus late kindergarten entry using professional research and recommend a decision.',
        primaryText: 'New blank AI chat',
        sourceTypes: ['manual'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('rewrite_prompt');
    expect(body.insertMode).toBe('replace_draft');
    expect(body.insertText).toContain('preserving its original objective');
    expect(body.insertText).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('keeps task framing and target-tool fit in debug only for compose-to-AI prompts', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9221,
      content:
        'Codex CLI session result: user asked to fix the Personal AI Composer Guard repo bug, Codex changed ContextAssistService and ran composer-assist tests.',
      sourceType: 'codex_cli',
      source: 'codex_cli',
      scope: 'work',
      createdAt: now - 10,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Help me fix the repo bug in Personal AI Composer Guard and run tests',
        primaryText: 'Current AI chat is about a repo bug fix',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['codex_cli', 'chatgpt', 'doubao_chat'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).not.toContain('任务判断');
    expect(body.insertText).not.toContain('目标工具适配');
    expect(body.insertText).not.toContain('更适合的备选：codex_cli');
    expect(body.debug.taskFrame.kind).toBe('repo_bugfix');
    expect(body.debug.targetToolFit.betterTool).toBe('codex_cli');
    expect(body.debug.sourceMix.codex_cli).toBeGreaterThan(0);
  });

  it('returns a prompt patch when a web AI prompt needs Jira/Sites task constraints', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9224,
      content:
        'Codex Sites project plan: build a Jira roadmap board and release risk dashboard. Define Jira field contract, release phase, refresh/storage boundary, deployment steps, validation steps, and do not auto-write back to Jira.',
      sourceType: 'codex_cli',
      source: 'codex_cli',
      scope: 'work',
      createdAt: now - 12,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT - Jira roadmap board',
        draftText:
          '帮我做一个 Jira roadmap board，用 Codex Sites 部署，最好能看到 release risk。',
        primaryText: 'New AI chat for planning a Jira roadmap dashboard',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['codex_cli', 'jira', 'glip', 'web'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('prompt_patch');
    expect(body.insertMode).toBe('append_patch');
    expect(body.title).toBe('提问上下文补丁');
    expect(body.summary).toContain('数据源');
    expect(body.summary).toContain('点击 icon 只插入当前 prompt 草稿');
    expect(body.insertText).toContain('数据源');
    expect(body.insertText).toContain('输出格式');
    expect(body.insertText).toContain('不要自动写回 Jira');
    expect(body.insertText).toContain('来源处理');
    expect(body.insertText).toContain('Codex Sites');
    expect(body.debug.promptPatch.intentKind).toBe('codex_sites_dashboard');
    expect(body.personaProjection).toMatchObject({
      scene: 'web_ai_prompt_patch',
      representationMode: 'context_pack_copyable',
      voiceMode: 'never_speak_as_user',
      usedCount: 0,
      requiresPreview: true,
    });
  });

  it('returns an estimate prompt patch with dry-run and missing-reason boundaries', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9225,
      content:
        'Task Estimate workflow: evaluate Jira ticket estimates from Jira team field, Summary, Description, Issue type, and Historical Story Points benchmark. AI Service dry-runs or writes Google Sheet only, not Jira, and must include missing reason or low confidence reason.',
      sourceType: 'jira',
      source: 'jira',
      scope: 'work',
      createdAt: now - 12,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT - estimate tickets',
        draftText:
          '帮我分析这些 Jira ticket 的 estimate，看看能不能自动生成 Dev/QA 估算。',
        primaryText: 'New AI chat for Jira estimate analysis',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['jira', 'glip', 'manual'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('prompt_patch');
    expect(body.insertMode).toBe('append_patch');
    expect(body.title).toBe('估算口径补丁');
    expect(body.insertText).toContain('依据字段');
    expect(body.insertText).toContain('Historical Story Points benchmark');
    expect(body.insertText).toContain('missing reason / low confidence reason');
    expect(body.insertText).toContain('不要自动写回 Jira');
    expect(body.insertText).not.toContain('参考来源');
    expect(body.debug.promptPatch.intentKind).toBe('jira_estimate_analysis');
  });

  it('uses locked context-expansion evidence for Jira estimate prompt patches', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [],
      topMatch: null,
      queryTimeMs: 7,
      debug: {
        normalizedQuery: 'Jira estimate prompt patch',
        channelsHit: [],
        contextExpansion: {
          contextMatch: {
            state: 'locked',
            selectedTopic: {
              id: 'jira:task-estimate-workflow',
              label: 'Task Estimate workflow',
              aliases: [
                'Task Estimate workflow evaluates Jira ticket estimates from Jira team field, Summary, Description, Issue type, and Historical Story Points benchmark. AI Service should dry-run or write Google Sheet only, not Jira, and must include missing reason / low confidence reason.',
              ],
            },
            candidates: [],
            expandedQuery:
              'Task Estimate workflow Jira ticket estimate Historical Story Points benchmark Google Sheet missing reason low confidence reason',
            userFacingSummary:
              'Locked to Task Estimate workflow from current Jira estimate prompt.',
          },
        },
      },
    });
    Object.defineProperty(service, 'recallService', {
      value: { recall },
    });

    const body = await service.assistComposer({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      title: 'ChatGPT - Jira estimate analysis',
      draftText:
        '帮我分析这些 Jira ticket 的 estimate，看看能不能自动生成 Dev/QA 估算。',
      primaryText:
        'User is asking an external AI for Jira ticket estimate analysis.',
      identifiers: { provider: 'chatgpt' },
      sourceTypes: ['jira', 'glip', 'manual', 'source_memory'],
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('prompt_patch');
    expect(body.insertMode).toBe('append_patch');
    expect(body.confidence).toBe(0.82);
    expect(body.insertText).toContain('Historical Story Points benchmark');
    expect(body.insertText).toContain('missing reason / low confidence reason');
    expect(body.insertText).toContain('不要自动写回 Jira');
    expect(body.insertText).not.toContain('参考来源');
    expect(body.evidence[0].metadata?.fallbackReason).toBe(
      'locked_context_expansion',
    );
  });

  it('keeps Jira status routing in debug without inserting tool recommendations', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9222,
      content:
        'Jira RCV-148412 status: backend is ready for review, FE owner is still tracking blockers, and release timing must be verified in Jira.',
      sourceType: 'jira',
      source: 'jira',
      scope: 'work',
      createdAt: now - 10,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Summarize RCV-148412 status and current blockers before I reply',
        primaryText: 'Current AI chat is about Jira project status',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['jira', 'chatgpt'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).not.toContain('任务判断');
    expect(body.insertText).not.toContain('目标工具适配');
    expect(body.insertText).not.toContain(
      '更适合的备选：jira_or_project_dashboard',
    );
    expect(body.debug.taskFrame.kind).toBe('jira_data_analysis');
    expect(body.debug.targetToolFit.betterTool).toBe(
      'jira_or_project_dashboard',
    );
    expect(body.debug.recallRequest.sourceTypes).toContain('jira');
    expect(body.debug.recallRequest.sourceTypes).not.toContain('chatgpt');
  });

  it('allows saved source-memory capsules in compose-to-AI context packs', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source-memory/capsules',
      payload: {
        sourceKind: 'webpage',
        sourceUrl: 'https://example.com/artifact-lineage',
        sourceTitle: 'Artifact lineage checklist',
        text: 'Artifact lineage checklist source memory: preserve browser evidence, original source URL, and generated artifact revisions before asking another AI to continue the workflow.',
        captureMode: 'manual',
        interactions: {
          copiedText: true,
          manualClick: true,
        },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    const capsuleId = saveRes.json().capsule.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        scenario: 'compose_to_ai',
        title: 'ChatGPT',
        draftText:
          'Use the artifact lineage checklist before this workflow continues',
        primaryText: 'Current AI prompt is about artifact lineage handoff',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['source_memory', 'chatgpt'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.insertMode).toBe('append_patch');
    expect(body.insertText).toContain('Artifact lineage checklist');
    expect(
      body.evidence.some(
        (item: any) =>
          item.type === 'source_memory' &&
          item.metadata?.sourceMemoryCapsuleId === capsuleId,
      ),
    ).toBe(true);
    expect(body.debug.recallRequest.sourceTypes).toContain('source_memory');
    expect(body.debug.recallRequest.sourceTypes).not.toContain('chatgpt');
  });

  it('uses Web AI draft text as the context-enrichment recall signal', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 8, ?)`,
    ).run(
      'project-ai-vbg',
      'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      JSON.stringify(['AI VBG', 'VBG', 'AI Generated Background']),
      now,
    );
    insertChunk({
      id: 9211,
      content:
        'AI-Generated VBG backend status: RCV-148412 is ready for review, while FE follow-up is still separate.',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 15,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'chatgpt',
        contextType: 'web_agent_prompt',
        title: 'ChatGPT',
        primaryText: 'New blank AI chat',
        draftText: 'AI VBG 的 BE 部分完成情况如何',
        identifiers: { provider: 'chatgpt' },
        sourceTypes: ['glip', 'jira', 'manual'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('context_pack');
    expect(body.insertMode).toBe('append_patch');
    expect(body.insertText).toContain('补充上下文');
    expect(body.insertText).not.toContain('目标：AI VBG 的 BE 部分完成情况如何');
    expect(body.insertText).not.toContain('仍需确认');
    expect(body.evidence.map((item: any) => item.snippet).join('\n')).toContain(
      'RCV-148412',
    );
    expect(body.debug.recallRequest.primaryText).toContain(
      'Draft prompt: AI VBG 的 BE 部分完成情况如何',
    );
    expect(
      body.debug.recall.contextExpansion.expandedQuery,
    ).toContain('AI-Generated VBGs');
    expect(body.debug.recall.contextExpansion.expandedQuery).toContain('backend');
  });

  it('returns reply context for RingCentral threads and includes thread root', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_thread',
        contextType: 'message_thread',
        title: 'AI tools selection',
        draftText: 'Factory AI trial status?',
        primaryText: 'Discussing Factory AI free trial security approval',
        identifiers: {
          conversationId: '1280503250946',
          groupId: '1280503250946',
          threadRootPostId: 'post-1',
        },
        threadRoot: {
          id: 'post-1',
          sender: 'Alice',
          text: 'Can we use Factory AI for production project?',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('reply_context');
    expect(body.insertText).not.toContain('Personal AI context to consider');
    expect(body.insertText).not.toContain('Please review and edit before sending');
    expect(body.insertText).not.toContain('我理解当前是在讨论');
    expect(body.insertText).not.toContain('我这边先补充几个相关点');
    expect(body.insertText).toContain('Factory AI');
    expect(llmGenerateMock).toHaveBeenCalledTimes(1);
  });

  it('uses compiled Jira estimate cue as direct draft hint without LLM fallback', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9251,
      content:
        'MTR-148115 Original Estimate 口径是人天，必要时可以拆成 3h；close 没有硬性要求，due date 需要单独确认。',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 10,
    });

    const payload = {
      surface: 'jira_issue',
      contextType: 'jira_issue',
      scenario: 'jira_comment',
      title: 'MTR-148115 Original Estimate',
      url: 'https://jira.ringcentral.com/browse/MTR-148115',
      primaryText: 'MTR-148115 的 Original Estimate 应该按什么口径填写？',
      identifiers: {
        issueKey: 'MTR-148115',
      },
      audience: {
        issueKey: 'MTR-148115',
        issueSummary: 'Original Estimate',
      },
      visibleFields: [
        {
          name: 'DEV Estimate New',
          value: '0.4',
          rawText: 'DEV Estimate New: 0.4',
        },
      ],
      interactionScene: {
        sceneType: 'jira_comment_composing',
        surface: 'compose_assist',
        userMode: 'comment',
        issueKey: 'MTR-148115',
        activeElement: {
          kind: 'contenteditable',
          role: 'textbox',
          mode: 'comment',
          label: 'Add comment',
          hasFocus: true,
        },
        visibleFacts: [
          {
            kind: 'jira_field',
            name: 'DEV Estimate New',
            value: '0.4',
            rawText: 'DEV Estimate New: 0.4',
            source: 'current_page',
            issueKey: 'MTR-148115',
            confidence: 0.94,
          },
        ],
        admission: {
          state: 'composer_ready',
          reasons: ['issue_key', 'visible_facts'],
          confidence: 0.9,
        },
      },
      sourceTypes: ['glip', 'jira', 'manual'],
      debug: true,
    };
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('issue_context');
    expect(body.insertText).toContain('人天口径');
    expect(body.insertText).toContain('MTR-148115');
    expect(body.insertText).toContain('original estimate');
    expect(body.evidence[0].cue?.compileStatus).toBe('compiled');
    expect(body.evidence[0].cue?.actionType).toBe('draft_hint');
    expect(body.evidence[0].cue?.cueKey).toContain('MTR-148115');
    expect(body.evidence[0].cue?.sourceRefs?.length).toBeGreaterThan(0);
    expect(body.personaProjection).toMatchObject({
      scene: 'jira_comment',
      voiceMode: 'write_as_user',
    });
    expect(body.debug.recall.sceneFrame.sceneType).toBe('jira_estimate');
    expect(body.debug.recall.sceneFrame.interactionSceneType).toBe(
      'jira_comment_composing',
    );
    expect(body.debug.recall.cueCompiler.compiledCount).toBeGreaterThan(0);
    expect(llmGenerateMock).not.toHaveBeenCalled();

    for (const id of ['estimate-compose-sent-1', 'estimate-compose-sent-2']) {
      const outcomeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ambient-calibration/traces',
        payload: {
          id,
          surface: 'compose_assist',
          sceneKey: 'jira:MTR-148115:jira_comment_composing:comment',
          action: 'sent_after_insert',
          strength: 'strong',
          polarity: 'positive',
          evidenceRefs: body.evidence.map((item: any) => ({
            id: item.id,
            type: item.type,
            cueId: item.cue?.id,
            cueKey: item.cue?.cueKey,
            cue: item.cue
              ? {
                  id: item.cue.id,
                  cueKey: item.cue.cueKey,
                  actionType: item.cue.actionType,
                  compileStatus: item.cue.compileStatus,
                  confidence: item.cue.confidence,
                }
              : undefined,
          })),
          metadata: {
            cueIds: [body.evidence[0].cue.id],
            cueKeys: [body.evidence[0].cue.cueKey],
          },
          privacyClass: 'sensitive_redacted',
        },
      });
      expect(outcomeRes.statusCode).toBe(200);
    }

    const boostedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload,
    });
    expect(boostedRes.statusCode).toBe(200);
    const boosted = boostedRes.json();
    expect(boosted.evidence[0].cue?.outcomePolicy?.action).toBe('boost');
    expect(boosted.debug.recall.cueCompiler.boostedCount).toBeGreaterThan(0);

    const skill = db
      .prepare(
        `SELECT title, status, suggested_from
           FROM personal_skills
          WHERE suggested_from = 'memory_outcome_loop'
          LIMIT 1`,
      )
      .get() as
      | {
          title: string;
          status: string;
          suggested_from: string;
        }
      | undefined;
    expect(skill).toMatchObject({
      title: 'Estimate wording helper',
      status: 'suggestion',
      suggested_from: 'memory_outcome_loop',
    });
  });

  it('keeps scene-cue rehearsal reminders for RingCentral composer assist', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/rehearsals',
        payload: {
          title: 'Next Colin Liu check-in',
          scenarioType: 'person_chat',
          content:
            'Ask Colin whether the review reminder should name a concrete owner.',
          summary: 'Ask Colin to confirm the review owner.',
          activationCues: {
            people: ['Colin Liu'],
            groupIds: ['colin-group'],
          },
          confidence: 0.92,
          priority: 9,
        },
      })
    ).json().rehearsal;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Chat with Colin Liu',
        primaryText: 'Could you reply?',
        identifiers: {
          conversationId: 'colin-group',
          groupId: 'colin-group',
        },
        audience: {
          conversationTitle: 'Colin Liu',
          conversationId: 'colin-group',
          groupId: 'colin-group',
          people: ['Colin Liu'],
        },
        visibleMessages: [
          {
            sender: 'Colin Liu',
            text: 'Could you reply?',
          },
        ],
        sourceTypes: ['rehearsal'],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.summary).toContain('预演提醒');
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe(created.id);
    expect(body.evidence[0].type).toBe('rehearsal');
    expect(body.evidence[0].evidenceRole).toBe('rehearsal_cue');
    expect(body.evidence[0].reasonType).toBe('prospective_cue');
    expect(body.evidence[0].whyRelevant).toEqual(
      expect.arrayContaining(['人物：Colin Liu', '同群聊']),
    );
    expect(body.previewRequired).toBe(true);
    expect(body.riskLevel).toBe('low');
    expect(llmGenerateMock).toHaveBeenCalledTimes(1);
    expect(llmGenerateMock.mock.calls[0][0]).toContain('预演提醒');
  });

  it('uses transferable writing style memory for peer RingCentral replies', async () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
       VALUES (?, 'preference', ?, ?, ?, 'system', 0.84, 1, 'active', 0.84, 3,
               ?, null, null, ?, ?, ?)`,
    ).run(
      'profile-writing-style-peer-zh',
      'writing_style.ringcentral.peer.casual_reply.zh',
      '中文 RingCentral peer 同事轻松回复：可采用：可以用“哈哈”和轻微“~”。避免：不要写“我最喜欢聊了”、泛泛未来承诺或“咱们一起捣鼓下”这类 AI 式热情套话。',
      JSON.stringify([{ traceId: 'ambient-style-peer-1' }]),
      now,
      now,
      now,
      'fingerprint-writing-style-peer-zh',
    );
    insertChunk({
      id: 9240,
      content:
        'Esther 下午要单独找 Esone 请教 Jira PAT token 怎么用；PAT setup 在 Jira personal access token 页面创建 token。',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 5,
    });
    llmGenerateMock.mockImplementation(async (prompt: string) => {
      expect(prompt).toContain(
        'writing_style.ringcentral.peer.casual_reply.zh',
      );
      expect(prompt).toContain('我最喜欢聊了');
      expect(prompt).toContain('咱们一起捣鼓下');
      return {
        content: '哈哈可以，下午你直接找我，我给你过一下 PAT 怎么用~',
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Chat with Esther',
        primaryText:
          'Esther 问下午能不能单独找个时间请教 Jira PAT token 怎么用。',
        identifiers: {
          conversationId: 'esther-dm',
          groupId: 'esther-dm',
        },
        audience: {
          conversationTitle: 'Esther (Xiying) Pan',
          conversationId: 'esther-dm',
          groupId: 'esther-dm',
          people: ['Esther (Xiying) Pan'],
          relationshipHint: 'peer colleague',
        },
        visibleMessages: [
          {
            sender: 'Esther (Xiying) Pan',
            text: '下午单独找个时间跟你请教，哈哈哈',
          },
        ],
        debug: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.insertText).toBe(
      '哈哈可以，下午你直接找我，我给你过一下 PAT 怎么用~',
    );
    expect(body.insertText).not.toContain('我最喜欢聊了');
    expect(body.insertText).not.toContain('咱们一起捣鼓下');
    expect(body.personaProjection).toMatchObject({
      version: 1,
      audienceType: 'peer',
      representationMode: 'draft_only',
      requiresPreview: false,
    });
    expect(body.personaProjection.usedSlotKinds).toContain('writing_style');
    expect(body.debug.personaProjection).toEqual(body.personaProjection);
    expect(llmGenerateMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        retryCount: 0,
        timeoutMs: 4500,
      }),
    );
  });

  it('filters weak composer memories that do not match the current scene', async () => {
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
    const now = Math.floor(Date.now() / 1000);
    insertChunk({
      id: 9301,
      content:
        'Tue Mar 31 — Flight: SFO → HKG · Cathay Pacific CX873 · 12:20 AM–6:15 AM (+1)',
      sourceType: 'calendar',
      source: 'calendar',
      scope: 'work',
      createdAt: now - 60,
    });
    insertChunk({
      id: 9302,
      content:
        'Everyone AI 主题分享 | RingClaw：在 RingCentral 内直接对话多智能体 AI',
      sourceType: 'glip',
      source: 'glip',
      scope: 'work',
      createdAt: now - 50,
    });
    insertChunk({
      id: 9303,
      content:
        '五一假期即将来临，根据国家法定节假日规定并结合公司实际情况，现将2026年劳动节放假安排通知如下：',
      sourceType: 'web',
      source: 'web',
      scope: 'work',
      createdAt: now - 40,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'RingCentral AI reply',
        primaryText: 'Can you reply with the owner and next action?',
        visibleMessages: [
          {
            sender: 'Alice',
            text: 'Can you reply with the owner and next action?',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
    expect(body.insertText).toBeUndefined();
  });

  it('returns an empty result when no memory is relevant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'jira_issue',
        contextType: 'jira_issue',
        title: 'VIDEONONEXISTENT-1',
        primaryText: 'unrelated basalt kitchen cabinet hardware',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
    expect(body.evidence).toEqual([]);
  });

  it('does not use draft text as the recall query signal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/composer/assist',
      payload: {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        title: 'Unrelated chat',
        draftText: 'Factory AI free trial security approval',
        primaryText: 'basalt kitchen cabinet hardware',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
  });

  it('accepts assistIntent and returns prompt_draft for empty Web AI compose', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'factory-ai-security',
          type: 'message',
          scope: 'work',
          score: 0.95,
          title: 'Factory AI security approval',
          snippet:
            'Factory AI free trial already passed security approval for RingCentral email login.',
          links: [],
        },
      ],
      topMatch: null,
      queryTimeMs: 2,
      debug: {},
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });
    llmGenerateJsonMock.mockImplementationOnce(async () => ({
      mode: 'rewrite_prompt',
      insertText:
        'Draft a concise status prompt about Factory AI security approval and RingCentral email login.',
      usedEvidenceIds: ['factory-ai-security'],
      gaps: [],
      confidence: 0.9,
    }));

    const body = await service.assistComposer({
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      assistIntent: 'draft_compose',
      title: 'ChatGPT',
      draftText: '',
      primaryText: 'New blank AI chat about Factory AI rollout',
      visibleMessages: [
        {
          sender: 'assistant',
          text: 'What do you want to ask about Factory AI?',
        },
      ],
      identifiers: { provider: 'chatgpt' },
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('prompt_draft');
    expect(body.insertMode).toBe('replace_draft');
    expect(body.insertText).toMatch(/Factory AI/i);
  });

  it('returns reply_refine for Glip draft refine when gain is material', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'factory-ai-security',
          type: 'message',
          scope: 'work',
          score: 0.96,
          title: 'Factory AI security approval',
          snippet:
            'Factory AI free trial already passed security approval; production still needs RingCentral email login.',
          links: [],
        },
      ],
      topMatch: null,
      queryTimeMs: 2,
      debug: {},
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });
    llmGenerateMock.mockResolvedValueOnce({
      content:
        'Factory AI free trial already passed security approval; production still needs RingCentral email login before rollout.',
    });

    const body = await service.assistComposer({
      surface: 'ringcentral_message',
      contextType: 'message_thread',
      scenario: 'instant_message_reply',
      assistIntent: 'draft_refine',
      title: 'Factory AI rollout',
      draftText: 'trial is approved',
      primaryText: 'Can you confirm Factory AI trial status?',
      visibleMessages: [
        {
          sender: 'Alice',
          text: 'Can you confirm Factory AI trial status?',
        },
      ],
      debug: true,
    });

    expect(body.available).toBe(true);
    expect(body.suggestionType).toBe('reply_refine');
    expect(body.insertMode).toBe('replace_draft');
    expect(body.previewRequired).toBe(true);
    expect(body.debug?.refineReceipt?.pass).toBe(true);
  });

  it('rejects Glip draft refine when incremental gain is insufficient', async () => {
    const service = new ContextAssistService(db, 'default');
    const recall = vi.fn().mockResolvedValue({
      matches: [
        {
          id: 'factory-ai-security',
          type: 'message',
          scope: 'work',
          score: 0.96,
          title: 'Factory AI security approval',
          snippet: 'trial is approved already',
          links: [],
        },
      ],
      topMatch: null,
      queryTimeMs: 2,
      debug: {},
    });
    Object.defineProperty(service, 'recallService', { value: { recall } });
    llmGenerateMock.mockResolvedValueOnce({
      content: 'trial is already approved',
    });

    const body = await service.assistComposer({
      surface: 'ringcentral_message',
      contextType: 'message_thread',
      scenario: 'instant_message_reply',
      assistIntent: 'draft_refine',
      title: 'Factory AI rollout',
      draftText: 'trial is approved',
      primaryText: 'Can you confirm Factory AI trial status?',
      visibleMessages: [
        {
          sender: 'Alice',
          text: 'Can you confirm Factory AI trial status?',
        },
      ],
      debug: true,
    });

    expect(body.available).toBe(false);
    expect(body.suggestionType).toBe('none');
    expect(body.debug?.refineReceipt).toMatchObject({
      pass: false,
      reason: 'insufficient_gain',
    });
  });
});
