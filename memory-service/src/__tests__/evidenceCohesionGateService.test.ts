import { describe, expect, it } from 'vitest';

import {
  EvidenceCohesionGateService,
  type EvidenceCohesionCandidate,
} from '../core/EvidenceCohesionGateService.js';

describe('EvidenceCohesionGateService', () => {
  const service = new EvidenceCohesionGateService();

  it('keeps the selected project and removes keyword-similar repositories', () => {
    const candidates: EvidenceCohesionCandidate[] = [
      {
        evidenceRef: 'umw-purpose',
        title: 'Unified Messaging Workspace overview',
        snippet: 'UMW provides one workspace for messaging workflows.',
        subjectKeys: ['Unified Messaging Workspace', 'UMW'],
        sceneAnchors: ['repo:ringcentral/unified-messaging-workspace'],
        claimSlots: ['purpose'],
        score: 0.91,
      },
      {
        evidenceRef: 'umw-repo',
        title: 'Unified Messaging Workspace repository',
        snippet: 'Repository URL is github.com/ringcentral/unified-messaging-workspace.',
        subjectKeys: ['Unified Messaging Workspace', 'UMW'],
        sceneAnchors: ['repo:ringcentral/unified-messaging-workspace'],
        claimSlots: ['repository_url'],
        score: 0.88,
      },
      {
        evidenceRef: 'learning-repo',
        title: 'Signal Deck game repository',
        snippet: 'The game lives at github.com/esone/rc-ai-learning.',
        subjectKeys: ['Signal Deck', 'rc-ai-learning'],
        sceneAnchors: ['repo:esone/rc-ai-learning'],
        claimSlots: ['repository_url'],
        score: 0.83,
      },
      {
        evidenceRef: 'learning-purpose',
        title: 'rc-ai-learning purpose',
        snippet: 'AI learning game project for internal challenges.',
        subjectKeys: ['rc-ai-learning'],
        sceneAnchors: ['repo:esone/rc-ai-learning'],
        claimSlots: ['purpose'],
        score: 0.79,
      },
      {
        evidenceRef: 'ai-notes',
        title: 'AI Notes workgroup',
        snippet: 'General AI project and repository discussion.',
        subjectKeys: ['AI Notes'],
        sceneAnchors: ['group:ai-notes'],
        role: 'background',
        score: 0.76,
      },
    ];

    const result = service.evaluate({
      entrypoint: 'ask',
      intent: 'answer_question',
      questionOrTask: 'Unified Messaging Workspace 的 purpose 和 repository_url 是什么？',
      selectedTopic: {
        label: 'Unified Messaging Workspace',
        aliases: ['UMW'],
        sourceAnchors: ['repo:ringcentral/unified-messaging-workspace'],
      },
      claimSlots: ['purpose', 'repository_url'],
      candidates,
    });

    expect(result.state).toBe('cohesive');
    expect(result.includedEvidenceRefs).toEqual(['umw-purpose', 'umw-repo']);
    expect(result.excluded.map((item) => item.evidenceRef)).toEqual(
      expect.arrayContaining(['learning-repo', 'learning-purpose', 'ai-notes']),
    );
    expect(result.receipt.usedCount).toBe(2);
    expect(result.receipt.excludedCount).toBe(3);
  });

  it('requires a split when multiple anchored projects fit an unanchored task', () => {
    const result = service.evaluate({
      entrypoint: 'reflection_worker',
      intent: 'delegate_external_check',
      questionOrTask: 'Verify the current attachment id.',
      candidates: [
        {
          evidenceRef: 'arena-attachment',
          title: 'oathbound-arena attachment',
          snippet: 'Check attachment_id for artem-petrenkov1/oathbound-arena.',
          subjectKeys: ['artem-petrenkov1/oathbound-arena'],
          sceneAnchors: ['repo:artem-petrenkov1/oathbound-arena'],
          claimSlots: ['attachment_id'],
          score: 0.84,
        },
        {
          evidenceRef: 'be-uss-attachment',
          title: 'BE USS attachment status',
          snippet: 'The BE USS project also has an attachment id question.',
          subjectKeys: ['BE USS'],
          sceneAnchors: ['group:be-uss'],
          claimSlots: ['attachment_id'],
          score: 0.82,
        },
      ],
    });

    expect(result.state).toBe('split_required');
    expect(result.includedEvidenceRefs).toEqual([]);
    expect(result.receipt.silent).toBe(false);
    expect(result.secondaryClusters).toHaveLength(1);
  });

  it('keeps weak unanchored evidence together instead of deleting it speculatively', () => {
    const result = service.evaluate({
      entrypoint: 'ask',
      intent: 'answer_question',
      questionOrTask: '总结最近讨论里的主要风险',
      candidates: [
        {
          evidenceRef: 'risk-1',
          snippet: 'The launch risk is waiting for design confirmation.',
          score: 0.8,
        },
        {
          evidenceRef: 'risk-2',
          snippet: 'A second risk is the unresolved release dependency.',
          score: 0.76,
        },
      ],
    });

    expect(result.state).toBe('cohesive');
    expect(result.includedEvidenceRefs).toEqual(['risk-1', 'risk-2']);
    expect(result.excluded).toEqual([]);
  });

  it('can preserve multiple scenes for broad Ask queries', () => {
    const result = service.evaluate({
      entrypoint: 'ask',
      intent: 'answer_question',
      questionOrTask: '最近三天 John 说过什么？',
      policy: { unanchoredMultipleClusters: 'preserve' },
      candidates: [
        {
          evidenceRef: 'john-devops',
          snippet: 'John discussed release risk.',
          sceneAnchors: ['group:devops'],
        },
        {
          evidenceRef: 'john-design',
          snippet: 'John discussed the design review.',
          sceneAnchors: ['group:design'],
        },
      ],
    });

    expect(result.state).toBe('cohesive');
    expect(result.includedEvidenceRefs).toEqual([
      'john-devops',
      'john-design',
    ]);
  });

  it('keeps separate evidence clusters that independently match the selected subject', () => {
    const result = service.evaluate({
      entrypoint: 'reflection_worker',
      intent: 'reflect_fact',
      questionOrTask: 'Reflect on Orbit repository ownership and launch risk.',
      selectedTopic: { label: 'Orbit' },
      candidates: [
        {
          evidenceRef: 'orbit-owner',
          snippet: 'Orbit owner is Maya.',
        },
        {
          evidenceRef: 'orbit-risk',
          snippet: 'Orbit launch is waiting for security approval.',
        },
        {
          evidenceRef: 'atlas-risk',
          snippet: 'Atlas launch risk is an unrelated billing dependency.',
        },
      ],
    });

    expect(result.state).toBe('cohesive');
    expect(result.includedEvidenceRefs).toEqual(
      expect.arrayContaining(['orbit-owner', 'orbit-risk']),
    );
    expect(result.includedEvidenceRefs).not.toContain('atlas-risk');
  });

  it('routes conflicting claims to authority handling without dropping evidence', () => {
    const result = service.evaluate({
      entrypoint: 'ask',
      intent: 'answer_question',
      questionOrTask: 'MTR-141852 当前 status 是什么？',
      selectedTopic: { label: 'MTR-141852' },
      candidates: [
        {
          evidenceRef: 'status-ready',
          snippet: 'MTR-141852 is ready.',
          subjectKeys: ['MTR-141852'],
          claims: [
            { subject: 'MTR-141852', propertyKey: 'status', value: 'ready' },
          ],
        },
        {
          evidenceRef: 'status-waiting',
          snippet: 'MTR-141852 is still waiting for design.',
          subjectKeys: ['MTR-141852'],
          claims: [
            { subject: 'MTR-141852', propertyKey: 'status', value: 'waiting' },
          ],
        },
      ],
    });

    expect(result.state).toBe('conflict_needs_authority');
    expect(result.includedEvidenceRefs).toHaveLength(2);
    expect(result.receipt.silent).toBe(false);
  });

  it('blocks personal evidence from an external work context pack', () => {
    const result = service.evaluate({
      entrypoint: 'context_pack',
      intent: 'build_context_pack',
      questionOrTask: 'Prepare the MTR-141852 status context.',
      selectedTopic: { label: 'MTR-141852' },
      policy: { allowedScopes: ['work'] },
      candidates: [
        {
          evidenceRef: 'work-status',
          snippet: 'MTR-141852 is waiting for design.',
          subjectKeys: ['MTR-141852'],
          scope: 'work',
        },
        {
          evidenceRef: 'personal-note',
          snippet: 'Personal note mentioning MTR-141852.',
          subjectKeys: ['MTR-141852'],
          scope: 'personal',
        },
      ],
    });

    expect(result.state).toBe('blocked_cross_scene');
    expect(result.includedEvidenceRefs).toEqual(['work-status']);
    expect(result.excluded).toContainEqual({
      evidenceRef: 'personal-note',
      reason: 'scope_mismatch',
    });
  });

  it('does not treat AI model versions as issue identifiers', () => {
    const result = service.evaluate({
      entrypoint: 'context_recall',
      intent: 'answer_question',
      questionOrTask:
        'AI usage exceeded hard limit; GPT-5.5, Codex, Cursor Composer and Dev/QA estimates need review.',
      candidates: [
        {
          evidenceRef: 'cursor-budget',
          title: 'Cursor token budget process',
          snippet:
            'Submit a FreshService ticket when Cursor token usage exceeds the limit.',
          subjectKeys: ['Cursor'],
          sceneAnchors: ['group:cursor-budget'],
          score: 0.92,
        },
      ],
      policy: { unanchoredMultipleClusters: 'preserve' },
    });

    expect(result.state).toBe('cohesive');
    expect(result.includedEvidenceRefs).toEqual(['cursor-budget']);
    expect(result.diagnostics.querySubjectAnchors).toEqual([]);
    expect(result.diagnostics.querySceneAnchors).toEqual([]);
  });
});
