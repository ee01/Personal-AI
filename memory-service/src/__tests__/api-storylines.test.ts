import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { mockGenerateJSON } = vi.hoisted(() => ({
  mockGenerateJSON: vi.fn(),
}));

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi
      .fn()
      .mockRejectedValue(new Error('Embedding not available in tests')),
    isLoaded: vi.fn().mockReturnValue(false),
    getModelName: vi.fn().mockReturnValue('mock-model'),
  },
}));

vi.mock('../llm/LLMClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/LLMClient.js')>();
  return {
    ...actual,
    getLLMClient: () => ({
      generateJSON: mockGenerateJSON,
    }),
  };
});

import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { SourceMemoryCaptureService } from '../core/SourceMemoryCaptureService.js';
import { SourceMemoryDistillationWorker } from '../core/SourceMemoryDistillationWorker.js';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Storyline draft API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    mockGenerateJSON.mockReset();
    for (const table of [
      'skill_platform_bindings',
      'skill_versions',
      'personal_skills',
      'source_memory_distilled_artifacts',
      'source_memory_evidence_spans',
      'source_memory_distillation_jobs',
      'source_memory_events',
      'source_memory_links',
      'source_memory_triggers',
      'source_memory_takeaways',
      'source_memory_anchors',
      'source_memory_capsules',
      'today_meeting_preps',
      'calendar_events',
      'messages_raw',
      'chunks',
    ]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare(
      `INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`,
    ).run();
  });

  function buildPrepResponse() {
    return {
      summaryMd: '## Meeting prep\n- Explain AI Notes retry ownership.',
      cueCards: [
        {
          id: 'background',
          kind: 'brief',
          title: 'Background',
          body: 'GeneratedNotes consumption spiked and needs owner clarity.',
          evidenceIds: ['calendar:event-ai-notes'],
        },
        {
          id: 'risk',
          kind: 'memory',
          title: 'Risk',
          body: 'Retry/ack handling may still repeat messages.',
          evidenceIds: ['msg-ai-notes-prep'],
        },
        {
          id: 'next-step',
          kind: 'action',
          title: 'Next step',
          body: 'Confirm owner and deadline.',
          evidenceIds: ['msg-ai-notes-prep'],
        },
      ],
      suggestedQuestions: ['Who owns retry/ack?'],
      risksOrOpenLoops: ['Repeated consumption could continue.'],
      contextPackMd:
        '# Today Pilot meeting prep\n\nExplain owner, risk, and next step.',
      redactionPreview: [],
      storylineOpportunity: {
        available: true,
        confidence: 0.82,
        storyType: 'status_report',
        oneLineReason:
          '这场会有背景、风险和 owner 三段材料，适合整理成项目汇报。',
        audienceHint: 'AI Notes 项目组',
        evidenceClusters: [
          {
            label: 'GeneratedNotes retry',
            sourceKinds: ['calendar', 'meeting'],
            evidenceCount: 3,
          },
        ],
        suggestedArtifact: 'speaker_notes',
      },
      usage: { promptTokens: 12, completionTokens: 24 },
    };
  }

  function buildDraftResponse() {
    return {
      title: 'AI Notes retry owner storyline',
      audience: 'AI Notes 项目组',
      targetArtifact: 'speaker_notes',
      segments: [
        {
          title: '先说明背景',
          intent: '让听众知道为什么现在要谈 owner。',
          narrative: 'GeneratedNotes 消费异常已经影响到 retry/ack 判断。',
          evidenceIds: ['E1'],
        },
        {
          title: '再说明风险',
          intent: '解释为什么不能只当作普通噪音。',
          narrative: '重复消费可能继续放大，导致会议记录或队列状态失真。',
          evidenceIds: ['E2', 'made-up-id'],
        },
        {
          title: '最后收敛行动',
          intent: '把讨论落到 owner 和时间点。',
          narrative: '会议应确认 retry/ack owner、验证方式和下一次检查时间。',
          evidenceIds: ['E1'],
        },
      ],
      gaps: ['确认当前 retry patch 是否已经上线。'],
      riskNotes: ['复制给外部前去掉内部链接。'],
      artifactText:
        '# Speaker Notes\n\n1. 背景\n2. 风险\n3. Owner 和 deadline',
    };
  }

  function buildSourceDeepResponse(prompt: string) {
    const evidenceId = prompt.match(/\[([^\]]+:S1)\]/)?.[1];
    if (!evidenceId) throw new Error('missing source-memory evidence span');
    return {
      oneLineCue: 'Explain why source evidence stays attached.',
      compactMemo: 'The source requires every reusable artifact to retain evidence links.',
      fullMemo: 'Keep source evidence attached and delegate publication to a reviewed draft flow.',
      takeaways: [
        {
          title: 'Evidence remains attached',
          body: 'Every derived claim keeps a valid source span.',
          confidence: 0.91,
          evidenceSpanIds: [evidenceId],
        },
      ],
      triggerCards: [],
      factCandidates: [],
      openQuestions: [],
      skillSeeds: [],
      storylineSeeds: [
        {
          seedKey: 'source-evidence-story',
          title: 'Why source evidence stays attached',
          claim: 'Evidence-linked memory artifacts remain reviewable when reused.',
          audience: 'AI product team',
          risks: ['Do not imply automatic publication.'],
          confidence: 0.88,
          evidenceSpanIds: [evidenceId],
        },
      ],
      sourceReliability: {
        level: 'high',
        reason: 'The source states the workflow explicitly.',
      },
    };
  }

  function seedCalendarEvent() {
    const current = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO calendar_events
        (id, source_system, external_id, series_key, title, description_preview,
         start_at, end_at, organizer_json, attendees_json, cancelled, content_hash,
         metadata_json, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      'cal-ai-notes',
      'ringcentral_indexeddb',
      'event-ai-notes',
      'series-ai-notes',
      'AI Notes owner review',
      'Explain GeneratedNotes retry/ack owner and repeated consumption risk.',
      current + 3600,
      current + 5400,
      JSON.stringify({ name: 'Elina' }),
      JSON.stringify([{ name: 'Esone' }, { name: 'AI Notes owner' }]),
      'hash-ai-notes-event',
      '{}',
      current,
      current,
      current,
    );
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, source, source_url, source_title, sender,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-ai-notes-prep',
      'AI Notes GeneratedNotes retry/ack owner remains open after repeated consumption.',
      'meeting',
      'meeting',
      'https://internal.example.com/ai-notes/generatednotes',
      'AI Notes investigation',
      'Elina',
      'AI Notes',
      current - 120,
      0.88,
      'neutral',
      '{}',
      current - 120,
    );
    db.prepare(
      `INSERT INTO chunks
        (chunk_id, file_path, line_start, line_end, content, content_hash,
         scope, source, source_type, related_project, related_entity_id, created_at)
       VALUES (?, ?, 1, 1, ?, ?, 'work', 'meeting', 'meeting', 'AI Notes', ?, ?)`,
    ).run(
      9801,
      'messages/msg-ai-notes-prep',
      'AI Notes GeneratedNotes retry ack owner repeated consumption',
      'hash-ai-notes-prep',
      'msg-ai-notes-prep',
      current - 120,
    );
    db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
      9801,
      'AI Notes GeneratedNotes retry ack owner repeated consumption',
    );
    return current;
  }

  async function createMeetingPrep(): Promise<string> {
    const current = seedCalendarEvent();
    const localDate = new Date((current + 3600) * 1000)
      .toISOString()
      .slice(0, 10);
    mockGenerateJSON.mockResolvedValueOnce(buildPrepResponse());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/today-pilot/meeting-prep/prepare',
      payload: {
        date: localDate,
        timezone: 'Asia/Shanghai',
        horizonHours: 36,
        maxMeetings: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json().items[0].id;
  }

  it('generates a draft from a Today Pilot meeting prep', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockResolvedValueOnce(buildDraftResponse());

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sourceId).toBe(prepId);
    expect(body.segments).toHaveLength(3);
    expect(body.segments[0].evidenceIds).toContain('calendar:event-ai-notes');
    expect(body.segments[1].evidenceIds).not.toContain('made-up-id');
    expect(body.artifactText).toContain('Speaker Notes');
    expect(body.artifactText).toContain('Evidence refs:');
    expect(body.artifactText).toContain('## Evidence key');
    expect(body.artifactText).toContain('calendar:event-ai-notes:');
    expect(body.generationReceipt).toMatchObject({
      generationMode: 'llm_grounded',
      sourceKind: 'today_meeting_prep',
      sourceId: prepId,
      targetArtifact: 'speaker_notes',
      audience: 'AI Notes 项目组',
      sourceEvidenceRefCount: 2,
      citedEvidenceRefCount: 2,
      returnedEvidenceDetailCount: 2,
      missingEvidenceDetailCount: 0,
      boundary: 'draft_only_manual_copy_no_external_write',
    });
    expect(
      body.artifactText
        .split('\n')
        .filter((line: string) =>
          line.startsWith('- calendar:event-ai-notes:'),
        ),
    ).toHaveLength(1);
  });

  it('generates a grounded draft from a current Source Memory storyline seed', async () => {
    const capsule = new SourceMemoryCaptureService(db).createCapsule({
      sourceKind: 'document',
      sourceUrl: 'https://example.com/source-memory-storyline',
      sourceTitle: 'Source evidence design review',
      text:
        'The review requires every reusable memory claim to retain a source evidence span, and any outward storyline must remain a manually reviewed draft.',
      captureMode: 'manual',
      captureReason: '用户保存设计评审资料',
      interactions: { manualClick: true },
    });
    mockGenerateJSON.mockImplementationOnce(async (prompt: string) =>
      buildSourceDeepResponse(prompt),
    );
    expect(
      (
        await new SourceMemoryDistillationWorker(db, {
          userId: 'default',
        }).runDueJobs(1)
      ).ready,
    ).toBe(1);
    mockGenerateJSON.mockResolvedValueOnce({
      title: 'Why source evidence stays attached',
      audience: 'AI product team',
      segments: [
        {
          title: 'Problem',
          intent: 'Explain the risk.',
          narrative: 'Detached claims are difficult to verify later.',
          evidenceIds: ['E1'],
        },
        {
          title: 'Design',
          intent: 'Explain the evidence rule.',
          narrative: 'The source pack keeps every claim attached to its saved span.',
          evidenceIds: ['E1'],
        },
        {
          title: 'Boundary',
          intent: 'Explain the publication boundary.',
          narrative: 'The result remains a manually reviewed draft.',
          evidenceIds: ['E1'],
        },
      ],
      gaps: [],
      riskNotes: ['Do not imply automatic publication.'],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'source_memory_seed',
        capsuleId: capsule.id,
        seedId: 'source-evidence-story',
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sourceKind: 'source_memory_seed',
      sourceId: `${capsule.id}:source-evidence-story`,
      targetArtifact: 'speaker_notes',
      generationReceipt: {
        generationMode: 'llm_grounded',
        boundary: 'draft_only_manual_copy_no_external_write',
      },
    });
    expect(res.json().evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'source_memory',
          metadata: expect.objectContaining({ sourceMemoryCapsuleId: capsule.id }),
        }),
      ]),
    );
  });

  it('keeps the requested target artifact even when the model suggests another format', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockResolvedValueOnce({
      ...buildDraftResponse(),
      targetArtifact: 'slides_outline',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'docs_brief',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.targetArtifact).toBe('docs_brief');
    expect(body.artifactText).toContain('# Docs Brief');
    expect(body.artifactText).not.toContain('# Slides Outline');
  });

  it('does not copy ungrounded model artifact text when segment evidence is invalid', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockResolvedValueOnce({
      title: 'AI Notes external update',
      audience: 'Partner team',
      targetArtifact: 'docs_brief',
      segments: [
        {
          title: 'Fabricated impact',
          intent: 'Make the story sound stronger.',
          narrative:
            'A fabricated customer quote says the rollout already doubled adoption.',
          evidenceIds: ['made-up-source'],
        },
      ],
      gaps: ['确认可对外分享的 owner。'],
      riskNotes: [],
      artifactText:
        '# Docs Brief\n\nA fabricated customer quote says adoption doubled.',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'docs_brief',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.targetArtifact).toBe('docs_brief');
    expect(body.title).not.toBe('AI Notes external update');
    expect(body.segments).toHaveLength(3);
    expect(body.artifactText).toContain('Docs Brief');
    expect(body.artifactText).toContain('Evidence refs:');
    expect(body.artifactText).toContain('## Evidence key');
    const artifactText = String(body.artifactText).toLowerCase();
    expect(artifactText).not.toContain('ai notes external update');
    expect(artifactText).not.toContain('fabricated customer quote');
    expect(artifactText).not.toContain('adoption doubled');
    expect(body.riskNotes).toContain(
      '原始模型输出缺少足够证据引用，已用会前准备证据重新生成可复制草稿。',
    );
    expect(body.generationReceipt).toMatchObject({
      generationMode: 'fallback_cue_cards',
      fallbackReason: 'model_output_underused_or_invalid_evidence',
      boundary: 'draft_only_manual_copy_no_external_write',
    });
  });

  it('falls back when model segments underuse available evidence refs', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockResolvedValueOnce({
      title: 'Narrow model storyline',
      audience: 'AI Notes 项目组',
      targetArtifact: 'speaker_notes',
      segments: [
        {
          title: 'Background repeated',
          intent: 'Only cite one source.',
          narrative: 'This draft leans on the calendar title for the whole story.',
          evidenceIds: ['E1'],
        },
        {
          title: 'Risk repeated',
          intent: 'Still cite one source.',
          narrative: 'This draft keeps using the same source for risk.',
          evidenceIds: ['E1'],
        },
        {
          title: 'Action repeated',
          intent: 'Still cite one source.',
          narrative: 'This draft keeps using the same source for action.',
          evidenceIds: ['E1'],
        },
      ],
      gaps: [],
      riskNotes: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const citedRefs = new Set(
      body.segments.flatMap((segment: { evidenceIds: string[] }) =>
        segment.evidenceIds,
      ),
    );
    expect(citedRefs.size).toBeGreaterThanOrEqual(2);
    expect(body.title).not.toBe('Narrow model storyline');
    expect(body.artifactText).not.toContain(
      'This draft leans on the calendar title',
    );
    expect(body.riskNotes).toContain(
      '原始模型输出缺少足够证据引用，已用会前准备证据重新生成可复制草稿。',
    );
    expect(body.generationReceipt).toMatchObject({
      generationMode: 'fallback_cue_cards',
      fallbackReason: 'model_output_underused_or_invalid_evidence',
      sourceEvidenceRefCount: 2,
      returnedEvidenceDetailCount: 2,
      missingEvidenceDetailCount: 0,
    });
  });

  it('blocks draft generation when the source prep has no usable evidence refs', async () => {
    const prepId = await createMeetingPrep();
    db.prepare(
      `UPDATE today_meeting_preps
       SET evidence_refs_json = '[]'
       WHERE id = ?`,
    ).run(prepId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('storyline_source_has_no_usable_evidence');
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported source kinds before draft generation', async () => {
    const prepId = await createMeetingPrep();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'compose_assist',
        prepId,
        targetArtifact: 'speaker_notes',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockGenerateJSON).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the source prep does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId: 'missing-prep',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('not found');
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('falls back to cue cards when draft LLM generation fails', async () => {
    const prepId = await createMeetingPrep();
    mockGenerateJSON.mockRejectedValueOnce(new Error('llm unavailable'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storylines/draft',
      payload: {
        sourceKind: 'today_meeting_prep',
        prepId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.segments).toHaveLength(3);
    expect(body.artifactText).toContain('Evidence refs:');
    expect(body.artifactText).not.toContain('llm unavailable');
    expect(body.riskNotes).toContain(
      '模型生成失败，已用会前准备证据生成 fallback 草稿；请按 Evidence key 复核后再外发。',
    );
    expect(body.generationReceipt).toMatchObject({
      generationMode: 'fallback_cue_cards',
      fallbackReason: 'llm_generation_failed',
      boundary: 'draft_only_manual_copy_no_external_write',
    });
  });
});
