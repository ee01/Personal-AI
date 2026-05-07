import assert from 'node:assert/strict';

import {
  DesignDisplayItem,
  classifyDesignUrl,
  dedupeDesignData,
  escapeHtml,
  extractDesignLinks,
  getDesignDisplayLabel,
  getDesignDisplayPriority,
  getDesignStatusTone,
  getDesignSourceLabel,
  getFigmaDisplayLabel,
  getUXEpicStatusTone,
  matchesDesignDomain,
  matchesProjectPattern,
  normalizeDesignUrl,
  normalizeFigmaUrl,
  parseDesignDomainPatterns,
  sortDesignDisplayItems,
} from '../src/jiraDesignLinks.ts';

function verifyProjectPatternMatching() {
  assert.equal(matchesProjectPattern('UX-123', 'UX'), true);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX'), false);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX*'), true);
  assert.equal(matchesProjectPattern('RCV-123', 'UX*'), false);
}

function verifyUrlNormalization() {
  assert.equal(
    normalizeFigmaUrl('https://www.figma.com/design/abc/Spec),'),
    'https://www.figma.com/design/abc/Spec',
  );
  assert.equal(normalizeFigmaUrl('https://notfigma.com/design/abc'), null);
  assert.equal(normalizeFigmaUrl('javascript:alert(1)'), null);
  assert.equal(normalizeDesignUrl('https://example.com/design'), 'https://example.com/design');
  assert.equal(normalizeDesignUrl('/browse/UX-123'), null);
  assert.equal(classifyDesignUrl('https://miro.com/app/board/uXjVdemo')?.label, 'Miro board');
  assert.equal(classifyDesignUrl('https://docs.google.com/presentation/d/abc/edit')?.label, 'Google Slides');
  assert.equal(classifyDesignUrl('https://example.com/design'), null);
  assert.equal(classifyDesignUrl('https://example.com/design', true)?.label, 'Design link');
  assert.deepEqual(
    parseDesignDomainPatterns('https://prototype.internal/path, *.design.local; .handoff.example.com'),
    ['prototype.internal', '*.design.local', 'handoff.example.com'],
  );
  assert.equal(matchesDesignDomain('flow.design.local', ['*.design.local']), true);
  assert.equal(matchesDesignDomain('evilprototype.internal.bad', ['prototype.internal']), false);
  assert.equal(
    classifyDesignUrl('https://prototype.internal/spec/123', false, ['prototype.internal'])?.label,
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
}

function verifyEscaping() {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> "quote"'),
    '&lt;img src=x onerror=alert(1)&gt; &quot;quote&quot;',
  );
}

function verifySourceLabels() {
  assert.equal(getDesignSourceLabel('description'), 'Description');
  assert.equal(getDesignSourceLabel('epic_issue_link, parent_child_issue'), 'Epic link, Parent child');
  assert.equal(getDesignSourceLabel('linked_issues, remote_link'), 'Linked issue, Remote link');
}

function verifyFigmaLabels() {
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/proto/abc/demo'), 'Figma Prototype');
  assert.equal(getFigmaDisplayLabel('https://www.figma.com/board/abc/demo'), 'FigJam Board');
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
}

function verifyDedupe() {
  const items: DesignDisplayItem[] = [
    { type: 'figma', url: 'https://www.figma.com/design/abc/demo', source: 'description' },
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc/demo',
      title: 'Ready checkout prototype',
      status: 'Ready for dev',
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
  assert.equal((deduped[1] as any).designLabel, 'Figma Design');
  assert.equal((deduped[1] as any).summary, 'Ready checkout prototype');
  assert.equal((deduped[2] as any).uxTicketKey, 'UX-124');
}

function verifyStatusTones() {
  assert.equal(getUXEpicStatusTone('Design Review'), 'in-progress');
  assert.equal(getUXEpicStatusTone('Released'), 'done');
  assert.equal(getUXEpicStatusTone('On Hold'), 'blocked');
  assert.equal(getUXEpicStatusTone('Rejected'), 'cancelled');
  assert.equal(getDesignStatusTone('Ready for dev'), 'ready');
  assert.equal(getDesignStatusTone('Ready for development'), 'ready');
  assert.equal(getDesignStatusTone('Ready for review'), 'review');
  assert.equal(getDesignStatusTone('Not ready for dev'), 'not-ready');
  assert.equal(getDesignStatusTone('Draft handoff'), 'not-ready');
  assert.equal(getDesignStatusTone('Design updated'), 'updated');
  assert.equal(getDesignStatusTone('Outdated after design change'), 'updated');
  assert.equal(getDesignStatusTone('Missing link'), 'missing');
  assert.equal(getDesignStatusTone('Waiting for permission'), 'blocked');
  assert.equal(getDesignStatusTone('Resolved'), 'done');
  assert.equal(getDesignStatusTone('Needs review'), 'review');
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
  assert.equal((sorted[0] as any).uxTicketKey, 'UX-123');
  assert.equal((sorted[1] as any).status, 'Design updated');
  assert.equal((sorted[2] as any).linkProvided, false);
  assert.equal(sorted[3].type, 'figma');
}

verifyProjectPatternMatching();
verifyUrlNormalization();
verifyEscaping();
verifySourceLabels();
verifyFigmaLabels();
verifyDedupe();
verifyStatusTones();
verifyDisplayOrdering();

console.log('Jira design links verification passed');
