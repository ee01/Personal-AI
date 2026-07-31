import { beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { RecallContextExpansionService } from '../core/RecallContextExpansionService.js';
import { getTestDb } from './setup.js';

describe('RecallContextExpansionService', () => {
  let db: BetterSqlite3.Database;
  let service: RecallContextExpansionService;

  beforeEach(() => {
    db = getTestDb();
    service = new RecallContextExpansionService(db);
    db.prepare('DELETE FROM conversation_context_frames').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  it('resolves RingCentral "那个 BE" through the current group frame', () => {
    service.upsertFrameFromMessage({
      messageId: 'vbg-backend-thread',
      content:
        'Ivan said the AI Generated VBG backend still has pending work on RCV-148412 and RCV-148411.',
      sourceType: 'glip',
      sourceTitle:
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      groupId: 'vbg-group',
      groupName:
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      timestamp: Math.floor(Date.now() / 1000) - 600,
      entities: [
        {
          type: 'Project',
          name: 'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
        },
        { type: 'Topic', name: 'VBG' },
      ],
      matchedProjects: [
        'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      ],
      metadata: { conversationId: 'vbg-group' },
    });

    const expansion = service.expand({
      query: '那个 BE ready 了吗',
      currentContext: {
        groupId: 'vbg-group',
        conversationId: 'vbg-group',
        visibleMessages: [
          {
            sender: 'Ivan',
            text: 'For AI Generated VBG, backend pending work is on the thread.',
          },
        ],
      },
    });

    expect(expansion.resolvedProject).toContain('AI-Generated VBGs');
    expect(expansion.resolvedRole).toBe('backend');
    expect(expansion.expandedQuery).toContain('backend');
    expect(expansion.expandedQuery).toContain('RCV-148412');
    expect(expansion.ambiguity?.state).toBe('none');
  });

  it('marks short backend references ambiguous when two recent frames fit', () => {
    for (const [groupId, project] of [
      ['vbg-group', 'AI Generated VBG'],
      ['notes-group', 'AI Notes'],
    ]) {
      service.upsertFrameFromMessage({
        messageId: `${groupId}-backend`,
        content: `${project} backend BE status is being discussed.`,
        sourceType: 'glip',
        sourceTitle: project,
        groupId,
        groupName: project,
        timestamp: Math.floor(Date.now() / 1000) - 300,
        entities: [
          {
            type: 'Project',
            name: project,
          },
        ],
        matchedProjects: [project],
      });
    }

    const expansion = service.expand({ query: '那个 BE ready 了吗' });

    expect(expansion.ambiguity?.state).toBe('ambiguous');
    expect(expansion.ambiguity?.candidates.map((candidate) => candidate.label)).toEqual(
      expect.arrayContaining(['AI Generated VBG', 'AI Notes']),
    );
  });

  it('uses watched project aliases to expand ask-style VBG backend questions', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, 8, ?)`,
    ).run(
      'project-vbg',
      'RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs',
      JSON.stringify(['AI VBG', 'VBG', 'AI Generated Background']),
      currentTime,
    );

    const expansion = service.expand({
      query: 'AI VBG 的 BE 部分完成情况如何',
    });

    expect(expansion.resolvedProject).toContain('AI-Generated VBGs');
    expect(expansion.resolvedRole).toBe('backend');
    expect(expansion.expandedQuery).toContain('AI-Generated VBGs');
  });

  it('does not let a deictic phrase override a directly named subject', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'cursor-cost-workgroup',
      'glip',
      'glip',
      'AI Tools for Engineering - Workgroup',
      'Cursor licensing and migration updates.',
      JSON.stringify(['AI Tools for Engineering - Workgroup']),
      JSON.stringify(['Cursor', 'license management']),
      JSON.stringify([]),
      JSON.stringify([]),
      0.86,
      currentTime - 60,
      currentTime - 60,
    );

    const expansion = service.expand({
      query: 'Cursor 的成本/性价比结论是什么？这个结论大概是什么时候得出的？',
    });

    expect(expansion.contextMatch?.state).toBe('none');
    expect(expansion.expandedQuery).toBe(
      'Cursor 的成本/性价比结论是什么？这个结论大概是什么时候得出的？',
    );
  });

  it('treats source anchor matches in context frames as current-source matches', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'glip:mtr-141852',
      'ringcentral',
      'glip',
      'MTR-141852: AI Custom VBG',
      'Discussion about AI VBG backend readiness and RCV BE new design.',
      JSON.stringify(['AI VBG']),
      JSON.stringify(['AI Custom VBG', 'new design']),
      JSON.stringify(['backend']),
      JSON.stringify(['MTR-141852']),
      0.7,
      currentTime - 600,
      currentTime - 600,
    );

    const expansion = service.expand({
      query: '那个 BE ready 了吗',
      title: 'MTR-141852: AI Custom VBG',
      currentContext: {
        title: 'MTR-141852: AI Custom VBG',
        issueKey: 'MTR-141852',
        sourceAnchorHints: ['MTR-141852'],
      },
    });

    expect(expansion.resolvedProject).toBe('AI VBG');
    expect(expansion.resolvedRole).toBe('backend');
    expect(expansion.expandedQuery).toContain('AI VBG');
    expect(expansion.expandedQuery).toContain('MTR-141852');
    expect(expansion.ambiguity?.state).toBe('none');
  });
});
