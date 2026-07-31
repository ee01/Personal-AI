import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReflectionWorker } from '../core/ReflectionWorker.js';
import type { ReflectionThreadRecord } from '../repositories/ReflectionThreadRepository.js';

describe('ReflectionWorker', () => {
  const thread: ReflectionThreadRecord = {
    id: 'thread-1',
    topicKey: 'project:orbit',
    title: '项目反思: Orbit',
    status: 'active',
    priority: 8,
    salience: 0.85,
    openQuestions: [],
    reflectionCount: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  afterEach(() => {
    delete process.env.REFLECTION_FORCE_FALLBACK;
  });

  it('defaults internal actions to auto execution when not explicitly manual', () => {
    const worker = new ReflectionWorker() as any;

    const confirmAction = worker.normalizeAction(
      {
        actionType: 'create_confirm_request',
        title: '需要你确认下一步',
      },
      thread,
    );
    expect(confirmAction?.executionMode).toBe('auto');
    expect(confirmAction?.requiresApproval).toBe(false);

    const outreachAction = worker.normalizeAction(
      {
        actionType: 'ask_external_user',
        title: '向 Maya 询问',
        params: {
          targetType: 'person',
          targetRef: 'maya',
          question: 'Can you confirm the current status?',
        },
      },
      thread,
    );
    expect(outreachAction?.executionMode).toBe('auto');
    expect(outreachAction?.requiresApproval).toBe(false);
  });

  it('filters cross-topic evidence before fallback reflection output', async () => {
    process.env.REFLECTION_FORCE_FALLBACK = 'true';
    const worker = new ReflectionWorker();

    const generated = await worker.generate(
      thread,
      [
        {
          sourceKind: 'message',
          sourceId: 'orbit-owner',
          title: 'Orbit owner update',
          snippet: 'Orbit owner is Maya and security review is pending.',
          role: 'evidence',
        },
        {
          sourceKind: 'message',
          sourceId: 'atlas-risk',
          title: 'Atlas billing risk',
          snippet: 'Atlas launch is blocked by an unrelated billing dependency.',
          role: 'research',
        },
      ],
      'manual',
    );

    expect(generated.cohesionReceipt).toMatchObject({
      state: 'cohesive',
      usedCount: 1,
      excludedCount: 1,
    });
    expect(generated.usedEvidenceRefs).toEqual(['message:orbit-owner']);
    expect(generated.markdownBody).toContain('Orbit owner is Maya');
    expect(generated.markdownBody).not.toContain('Atlas launch');
  });

  it('does not invoke action planning when cohesion requires a split', async () => {
    const worker = new ReflectionWorker() as any;
    const resolve = vi.fn();
    worker.evidencePlanner = { resolve };

    const actions = await worker.planActions(
      thread,
      [
        {
          sourceKind: 'message',
          sourceId: 'orbit-owner',
          title: 'Orbit owner update',
          snippet: 'Orbit owner is Maya.',
          role: 'evidence',
        },
      ],
      'Mixed evidence cannot support delegation.',
      ['Which subject should be checked?'],
      { state: 'split_required' },
    );

    expect(actions).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('attaches the used evidence refs and cohesion receipt to action proposals', async () => {
    const worker = new ReflectionWorker() as any;
    worker.evidencePlanner = {
      resolve: vi.fn().mockResolvedValue({
        resolutionState: 'partial',
        directFindings: [],
        resolvedConclusion: '',
        remainingQuestions: ['Verify Orbit repository ownership.'],
        candidateArtifacts: [],
        recommendedAction: 'delegate_openclaw',
        actionParams: { mode: 'read' },
        confidence: 0.78,
        disposition: 'delegate',
        reasonCode: 'artifact_gap',
        gapType: 'artifact_check',
        summary: 'Orbit ownership needs an external repository check.',
      }),
    };
    const evidence = [
      {
        sourceKind: 'message',
        sourceId: 'orbit-owner',
        title: 'Orbit owner update',
        snippet: 'Orbit owner evidence is incomplete.',
        role: 'evidence',
      },
    ];
    const cohesionResult = worker.buildCohesionResult(thread, evidence);

    const actions = await worker.planActions(
      thread,
      evidence,
      'Orbit ownership is still uncertain.',
      ['Who owns the Orbit repository?'],
      cohesionResult,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('delegate_openclaw');
    expect(actions[0].evidenceRefs).toEqual(['message:orbit-owner']);
    expect(actions[0].params?.evidenceCohesion).toMatchObject({
      state: 'cohesive',
      usedCount: 1,
    });
  });
});
