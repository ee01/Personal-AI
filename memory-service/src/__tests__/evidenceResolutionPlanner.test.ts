import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateJsonMock } = vi.hoisted(() => ({
  generateJsonMock: vi.fn(),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: generateJsonMock,
  }),
}));

import { EvidenceResolutionPlanner } from '../core/EvidenceResolutionPlanner.js';

describe('EvidenceResolutionPlanner', () => {
  afterEach(() => {
    generateJsonMock.mockReset();
  });

  it('prefers delegate_openclaw when artifacts remain to be checked even if the LLM suggests a confirm request', async () => {
    generateJsonMock.mockResolvedValue({
      resolutionState: 'partial',
      directFindings: ['video相关应该都在下周'],
      resolvedConclusion: 'Gary 和 video 相关的安排集中在下周。',
      remainingQuestions: ['需要核实具体是下周哪几天。'],
      candidateArtifacts: [
        {
          kind: 'link',
          title: "Gary's calendar",
          url: 'https://calendar.example.com/gary',
        },
      ],
      recommendedAction: 'create_confirm_request',
      actionParams: {
        question: '是否继续？',
      },
      confidence: 0.88,
      legacyClassification: 'answer',
      summary: '先记录已知结论，再确认是否继续。',
    });

    const planner = new EvidenceResolutionPlanner();
    const plan = await planner.resolve({
      question: 'Gary 和 video 相关的具体安排是哪几天？',
      context: '如果你只有链接，也请先发过来。',
      evidence: [
        {
          sourceKind: 'outreach_reply',
          sourceId: 'reply-4',
          title: 'Sophia (Jinmei) Lin',
          content:
            "[Gary's calendar](https://calendar.example.com/gary)\n你自己看，video相关应该都在下周\n他下周在杭州",
        },
      ],
      policy: {
        scene: 'outreach',
        userIntentMode: 'informational',
        externalRead: 'auto',
        externalWrite: 'disabled',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: true,
      },
    });

    expect(plan.resolutionState).toBe('partial');
    expect(plan.recommendedAction).toBe('delegate_openclaw');
    expect(plan.actionParams?.mode).toBe('read');
    expect(String(plan.actionParams?.task)).toContain(
      'Gary 和 video 相关的具体安排是哪几天',
    );
    expect(String(plan.actionParams?.task)).toContain("Gary's calendar");
  });

  it('classifies future-looking uncertainty as watch with future_monitoring metadata', async () => {
    generateJsonMock.mockResolvedValue({
      resolutionState: 'insufficient',
      directFindings: [],
      remainingQuestions: ['还没有明确的计划信息。'],
      candidateArtifacts: [],
      recommendedAction: 'create_confirm_request',
      confidence: 0.52,
      legacyClassification: 'unclear',
      summary: '目前只能继续观察。',
    });

    const planner = new EvidenceResolutionPlanner();
    const plan = await planner.resolve({
      question: 'AI Notes Edit BE 会不会在下周调整发布时间？',
      evidence: [
        {
          sourceKind: 'ask_request',
          sourceId: 'ask-42',
          content: '当前没有更多证据，只知道可能会变化。',
          metadata: { askRequestId: 'ask-42' },
        },
      ],
      policy: {
        scene: 'ask',
        userIntentMode: 'informational',
        externalRead: 'disabled',
        externalWrite: 'disabled',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: true,
      },
    });

    expect(plan.disposition).toBe('watch');
    expect(plan.reasonCode).toBe('future_monitoring');
    expect(plan.gapType).toBe('future_monitoring');
    expect(plan.sourceAnchor).toBe('ask:ask-42');
    expect(plan.actionParams?.routing).toBe('watch');
  });

  it('classifies artifact-checkable gaps as auto_verify', async () => {
    generateJsonMock.mockResolvedValue({
      resolutionState: 'partial',
      directFindings: ['有文档线索但未核实。'],
      remainingQuestions: ['需要检查发布文档。'],
      candidateArtifacts: [
        {
          kind: 'link',
          title: 'Release doc',
          url: 'https://docs.example.com/release',
        },
      ],
      recommendedAction: 'delegate_openclaw',
      confidence: 0.77,
      legacyClassification: 'answer',
      summary: '可以继续只读查证。',
    });

    const planner = new EvidenceResolutionPlanner();
    const plan = await planner.resolve({
      question: '发布文档里有没有明确下个里程碑？',
      evidence: [
        {
          sourceKind: 'outreach_reply',
          sourceId: 'reply-2',
          content: '这里有文档链接 https://docs.example.com/release',
        },
      ],
      policy: {
        scene: 'outreach',
        userIntentMode: 'informational',
        externalRead: 'auto',
        externalWrite: 'disabled',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: true,
      },
    });

    expect(plan.disposition).toBe('auto_verify');
    expect(plan.reasonCode).toBe('artifact_gap');
    expect(plan.gapType).toBe('artifact_check');
    expect(plan.recommendedAction).toBe('delegate_openclaw');
  });

  it('classifies explicit decision requests as decision with blocker metadata', async () => {
    generateJsonMock.mockResolvedValue({
      resolutionState: 'insufficient',
      directFindings: [],
      remainingQuestions: ['需要用户选择方向。'],
      candidateArtifacts: [],
      recommendedAction: 'create_confirm_request',
      confidence: 0.61,
      legacyClassification: 'unclear',
      summary: '这已经不是观察项，而是需要拍板。',
    });

    const planner = new EvidenceResolutionPlanner();
    const plan = await planner.resolve({
      question: '我们是否要立即推进 Orbit 迁移方案？',
      context: '帮我决定怎么做。',
      evidence: [
        {
          sourceKind: 'reflection_thread',
          sourceId: 'thread-77',
          content: '当前没有足够证据，需要决策。',
        },
      ],
      policy: {
        scene: 'reflection',
        userIntentMode: 'explicit_action',
        externalRead: 'disabled',
        externalWrite: 'approval_required',
        allowAskExternalUser: false,
        allowCreateConfirmRequest: true,
      },
    });

    expect(plan.disposition).toBe('decision');
    expect(plan.reasonCode).toBe('approval_required');
    expect(plan.gapType).toBe('decision_blocker');
    expect(plan.actionParams?.routing).toBe('decision');
  });
});
