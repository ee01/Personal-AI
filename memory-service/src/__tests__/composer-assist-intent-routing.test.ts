import { describe, expect, it } from 'vitest';

import {
  evaluateComposerRefineGain,
  resolveComposerAssistIntent,
} from '../core/ContextAssistService.js';

describe('Composer Assist intent routing helpers', () => {
  it('resolves explicit assistIntent and falls back for legacy clients', () => {
    expect(
      resolveComposerAssistIntent({
        assistIntent: 'draft_compose',
        contextType: 'web_agent_prompt',
        draftText: 'already has text',
      }),
    ).toBe('draft_compose');
    expect(
      resolveComposerAssistIntent({
        assistIntent: 'draft_refine',
        contextType: 'message_thread',
        draftText: '',
      }),
    ).toBe('draft_refine');
    expect(
      resolveComposerAssistIntent({
        contextType: 'web_agent_prompt',
        draftText: 'rewrite this prompt please',
      }),
    ).toBe('draft_refine');
    expect(
      resolveComposerAssistIntent({
        contextType: 'web_agent_prompt',
        draftText: '   ',
      }),
    ).toBe('draft_compose');
    expect(
      resolveComposerAssistIntent({
        contextType: 'message_thread',
        draftText: 'existing reply draft',
      }),
    ).toBe('draft_compose');
  });

  it('passes refine gain when semantic delta or evidence facts are added', () => {
    const semanticPass = evaluateComposerRefineGain({
      draft: 'please summarize the rollout',
      refined:
        'please summarize the Factory AI rollout with security approval status and next owner action',
      evidence: [],
      strict: false,
    });
    expect(semanticPass.pass).toBe(true);
    expect(semanticPass.reason).toBe('semantic_delta');

    const evidencePass = evaluateComposerRefineGain({
      draft: 'reply about the approval',
      refined: 'reply about the approval and mention security gate checkpoint',
      evidence: [
        {
          id: 'ev-1',
          type: 'message',
          scope: 'work',
          score: 0.9,
          title: 'security gate checkpoint',
          snippet: 'security gate checkpoint is complete',
        },
      ],
      strict: true,
    });
    expect(evidencePass.pass).toBe(true);
    expect(['added_evidence_facts', 'semantic_delta']).toContain(
      evidencePass.reason,
    );
    expect(evidencePass.addedEvidenceFactCount).toBeGreaterThan(0);
  });

  it('rejects refine gain when rewrite is near paraphrase without new facts', () => {
    const rejected = evaluateComposerRefineGain({
      draft: 'Factory AI free trial security approval is done',
      refined: 'Factory AI free trial security approval is finished',
      evidence: [
        {
          id: 'ev-paraphrase',
          type: 'message',
          scope: 'work',
          score: 0.9,
          title: 'Factory AI free trial',
          snippet: 'Factory AI free trial security approval is done',
        },
      ],
      strict: true,
    });
    expect(rejected.pass).toBe(false);
    expect(rejected.reason).toBe('insufficient_gain');
  });
});
