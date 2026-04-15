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
          content: "[Gary's calendar](https://calendar.example.com/gary)\n你自己看，video相关应该都在下周\n他下周在杭州",
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
    expect(String(plan.actionParams?.task)).toContain('Gary 和 video 相关的具体安排是哪几天');
    expect(String(plan.actionParams?.task)).toContain("Gary's calendar");
  });
});
