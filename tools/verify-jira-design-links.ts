import assert from 'node:assert/strict';

import {
  DesignDisplayItem,
  classifyDesignUrl,
  dedupeDesignData,
  escapeHtml,
  extractDesignLinks,
  formatDesignStatusLabel,
  formatDesignUpdatedDate,
  formatDesignUpdatedTooltip,
  getDesignAttentionLevel,
  getDesignDisplayLabel,
  getDesignDisplayPriority,
  getDesignDisplayStatusTone,
  getDesignDisplayUpdatedTimestamp,
  getDesignSourceSummary,
  getDesignSourceTooltip,
  getDesignStatusTone,
  getDesignStatusActionHint,
  getDesignSourceLabel,
  getDesignUrlDedupeKey,
  getFigmaDisplayLabel,
  getUXEpicStatusTone,
  matchesDesignDomain,
  matchesProjectPattern,
  normalizeDesignUrl,
  normalizeFigmaUrl,
  parseJiraIssueKeyFromText,
  parseJiraIssueKeyFromUrl,
  parseDesignDomainPatterns,
  sortDesignDisplayItems,
} from '../src/jiraDesignLinks.ts';

function verifyProjectPatternMatching() {
  assert.equal(matchesProjectPattern('UX-123', 'UX'), true);
  assert.equal(matchesProjectPattern('ux-123', ' UX '), true);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX'), false);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX*'), true);
  assert.equal(matchesProjectPattern('UXDES-123', ' ux* '), true);
  assert.equal(matchesProjectPattern('RCV-123', 'UX*'), false);
}

function verifyUrlNormalization() {
  assert.equal(
    normalizeFigmaUrl('https://www.figma.com/design/abc/Spec),'),
    'https://www.figma.com/design/abc/Spec',
  );
  assert.equal(normalizeFigmaUrl('https://notfigma.com/design/abc'), null);
  assert.equal(normalizeFigmaUrl('https://www.figma.com/community/plugin/123-demo'), null);
  assert.equal(normalizeFigmaUrl('javascript:alert(1)'), null);
  assert.equal(
    getDesignUrlDedupeKey('https://www.figma.com/design/abc123/Spec?node-id=89%3A6&t=share'),
    getDesignUrlDedupeKey('https://www.figma.com/design/abc123/Renamed?node-id=89-6'),
  );
  assert.notEqual(
    getDesignUrlDedupeKey('https://www.figma.com/design/abc123/Spec?node-id=89%3A6'),
    getDesignUrlDedupeKey('https://www.figma.com/design/abc123/Spec?node-id=89-7'),
  );
  assert.equal(normalizeDesignUrl('https://example.com/design'), 'https://example.com/design');
  assert.equal(normalizeDesignUrl('/browse/UX-123'), null);
  assert.equal(classifyDesignUrl('https://miro.com/app/board/uXjVdemo')?.label, 'Miro board');
  assert.equal(classifyDesignUrl('https://docs.google.com/presentation/d/abc/edit')?.label, 'Google Slides');
  assert.equal(classifyDesignUrl('https://www.figma.com/slides/abc/demo')?.label, 'Figma Slides');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/screen/def')?.label, 'Zeplin screen');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/section/def')?.label, 'Zeplin section');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/flow/def')?.label, 'Zeplin flow');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/components?coid=123')?.label, 'Zeplin component');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc')?.label, 'Zeplin project');
  assert.equal(classifyDesignUrl('https://zpl.io/abc123')?.label, 'Zeplin design');
  assert.equal(classifyDesignUrl('https://app.zeplin.io/profile'), null);
  assert.equal(classifyDesignUrl('https://zeplin.io/integrations/jira'), null);
  assert.equal(classifyDesignUrl('https://example.com/design'), null);
  assert.equal(classifyDesignUrl('https://example.com/design', true)?.label, 'Design link');
  assert.equal(classifyDesignUrl('https://www.figma.com/community/plugin/123-demo', true)?.label, 'Design link');
  assert.equal(parseJiraIssueKeyFromUrl('https://jira.example.com/browse/ux-123/?focusedCommentId=1'), 'UX-123');
  assert.equal(parseJiraIssueKeyFromUrl('/browse/UXDES-300/'), 'UXDES-300');
  assert.equal(parseJiraIssueKeyFromUrl('Issue UX-456 mentioned in text'), 'UX-456');
  assert.equal(parseJiraIssueKeyFromText('blocked by uxraw-400'), 'UXRAW-400');
  assert.equal(parseJiraIssueKeyFromText('No Jira key here'), null);
  assert.deepEqual(
    parseDesignDomainPatterns('https://prototype.internal/path, *.design.local; .handoff.example.com'),
    ['prototype.internal', '*.design.local', 'handoff.example.com'],
  );
  assert.equal(matchesDesignDomain('prototype.internal', ['prototype.internal']), true);
  assert.equal(matchesDesignDomain('preview.prototype.internal', ['prototype.internal']), false);
  assert.equal(matchesDesignDomain('flow.design.local', ['*.design.local']), true);
  assert.equal(matchesDesignDomain('design.local', ['*.design.local']), false);
  assert.equal(matchesDesignDomain('evilprototype.internal.bad', ['prototype.internal']), false);
  assert.equal(
    classifyDesignUrl('https://prototype.internal/spec/123', false, ['prototype.internal'])?.label,
    'Design link',
  );
  assert.equal(classifyDesignUrl('https://preview.prototype.internal/spec/123', false, ['prototype.internal']), null);
  assert.equal(
    classifyDesignUrl('https://flow.design.local/a', false, ['*.design.local'])?.label,
    'Design link',
  );
  assert.deepEqual(
    extractDesignLinks('See https://flow.design.local/a.', false, ['*.design.local']).map(item => item.url),
    ['https://flow.design.local/a'],
  );
  assert.deepEqual(
    extractDesignLinks('See https://www.loom.com/share/abc, then https://www.loom.com/share/abc.').map(item => item.label),
    ['Loom walkthrough'],
  );
  assert.deepEqual(
    extractDesignLinks(
      'See https://www.figma.com/design/abc123/Spec?node-id=89%3A6&t=share and https://www.figma.com/design/abc123/Renamed?node-id=89-6.',
    ).map(item => item.label),
    ['Figma Design'],
  );
}

function verifyEscaping() {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> "quote"'),
    '&lt;img src=x onerror=alert(1)&gt; &quot;quote&quot;',
  );
}

function verifyDesignUpdatedDates() {
  assert.equal(formatDesignUpdatedDate('2026-05-18T10:20:00.000+0000'), '2026-05-18');
  assert.equal(formatDesignUpdatedDate('Mon, 18 May 2026 10:20:00 GMT'), '2026-05-18');
  assert.equal(formatDesignUpdatedDate('not a date'), undefined);
  assert.equal(
    formatDesignUpdatedTooltip('2026-05-18T10:20:00.000+0000'),
    'Design update reported 2026-05-18. Re-check the linked design if implementation started before this update.',
  );
}

function verifySourceLabels() {
  assert.equal(getDesignSourceLabel('description'), 'Description');
  assert.equal(getDesignSourceLabel('epic_issue_link, parent_child_issue'), 'Epic link, Parent child');
  assert.equal(getDesignSourceLabel('linked_issues, remote_link'), 'Remote link, Linked issue');
  assert.equal(getDesignSourceLabel('jira_designs'), 'Jira Designs');
  assert.equal(getDesignSourceTooltip('linked_issues, remote_link'), 'Source: Remote link, Linked issue');
}

function verifyFigmaLabels() {
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/proto/abc/demo'), 'Figma Prototype');
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/board/abc/demo'), 'FigJam Board');
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/slides/abc/demo'), 'Figma Slides');
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/design/abc/demo'), 'Figma Design');
  assert.equal(
    getDesignDisplayLabel({
      type: 'design_link',
      url: 'https://miro.com/app/board/uXjVdemo',
      source: 'description',
      tool: 'miro',
      label: 'Miro board',
      title: 'Checkout flow map',
    }),
    'Checkout flow map',
  );
  assert.equal(
    getDesignDisplayLabel({
      type: 'figma',
      url: 'https://www.figma.com/design/abc/demo',
      source: 'description',
      title: 'Checkout mobile handoff',
    }),
    'Checkout mobile handoff',
  );
  assert.equal(
    getDesignDisplayLabel({
      type: 'figma',
      url: 'https://www.figma.com/design/abc/demo',
      source: 'description',
      title: 'the design',
    }),
    'Figma Design',
  );
}

function verifyDedupe() {
  const items: DesignDisplayItem[] = [
    { type: 'figma', url: 'https://www.figma.com/design/abc/demo', source: 'description', title: 'the design' },
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc/demo',
      title: 'Ready checkout prototype',
      status: 'Ready for dev',
      updatedAt: '2026-05-18T10:20:00.000+0000',
      source: 'remote_link',
    },
    {
      type: 'design_link',
      url: 'https://miro.com/app/board/uXjVdemo',
      title: 'Miro journey map',
      tool: 'miro',
      label: 'Miro board',
      source: 'description',
    },
    {
      type: 'ux_ticket',
      url: 'https://miro.com/app/board/uXjVdemo',
      summary: 'UX Miro spec',
      uxTicketKey: 'UX-122',
      source: 'linked_issues',
      linkProvided: true,
    },
    {
      type: 'ux_ticket',
      url: 'https://www.figma.com/design/abc/demo',
      summary: 'UX spec',
      designLabel: 'Figma Design',
      uxTicketKey: 'UX-123',
      source: 'linked_issues',
      linkProvided: true,
    },
    {
      type: 'ux_ticket',
      url: 'https://www.figma.com/design/abc/demo',
      summary: 'UX spec duplicate',
      uxTicketKey: 'UX-123',
      source: 'epic_issue_link',
      linkProvided: true,
      uxEpicStatus: 'In Progress',
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-124',
      summary: 'Missing link item',
      source: 'parent_child_issue',
      linkProvided: false,
    },
  ];

  const deduped = dedupeDesignData(items);

  assert.equal(deduped.length, 3);
  assert.equal(deduped[0].type, 'ux_ticket');
  assert.equal(deduped[0].source, 'linked_issues, description');
  assert.equal((deduped[0] as any).uxTicketKey, 'UX-122');
  assert.equal(deduped[1].type, 'ux_ticket');
  assert.equal(deduped[1].source, 'linked_issues, epic_issue_link, description, remote_link');
  assert.equal((deduped[1] as any).uxEpicStatus, 'In Progress');
  assert.equal((deduped[1] as any).designStatus, 'Ready for dev');
  assert.equal((deduped[1] as any).designLabel, 'Ready checkout prototype');
  assert.equal((deduped[1] as any).summary, 'Ready checkout prototype');
  assert.equal((deduped[1] as any).designUpdatedAt, '2026-05-18T10:20:00.000+0000');
  assert.equal((deduped[2] as any).uxTicketKey, 'UX-124');

  const encodedFigmaItems: DesignDisplayItem[] = [
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc123/Checkout?node-id=1%3A2&t=share',
      source: 'description',
      title: 'Checkout handoff',
    },
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc123/Renamed?node-id=1-2',
      source: 'remote_link',
      title: 'Ready checkout handoff',
      status: 'ready_for_development',
      updatedAt: '2026-05-18T10:20:00.000+0000',
    },
  ];

  const encodedDeduped = dedupeDesignData(encodedFigmaItems);
  assert.equal(encodedDeduped.length, 1);
  assert.equal(encodedDeduped[0].type, 'figma');
  assert.equal((encodedDeduped[0] as any).source, 'description, remote_link');
  assert.equal((encodedDeduped[0] as any).title, 'Ready checkout handoff');
  assert.equal((encodedDeduped[0] as any).status, 'ready_for_development');
  assert.equal((encodedDeduped[0] as any).updatedAt, '2026-05-18T10:20:00.000+0000');
}

function verifyStatusTones() {
  assert.equal(getUXEpicStatusTone('Design Review'), 'in-progress');
  assert.equal(getUXEpicStatusTone('Released'), 'done');
  assert.equal(getUXEpicStatusTone('On Hold'), 'blocked');
  assert.equal(getUXEpicStatusTone('Rejected'), 'cancelled');
  assert.equal(getDesignStatusTone('Ready for dev'), 'ready');
  assert.equal(getDesignStatusTone('Ready for development'), 'ready');
  assert.equal(getDesignStatusTone('ready_for_development'), 'ready');
  assert.equal(getDesignStatusTone('ready-for-dev'), 'ready');
  assert.equal(getDesignStatusTone('Ready for dev changed'), 'updated');
  assert.equal(getDesignStatusTone('Ready for review'), 'review');
  assert.equal(getDesignStatusTone('Not ready for dev'), 'not-ready');
  assert.equal(getDesignStatusTone('not_ready_for_dev'), 'not-ready');
  assert.equal(getDesignStatusTone('Draft handoff'), 'not-ready');
  assert.equal(getDesignStatusTone('Design updated'), 'updated');
  assert.equal(getDesignStatusTone('changed'), 'updated');
  assert.equal(getDesignStatusTone('Outdated after design change'), 'updated');
  assert.equal(getDesignStatusTone('Missing link'), 'missing');
  assert.equal(getDesignStatusTone('Waiting for permission'), 'blocked');
  assert.equal(getDesignStatusTone('Resolved'), 'done');
  assert.equal(getDesignStatusTone('in_review'), 'review');
  assert.equal(formatDesignStatusLabel('ready_for_development'), 'Ready for development');
  assert.equal(formatDesignStatusLabel('READY_FOR_DEV'), 'Ready for dev');
  assert.equal(formatDesignStatusLabel('not-ready-for-dev'), 'Not ready for dev');
  assert.equal(formatDesignStatusLabel('changed'), 'Design updated');
  assert.equal(formatDesignStatusLabel('Needs review'), 'Needs review');
  assert.match(getDesignStatusActionHint('changed') || '', /Re-check the linked design/);
  assert.match(getDesignStatusActionHint('Missing link') || '', /no design URL/);
}

function verifyDisplayOrdering() {
  const items: DesignDisplayItem[] = [
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc/demo',
      source: 'description',
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-124',
      summary: 'Missing link item',
      source: 'parent_child_issue',
      linkProvided: false,
    },
    {
      type: 'design_link',
      url: 'https://miro.com/app/board/uXjVdemo',
      title: 'Updated journey map',
      status: 'Design updated',
      tool: 'miro',
      label: 'Miro board',
      source: 'remote_link',
    },
    {
      type: 'ux_ticket',
      url: 'https://www.figma.com/proto/abc/demo',
      summary: 'Ready prototype',
      uxTicketKey: 'UX-123',
      source: 'linked_issues, remote_link',
      linkProvided: true,
      designStatus: 'Ready for dev',
    },
  ];

  const sorted = sortDesignDisplayItems(items);
  assert.equal(getDesignDisplayPriority(sorted[0]), 0);
  assert.equal(getDesignDisplayStatusTone(sorted[0]), 'ready');
  assert.equal(getDesignAttentionLevel(sorted[0]), 'ready');
  assert.equal((sorted[0] as any).uxTicketKey, 'UX-123');
  assert.equal((sorted[1] as any).status, 'Design updated');
  assert.equal(getDesignDisplayStatusTone(sorted[1]), 'updated');
  assert.equal(getDesignAttentionLevel(sorted[1]), 'updated');
  assert.equal((sorted[2] as any).linkProvided, false);
  assert.equal(getDesignDisplayStatusTone(sorted[2]), 'missing');
  assert.equal(getDesignAttentionLevel(sorted[2]), 'missing');
  assert.equal(sorted[3].type, 'figma');
  assert.equal(getDesignDisplayStatusTone(sorted[3]), 'neutral');
  assert.equal(getDesignAttentionLevel(sorted[3]), 'neutral');
  assert.equal(
    getDesignSourceSummary(sorted),
    '4 entries · Remote link, Linked issue, Parent child, Description',
  );
}

function verifyUpdatedDateOrdering() {
  const items: DesignDisplayItem[] = [
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/old/Checkout',
      title: 'Older changed design',
      status: 'Design updated',
      updatedAt: '2026-05-17T09:15:00.000+0000',
      tool: 'figma',
      label: 'Figma Design',
      source: 'remote_link',
    },
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/new/Checkout',
      title: 'Newest changed design',
      status: 'Design updated',
      updatedAt: '2026-05-21T16:45:00.000+0000',
      tool: 'figma',
      label: 'Figma Design',
      source: 'remote_link',
    },
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/no-date/Checkout',
      title: 'Changed design without timestamp',
      status: 'Design updated',
      tool: 'figma',
      label: 'Figma Design',
      source: 'remote_link',
    },
  ];

  const sorted = sortDesignDisplayItems(items);
  assert.equal((sorted[0] as any).title, 'Newest changed design');
  assert.equal((sorted[1] as any).title, 'Older changed design');
  assert.equal((sorted[2] as any).title, 'Changed design without timestamp');
  assert.ok((getDesignDisplayUpdatedTimestamp(sorted[0]) || 0) > (getDesignDisplayUpdatedTimestamp(sorted[1]) || 0));
}

verifyProjectPatternMatching();
verifyUrlNormalization();
verifyEscaping();
verifyDesignUpdatedDates();
verifySourceLabels();
verifyFigmaLabels();
verifyDedupe();
verifyStatusTones();
verifyDisplayOrdering();
verifyUpdatedDateOrdering();

console.log('Jira design links verification passed');
