import { beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { MemoryContextMatchService } from '../core/MemoryContextMatchService.js';
import { getTestDb } from './setup.js';

describe('MemoryContextMatchService', () => {
  let db: BetterSqlite3.Database;
  let service: MemoryContextMatchService;

  beforeEach(() => {
    db = getTestDb();
    service = new MemoryContextMatchService(db);
    db.prepare('DELETE FROM conversation_context_frames').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();
    db.prepare('DELETE FROM messages_raw').run();
  });

  function insertMessage(row: {
    id: string;
    content: string;
    sourceTitle: string;
    groupName: string;
    groupId?: string;
    timestampOffset?: number;
    importance?: number;
    sourceType?: string;
    scope?: 'work' | 'personal';
  }) {
    const timestamp = Math.floor(Date.now() / 1000) - (row.timestampOffset ?? 60);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, scope, source_type, source_url, source_title, sender, group_id,
         group_name, timestamp, importance, sentiment, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.content,
      row.scope ?? 'work',
      row.sourceType ?? 'glip',
      `https://app.ringcentral.com/messages/${row.id}`,
      row.sourceTitle,
      'Quintin Xiao',
      row.groupId ?? row.id,
      row.groupName,
      timestamp,
      row.importance ?? 0.85,
      'neutral',
      JSON.stringify({ groupName: row.groupName }),
      timestamp,
    );
  }

  it('locks a context-lost role/status question to the most salient recent project topic', () => {
    insertMessage({
      id: 'vbg-status',
      content:
        'AI Generate 现在我们需要等 RCV BE 新的 design，所以 BE 还没有 ready。',
      sourceTitle: 'MTR-141852: AI Custom VBG',
      groupName: 'MTR-141852: AI Custom VBG',
      groupId: 'vbg-group',
      importance: 0.9,
    });
    for (let index = 0; index < 8; index += 1) {
      insertMessage({
        id: `generic-backend-${index}`,
        content: `Generic backend maintenance note ${index}. No specific project status.`,
        sourceTitle: 'RCW Backend team',
        groupName: 'RCW Backend team',
        groupId: 'backend-team',
        timestampOffset: index + 1,
        importance: 0.8,
      });
    }

    const match = service.match({
      query: '那个 BE ready 了吗？',
      scope: 'work',
    });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toContain('MTR-141852');
    expect(match.selectedTopic?.roleTerms).toContain('backend');
    expect(match.userFacingSummary).toContain('锁定');
  });

  it('prefers a ticket-anchored topic over source-url-only message activity', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, group_id, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'glip:vbg-frame',
      'glip',
      'glip',
      'vbg-group',
      'MTR-141852: AI Custom VBG',
      'AI Custom VBG backend BE is waiting for new design.',
      JSON.stringify(['AI VBG']),
      JSON.stringify(['AI Custom VBG', 'new design']),
      JSON.stringify(['backend']),
      JSON.stringify(['MTR-141852']),
      0.72,
      currentTime - 7 * 24 * 60 * 60,
      currentTime - 7 * 24 * 60 * 60,
    );
    for (let index = 0; index < 5; index += 1) {
      insertMessage({
        id: `source-url-only-${index}`,
        content: `Backend ready status follow-up ${index} with no ticket anchor.`,
        sourceTitle: 'Nova - whatsapp product discussion',
        groupName: 'Nova - whatsapp product discussion',
        groupId: 'nova-group',
        timestampOffset: index + 10,
        importance: 0.9,
      });
    }

    const match = service.match({ query: '那个 BE ready 了吗？', scope: 'work' });

    expect(match.candidates[0]?.label).toContain('AI VBG');
    expect(match.candidates[0]?.anchors).toContain('MTR-141852');
  });

  it('uses explicit distinctive query anchors to avoid unrelated recent role topics', () => {
    insertMessage({
      id: 'webinar-backend',
      content: 'Backend ready status follow-up for webinar project.',
      sourceTitle: 'RingCentral Webinar BE CN Team',
      groupName: 'RingCentral Webinar BE CN Team',
      groupId: 'webinar-group',
      timestampOffset: 20,
      importance: 0.95,
    });
    insertMessage({
      id: 'vbg-backend',
      content: 'AI VBG backend still waits for new design before ready.',
      sourceTitle: 'MTR-141852: AI Custom VBG',
      groupName: 'MTR-141852: AI Custom VBG',
      groupId: 'vbg-group',
      timestampOffset: 600,
      importance: 0.75,
    });

    const match = service.match({
      query: 'AI VBG 的 BE 部分完成情况如何？',
      scope: 'work',
    });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toContain('MTR-141852');
    expect(match.selectedTopic?.reasons.join(' ')).toContain('显式 query 锚点');
  });

  it('marks a short role/status question ambiguous when recent candidates are close', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    for (const project of ['AI Generated VBG', 'AI Notes']) {
      db.prepare(
        `INSERT INTO conversation_context_frames
          (id, surface, source_type, title, summary, dominant_projects_json,
           topics_json, role_terms_json, source_anchors_json, confidence,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `glip:${project}`,
        'glip',
        'glip',
        project,
        `${project} backend BE status is being discussed.`,
        JSON.stringify([project]),
        JSON.stringify([project]),
        JSON.stringify(['backend']),
        JSON.stringify([]),
        0.75,
        currentTime - 120,
        currentTime - 120,
      );
    }

    const match = service.match({ query: '那个 BE ready 了吗？' });

    expect(match.state).toBe('ambiguous');
    expect(match.candidates.map((candidate) => candidate.label)).toEqual(
      expect.arrayContaining(['AI Generated VBG', 'AI Notes']),
    );
  });

  it('does not ask for topic clarification when the query already names the subject', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const [index, project] of ['AI Tools for Engineering - Workgroup', 'AI Tooling SWAT'].entries()) {
      insertFrame.run(
        `cursor-explicit:${index}`,
        'glip',
        'glip',
        project,
        `${project} has recurring Cursor cost and license policy discussions.`,
        JSON.stringify([project]),
        JSON.stringify(['Cursor', 'Cursor cost', 'license policy']),
        JSON.stringify([]),
        JSON.stringify([]),
        0.76,
        currentTime - 120,
        currentTime - 120,
      );
    }

    const match = service.match({
      query: 'Cursor 的成本/性价比结论是什么？这个结论大概是什么时候得出的？',
      scope: 'work',
    });

    expect(match.state).not.toBe('ambiguous');
  });

  it('penalizes low-signal web captures when choosing an implicit topic', () => {
    insertMessage({
      id: 'docs-noise',
      content:
        'Story Points estimation by AI Service FileEditViewInsertFormatTools Accessibility Print preview',
      sourceTitle: 'Story Points estimation by AI Service - Google Docs',
      groupName: 'docs.google.com',
      sourceType: 'web',
      importance: 0.99,
      timestampOffset: 10,
    });
    insertMessage({
      id: 'design-status',
      content: 'MTR-141852 AI Custom VBG 新 design 还在等待确认，状态未 ready。',
      sourceTitle: 'MTR-141852: AI Custom VBG',
      groupName: 'MTR-141852: AI Custom VBG',
      groupId: 'vbg-group',
      importance: 0.82,
      timestampOffset: 120,
    });

    const match = service.match({ query: '那个新 design 定了吗？' });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toContain('MTR-141852');
    expect(match.selectedTopic?.label).not.toContain('Google Docs');
  });

  it('keeps an issue-anchored frame visible when linked entity context carries the design clue', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, group_id, title, summary, dominant_projects_json,
         topics_json, role_terms_json, source_anchors_json, confidence,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertFrame.run(
      'glip:ai-vbg-drifted-summary',
      'glip',
      'glip',
      'vbg-group',
      'MTR-141852: AI Custom VBG',
      'Landcy Lan observed UI color differences in the join button and time background.',
      JSON.stringify(['AI VBG']),
      JSON.stringify(['QR code', 'UI color difference', 'join button']),
      JSON.stringify(['backend']),
      JSON.stringify(['MTR-141852']),
      0.69,
      currentTime - 9 * 24 * 60 * 60,
      currentTime - 9 * 24 * 60 * 60,
    );

    db.prepare(
      `INSERT INTO entities
        (id, type, name, aliases_json, description, importance, mention_count,
         status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'project-rcv-entity-context',
      'Project',
      'RCV',
      JSON.stringify(['RCV BE']),
      'Recent discussion: MTR-141852: AI Custom VBG needs to wait for RCV BE new design before readiness can be decided.',
      0.8,
      50,
      'active',
      currentTime - 60,
      currentTime - 60,
    );

    for (let index = 0; index < 25; index += 1) {
      insertFrame.run(
        `glip:recent-design-${index}`,
        'glip',
        'glip',
        `design-group-${index}`,
        `Recent Design Candidate ${index}`,
        `Design handoff status candidate ${index} is ready for review.`,
        JSON.stringify([`Recent Design Candidate ${index}`]),
        JSON.stringify(['design handoff', 'review']),
        JSON.stringify([]),
        JSON.stringify([`MTR-20000${index}`]),
        0.95,
        currentTime - index * 60,
        currentTime - index * 60,
      );
    }

    const match = service.match({
      query: '那个新 design 定了吗？',
      scope: 'work',
    });

    expect(match.candidates.map((candidate) => candidate.label)).toContain(
      'AI VBG',
    );
    expect(
      match.candidates
        .find((candidate) => candidate.label === 'AI VBG')
        ?.reasons.join(' '),
    ).toContain('关联实体补充 source anchor 上下文');
  });

  it('lets explicit current context override a more recent global topic', () => {
    insertMessage({
      id: 'global-status',
      content: 'Project Orbit backend ready discussion is active today.',
      sourceTitle: 'Project Orbit',
      groupName: 'Project Orbit',
      groupId: 'orbit-group',
      importance: 0.95,
      timestampOffset: 30,
    });
    insertMessage({
      id: 'current-status',
      content: 'AI Notes backend still needs merge review before ready.',
      sourceTitle: 'AI Notes',
      groupName: 'AI Notes',
      groupId: 'notes-group',
      importance: 0.7,
      timestampOffset: 600,
    });

    const match = service.match({
      query: '那个 BE ready 了吗？',
      currentContext: {
        groupId: 'notes-group',
        title: 'AI Notes',
      },
    });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toBe('AI Notes');
    expect(match.selectedTopic?.reasons.join(' ')).toContain('当前页面');
  });

  it('keeps the current RingCentral chat topic ahead of another strong VBG Jira candidate', () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const insertFrame = db.prepare(
      `INSERT INTO conversation_context_frames
        (id, surface, source_type, group_id, conversation_id, issue_key, title,
         summary, dominant_projects_json, topics_json, role_terms_json,
         source_anchors_json, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertFrame.run(
      'glip:153798238214',
      'glip',
      'glip',
      '153798238214',
      '153798238214',
      null,
      'MTR-141852: AI Custom VBG',
      'AI VBG backend BE is waiting for RCV BE new design.',
      JSON.stringify(['AI VBG']),
      JSON.stringify(['QR code', 'UI color difference', 'join button']),
      JSON.stringify(['backend']),
      JSON.stringify(['MTR-141852']),
      0.95,
      currentTime - 3600,
      currentTime - 3600,
    );
    insertFrame.run(
      'jira:MTR-145975',
      'jira',
      'jira',
      'MTR-145975',
      'MTR-145975',
      'MTR-145975',
      'MTR-145975: Optimize VBG selection page & refresh RCV default library - Phase 2',
      'Story points for the VBG project were updated from 17 to 68.',
      JSON.stringify([
        'MTR-145975: Optimize VBG selection page & refresh RCV default library - Phase 2',
      ]),
      JSON.stringify(['Story Points', 'MTR', 'VBG', 'RCV']),
      JSON.stringify([]),
      JSON.stringify([
        'https://jira.ringcentral.com/browse/MTR-145975#comment-76140068',
        'MTR-145975',
      ]),
      0.99,
      currentTime - 300,
      currentTime - 300,
    );

    const match = service.match({
      query: 'AI VBG 的 BE 部分完成情况如何？',
      currentContext: {
        title: 'MTR-141852: AI Custom VBG',
        issueKey: 'MTR-141852',
        sourceAnchorHints: ['MTR-141852'],
      },
      secondaryTexts: [
        'Surface: RingCentral chat. Current chat title: MTR-141852: AI Custom VBG.',
      ],
      scope: 'work',
    });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toBe('AI VBG');
    expect(match.selectedTopic?.anchors).toContain('MTR-141852');
    expect(match.selectedTopic?.reasons.join(' ')).toContain('当前页面');
    expect(match.candidates[0]?.label).not.toContain('MTR-145975');
  });

  it('uses free-form external context title as a generic topic anchor', () => {
    insertMessage({
      id: 'webinar-be',
      content: 'Webinar BE status is still under review and not ready.',
      sourceTitle: 'RingCentral Webinar BE CN Team',
      groupName: 'RingCentral Webinar BE CN Team',
      groupId: 'webinar-group',
      importance: 0.94,
      timestampOffset: 30,
    });
    insertMessage({
      id: 'vbg-design',
      content: 'AI Generate 现在我们需要等 RCV BE 新的 design，所以 BE 还没有 ready。',
      sourceTitle: 'MTR-141852: AI Custom VBG',
      groupName: 'MTR-141852: AI Custom VBG',
      groupId: 'vbg-group',
      importance: 0.78,
      timestampOffset: 600,
    });

    const match = service.match({
      query: '那个 BE ready 了吗？',
      secondaryTexts: ['Current chat title: MTR-141852: AI Custom VBG'],
      scope: 'work',
    });

    expect(match.state).toBe('locked');
    expect(match.selectedTopic?.label).toContain('MTR-141852');
    expect(match.selectedTopic?.reasons.join(' ')).toContain('外部上下文文本锚点');
  });
});
