import assert from 'node:assert/strict';

import {
  DesignDisplayItem,
  chooseLatestDesignUpdatedAt,
  chooseLatestDesignUpdatedAtWithSource,
  classifyDesignUrl,
  dedupeDesignData,
  escapeHtml,
  extractDesignLinkScan,
  extractDesignLinks,
  extractDesignLinksFromRemoteLinkPayload,
  formatDesignUpdatedBasisTooltip,
  formatDesignStatusLabel,
  formatDesignUpdatedDate,
  formatDesignUpdatedDateTime,
  formatDesignUpdatedTooltip,
  getDesignUpdatedAtBasisLabel,
  getDesignUpdatedAtSourceLabel,
  getDesignUpdateReviewScope,
  getDesignAttentionLevel,
  getDesignDisplayLabel,
  getDesignDisplayPriority,
  getDesignDisplayStatusTone,
  getDesignDisplayUpdatedTimestamp,
  getRecoveredUXTicketCandidateCount,
  getIgnoredDesignLinkSummary,
  getIgnoredDesignFieldLinkCount,
  getIgnoredDesignFieldLinkSummary,
  getIgnoredDesignFieldLinkTooltip,
  getIgnoredDesignLinkReasonSummary,
  getIgnoredDesignLinkSourceSummary,
  getIgnoredDesignLinkTooltip,
  getDesignSourceSummary,
  getDesignSourceTooltip,
  getDesignScanBasisReceipt,
  getDesignStatusTone,
  getDesignStatusActionHint,
  getRecoveredUXTicketSourceCounts,
  getUXTicketKeyRecoveryBoundaryHint,
  getUXTicketKeyRecoveryBoundaryLabel,
  getUXTicketRecoveryFilterSummary,
  getUXTicketRecoveryIgnoredCandidateCount,
  getUXTicketRecoveryIgnoredSourceCounts,
  getUXTicketRecoveryIgnoredSourceSummary,
  getUXTicketRecoverySourceSummary,
  getUXTicketRecoveryScopeSummary,
  getUXTicketKeySourceHint,
  getUXTicketKeySourceLabel,
  getDesignSourceLabel,
  getDesignUrlDedupeKey,
  getFigmaDisplayLabel,
  getUXEpicStatusTone,
  isClosedJiraStatus,
  isCancelledJiraStatus,
  isDesignUpdatedDateMissing,
  isSameJiraProject,
  JIRA_CONTEXT_PANEL_ITEM_LIMIT,
  matchesDesignDomain,
  matchesProjectPattern,
  normalizeDesignUrl,
  normalizeFigmaUrl,
  parseJiraIssueKeyCandidatesFromUrl,
  parseJiraIssueKeyFromBrowseUrl,
  parseJiraIssueKeyFromIssueUrl,
  parseJiraIssueKeyFromIssuePath,
  parseJiraIssueKeyFromText,
  parseJiraIssueKeysFromText,
  parseJiraIssueKeyFromUrl,
  parseDesignDomainPatterns,
  prepareDesignDisplayItems,
  resolveDesignEta,
  shouldShowUXTicketKeySourceReceipt,
  sortDesignDisplayItems,
} from '../src/jiraDesignLinks.ts';

function verifyProjectPatternMatching() {
  assert.equal(matchesProjectPattern('UX-123', 'UX'), true);
  assert.equal(matchesProjectPattern('ux-123', ' UX '), true);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX'), false);
  assert.equal(matchesProjectPattern('UXDES-123', 'UX*'), true);
  assert.equal(matchesProjectPattern('UXDES-123', ' ux* '), true);
  assert.equal(matchesProjectPattern('RCV-123', 'UX*'), false);
  assert.equal(isSameJiraProject('RCV-1', 'RCV-99'), true);
  assert.equal(isSameJiraProject('RCV-1', 'MTR-99'), false);
  assert.equal(isSameJiraProject('UX-1', 'UXDES-2'), false);
  assert.equal(isClosedJiraStatus('Closed'), true);
  assert.equal(isClosedJiraStatus('Done'), true);
  assert.equal(isClosedJiraStatus('In Progress'), false);
  assert.equal(isCancelledJiraStatus('Cancelled'), true);
  assert.equal(isCancelledJiraStatus('Canceled'), true);
  assert.equal(isCancelledJiraStatus("Won't Do"), true);
  assert.equal(isCancelledJiraStatus('Closed'), false);
  assert.equal(isCancelledJiraStatus('In Progress'), false);
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
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/settings'), null);
  assert.equal(classifyDesignUrl('https://zeplin.io/integrations/jira'), null);
  assert.equal(classifyDesignUrl('https://example.com/design'), null);
  assert.equal(classifyDesignUrl('https://example.com/design', true)?.label, 'Design link');
  assert.equal(classifyDesignUrl('https://miro.com/pricing'), null);
  assert.equal(classifyDesignUrl('https://help.miro.com/hc/en-us/articles/360017572714'), null);
  assert.equal(classifyDesignUrl('https://www.loom.com/blog/product-updates'), null);
  assert.equal(classifyDesignUrl('https://support.loom.com/hc/en-us/articles/360002236078'), null);
  assert.equal(classifyDesignUrl('https://www.figma.com/community/plugin/123-demo', true), null);
  assert.equal(classifyDesignUrl('https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma', true), null);
  assert.equal(classifyDesignUrl('https://www.figma.com/blog/designer-developer-handoff-with-figma-and-jira/', true), null);
  assert.equal(classifyDesignUrl('https://app.zeplin.io/profile', true), null);
  assert.equal(classifyDesignUrl('https://app.zeplin.io/project/abc/settings', true), null);
  assert.equal(classifyDesignUrl('https://support.zeplin.io/en/articles/3545057-attaching-designs-to-jira-issues', true), null);
  assert.deepEqual(
    extractDesignLinks('UX field https://www.figma.com/community/plugin/123-demo', true).map(item => item.url),
    [],
  );
  assert.deepEqual(
    extractDesignLinks('UX field https://app.zeplin.io/project/abc/settings', true).map(item => item.url),
    [],
  );
  assert.deepEqual(
    extractDesignLinks('UX field https://handoff.example.com/spec', true).map(item => item.url),
    ['https://handoff.example.com/spec'],
  );
  assert.equal(parseJiraIssueKeyFromUrl('https://jira.example.com/browse/ux-123/?focusedCommentId=1'), 'UX-123');
  assert.equal(parseJiraIssueKeyFromUrl('/browse/UXDES-300/'), 'UXDES-300');
  assert.equal(parseJiraIssueKeyFromUrl('/jira/software/c/projects/UX/issues/uxcloud-600'), 'UXCLOUD-600');
  assert.equal(parseJiraIssueKeyFromUrl('Issue UX-456 mentioned in text'), 'UX-456');
  assert.equal(parseJiraIssueKeyFromBrowseUrl('https://wiki.example.com/pages/UX-123'), null);
  assert.equal(parseJiraIssueKeyFromBrowseUrl('/browse/ux-123/?focusedCommentId=1'), 'UX-123');
  assert.equal(parseJiraIssueKeyFromBrowseUrl('/jira/software/c/projects/UX/issues/uxcloud-600'), null);
  assert.equal(parseJiraIssueKeyFromIssuePath('/jira/software/c/projects/UX/boards/42?selectedIssue=UXQUERY-700'), null);
  assert.equal(parseJiraIssueKeyFromIssueUrl('/jira/software/c/projects/UX/issues/uxcloud-600'), 'UXCLOUD-600');
  assert.equal(parseJiraIssueKeyFromIssueUrl('/projects/UX/issues/UX-601?selectedIssue=UX-601'), 'UX-601');
  assert.equal(parseJiraIssueKeyFromIssueUrl('/jira/software/c/projects/UX/boards/42?selectedIssue=uxquery-700'), 'UXQUERY-700');
  assert.equal(parseJiraIssueKeyFromIssueUrl('/jira/software/c/projects/UX/boards/42?selectedIssueKey=UXQUERY-701'), 'UXQUERY-701');
  assert.equal(parseJiraIssueKeyFromIssueUrl('/jira/software/c/projects/UX/boards/42?jql=project%3DUX'), null);
  assert.equal(parseJiraIssueKeyFromIssueUrl('/jira/software/c/projects/UX/issues/?jql=issuekey%20%3D%20UXJQL-800'), 'UXJQL-800');
  assert.equal(parseJiraIssueKeyFromIssueUrl('https://wiki.example.com/pages/UX-123'), null);
  assert.deepEqual(
    parseJiraIssueKeyCandidatesFromUrl('/browse/ABC-123?selectedIssue=UXQUERY-702'),
    [
      { key: 'ABC-123', keySource: 'jira_path' },
      { key: 'UXQUERY-702', keySource: 'jira_query_selected_issue' },
    ],
  );
  assert.deepEqual(
    parseJiraIssueKeyCandidatesFromUrl('/jira/software/c/projects/UX/boards/42?selectedIssue=UXQUERY-700&issueKey=UXQUERY-701'),
    [
      { key: 'UXQUERY-700', keySource: 'jira_query_selected_issue' },
      { key: 'UXQUERY-701', keySource: 'jira_query_issue_key' },
    ],
  );
  assert.deepEqual(
    parseJiraIssueKeyCandidatesFromUrl('/jira/software/c/projects/UX/issues/?jql=issuekey%20%3D%20UXJQL-800'),
    [
      { key: 'UXJQL-800', keySource: 'jira_query_jql' },
    ],
  );
  assert.deepEqual(
    parseJiraIssueKeyCandidatesFromUrl('/jira/software/c/projects/UX/issues/?idOrKey=UXKEY-801'),
    [
      { key: 'UXKEY-801', keySource: 'jira_query_issue_key' },
    ],
  );
  assert.deepEqual(parseJiraIssueKeysFromText('blocks ABC-123; design owner UXRAW-400, UX-200.'), ['ABC-123', 'UXRAW-400', 'UX-200']);
  assert.equal(parseJiraIssueKeyFromText('blocked by uxraw-400'), 'UXRAW-400');
  assert.equal(parseJiraIssueKeyFromText('embed UX-123-alpha'), null);
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
    extractDesignLinks('See https://www.loom.com/embed/abc123 for the walkthrough.').map(item => item.label),
    ['Loom walkthrough'],
  );
  assert.deepEqual(
    extractDesignLinks('Ignore https://miro.com/pricing and https://www.loom.com/blog/product-updates.').map(item => item.url),
    [],
  );
  assert.deepEqual(
    extractDesignLinks(
      'See https://www.figma.com/design/abc123/Spec?node-id=89%3A6&t=share and https://www.figma.com/design/abc123/Renamed?node-id=89-6.',
    ).map(item => item.label),
    ['Figma Design'],
  );
  const filteredScan = extractDesignLinkScan(`
    Build from https://www.figma.com/design/abc123/Spec.
    Ignore https://www.figma.com/community/plugin/123-demo,
    https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma,
    https://zeplin.io/integrations/jira,
    https://app.zeplin.io/profile,
    and https://app.zeplin.io/project/abc/settings.
  `);
  assert.deepEqual(filteredScan.links.map(item => item.url), ['https://www.figma.com/design/abc123/Spec']);
  assert.equal(filteredScan.ignored.length, 5);
  assert.equal(getIgnoredDesignLinkSummary(filteredScan.ignored), '5 filtered non-handoff refs');
  assert.equal(
    getIgnoredDesignLinkReasonSummary(filteredScan.ignored),
    'Figma Community 1, Figma documentation 1, Zeplin documentation or marketing page 1, Zeplin app non-project page 1, Zeplin non-resource project page 1',
  );
  assert.match(getIgnoredDesignLinkTooltip(filteredScan.ignored) || '', /Reasons: Figma Community 1.*Zeplin non-resource project page 1/);
  assert.equal(getIgnoredDesignLinkSourceSummary(filteredScan.ignored), undefined);
  assert.equal(
    getIgnoredDesignLinkSourceSummary([
      { ...filteredScan.ignored[0], source: 'description' },
      { ...filteredScan.ignored[1], source: 'remote_link' },
      { ...filteredScan.ignored[2], source: 'description, design_field' },
    ]),
    'Remote link 1, Design field 1, Description 2',
  );
  const ignoredWithDesignFieldSources = [
    { ...filteredScan.ignored[0], source: 'description' },
    { ...filteredScan.ignored[1], source: 'design_field' },
    { ...filteredScan.ignored[2], source: 'description, design_field' },
  ];
  assert.equal(getIgnoredDesignFieldLinkCount(ignoredWithDesignFieldSources), 2);
  assert.equal(getIgnoredDesignFieldLinkSummary(ignoredWithDesignFieldSources), '2 design-field non-handoff refs');
  assert.match(
    getIgnoredDesignFieldLinkTooltip(ignoredWithDesignFieldSources) || '',
    /UX ticket design-field URLs were scanned.*keeps the UX ticket in Missing link state.*does not edit Jira design fields/,
  );
  const fieldFilteredScan = extractDesignLinkScan(
    'UX field https://www.figma.com/community/plugin/123-demo and https://handoff.example.com/spec',
    true,
  );
  assert.deepEqual(fieldFilteredScan.links.map(item => item.url), ['https://handoff.example.com/spec']);
  assert.deepEqual(fieldFilteredScan.ignored.map(item => item.label), ['Figma Community']);
}

function verifyUXTicketKeySourceReceipts() {
  assert.equal(shouldShowUXTicketKeySourceReceipt('jira_path'), false);
  assert.equal(shouldShowUXTicketKeySourceReceipt('api'), false);
  assert.equal(shouldShowUXTicketKeySourceReceipt('jira_query'), true);
  assert.equal(shouldShowUXTicketKeySourceReceipt('jira_query_selected_issue'), true);
  assert.equal(shouldShowUXTicketKeySourceReceipt('jira_query_issue_key'), true);
  assert.equal(shouldShowUXTicketKeySourceReceipt('jira_query_jql'), true);
  assert.equal(getUXTicketKeySourceLabel('jira_query'), 'Key from URL query');
  assert.equal(getUXTicketKeySourceLabel('jira_query_selected_issue'), 'Key from selectedIssue query');
  assert.equal(getUXTicketKeySourceLabel('jira_query_issue_key'), 'Key from issueKey query');
  assert.equal(getUXTicketKeySourceLabel('jira_query_jql'), 'Key from JQL query');
  assert.equal(getUXTicketKeySourceLabel('data_issue_key'), 'Key from data-issue-key');
  assert.equal(getUXTicketKeyRecoveryBoundaryLabel('jira_path'), undefined);
  assert.equal(getUXTicketKeyRecoveryBoundaryLabel('text'), 'Read-only recovered');
  assert.match(
    getUXTicketKeyRecoveryBoundaryHint('jira_query') || '',
    /does not create or edit Jira issue links, design fields, or relationships/,
  );
  assert.match(
    getUXTicketKeySourceHint('aria_label') || '',
    /standard \/browse\/KEY linked issue URL.*ARIA label.*configured design project/,
  );
  assert.equal(getUXTicketRecoveryScopeSummary(0), undefined);
  assert.equal(getUXTicketRecoveryScopeSummary(1), '1 recovered UX ticket candidate');
  assert.equal(getUXTicketRecoveryScopeSummary(3), '3 recovered UX ticket candidates');
  const recoveredItems: DesignDisplayItem[] = [
    { type: 'ux_ticket', uxTicketKey: 'UX-1', source: 'linked_issues', linkProvided: false, uxTicketKeySource: 'jira_path' },
    { type: 'ux_ticket', uxTicketKey: 'UX-2', source: 'linked_issues', linkProvided: false, uxTicketKeySource: 'jira_query_selected_issue' },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-3',
      source: 'linked_issues',
      linkProvided: false,
      uxTicketKeySource: 'text',
      keyRecoveryIgnoredCandidateCount: 2,
      keyRecoveryIgnoredSourceCounts: { text: 1, jira_path: 1 },
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-4',
      source: 'linked_issues',
      linkProvided: false,
      uxTicketKeySource: 'jira_query_jql',
      keyRecoveryIgnoredCandidateCount: 1,
      keyRecoveryIgnoredSourceCounts: { jira_path: 1 },
    },
    { type: 'ux_ticket', uxTicketKey: 'UX-5', source: 'linked_issues', linkProvided: false, uxTicketKeySource: 'jira_query_issue_key' },
    { type: 'figma', url: 'https://www.figma.com/design/abc/demo', source: 'description' },
  ];
  assert.equal(getRecoveredUXTicketCandidateCount(recoveredItems), 4);
  assert.deepEqual(getRecoveredUXTicketSourceCounts(recoveredItems), {
    jira_query_selected_issue: 1,
    jira_query_issue_key: 1,
    jira_query_jql: 1,
    text: 1,
  });
  assert.equal(getUXTicketRecoverySourceSummary(recoveredItems), '1 selectedIssue query, 1 issueKey query, 1 JQL query, 1 raw text');
  assert.equal(getUXTicketRecoveryIgnoredCandidateCount(recoveredItems), 3);
  assert.deepEqual(getUXTicketRecoveryIgnoredSourceCounts(recoveredItems), {
    jira_path: 2,
    text: 1,
  });
  assert.equal(getUXTicketRecoveryIgnoredSourceSummary(recoveredItems), '2 Jira issue URL, 1 raw text');
  assert.equal(getUXTicketRecoveryFilterSummary(0), undefined);
  assert.equal(getUXTicketRecoveryFilterSummary(1), '1 non-design candidate ignored');
  assert.equal(getUXTicketRecoveryFilterSummary(3), '3 non-design candidates ignored');
}

function verifyRemoteLinkPayloadExtraction() {
  assert.deepEqual(
    extractDesignLinksFromRemoteLinkPayload({
      globalId: 'appId=figma&url=https%3A%2F%2Fwww.figma.com%2Fdesign%2Fglobal789%2FSettings%3Fnode-id%3D5-6',
      object: {
        title: 'Settings fallback handoff',
        url: 'https://example.com/not-design',
      },
    }).links.map(item => item.url),
    ['https://www.figma.com/design/global789/Settings?node-id=5-6'],
  );
  assert.deepEqual(
    extractDesignLinksFromRemoteLinkPayload({
      object: {
        title: 'Status-linked prototype',
        url: 'https://example.com/not-design',
        status: {
          icon: {
            link: 'https://www.figma.com/proto/statusabc/Flow',
          },
        },
      },
    }).links.map(item => item.label),
    ['Figma Prototype'],
  );
  assert.deepEqual(
    extractDesignLinksFromRemoteLinkPayload({
      object: {
        title: 'Nested redirect handoff',
        url: 'https://jira.example.com/plugins/servlet/ac/figma?target=https%3A%2F%2Fwww.figma.com%2Fdesign%2Fnested111%2FProfile%3Fnode-id%3D7%253A8',
      },
    }).links.map(item => item.url),
    ['https://www.figma.com/design/nested111/Profile?node-id=7%3A8'],
  );
  assert.deepEqual(
    extractDesignLinksFromRemoteLinkPayload({
      object: {
        title: 'Nested non-handoff URL',
        url: 'https://jira.example.com/plugins/servlet/ac/figma?target=https%3A%2F%2Fwww.figma.com%2Fcommunity%2Fplugin%2F123-demo',
      },
    }).links,
    [],
  );
  assert.deepEqual(
    extractDesignLinksFromRemoteLinkPayload({
      globalId: 'appId=docs&url=https%3A%2F%2Fwww.figma.com%2Fcommunity%2Fplugin%2F123-demo',
      object: {
        title: 'Figma plugin listing',
        url: 'https://example.com/not-design',
      },
    }).links,
    [],
  );
  const filteredPayload = extractDesignLinksFromRemoteLinkPayload({
    object: {
      title: 'Design support references',
      url: 'https://app.zeplin.io/project/abc/settings',
    },
    globalId: 'appId=figma&url=https%3A%2F%2Fhelp.figma.com%2Fhc%2Fen-us%2Farticles%2F360039827834-Jira-and-Figma',
  });
  assert.equal(filteredPayload.links.length, 0);
  assert.equal(filteredPayload.ignored.length, 2);
  assert.equal(
    getIgnoredDesignLinkReasonSummary(filteredPayload.ignored),
    'Zeplin non-resource project page 1, Figma documentation 1',
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
  assert.equal(formatDesignUpdatedDateTime('2026-05-18T10:20:00.000+0000'), '2026-05-18 10:20 UTC');
  assert.equal(formatDesignUpdatedDate('2026-05-18'), '2026-05-18');
  assert.equal(formatDesignUpdatedDateTime('2026-05-18'), undefined);
  assert.equal(formatDesignUpdatedDate('Mon, 18 May 2026 10:20:00 GMT'), '2026-05-18');
  assert.equal(formatDesignUpdatedDate('not a date'), undefined);
  assert.equal(
    formatDesignUpdatedTooltip('2026-05-18T10:20:00.000+0000'),
    'Design update reported 2026-05-18 10:20 UTC. Re-check the linked design if implementation started before this update.',
  );
  assert.equal(getDesignUpdatedAtSourceLabel('object.status.updatedAt'), 'Jira/Figma status updated time');
  assert.equal(getDesignUpdatedAtBasisLabel('object.status.updatedAt', '2026-05-18T10:20:00.000+0000'), 'Status time');
  assert.equal(getDesignUpdatedAtBasisLabel('object.updatedDate', '2026-05-18'), 'Object date');
  assert.equal(getDesignUpdatedAtBasisLabel('remoteLink.updatedAt', '2026-05-18T10:20:00.000+0000'), 'Remote link time');
  assert.equal(getDesignUpdatedAtBasisLabel(undefined, '2026-05-18T10:20:00.000+0000'), undefined);
  assert.equal(
    formatDesignUpdatedBasisTooltip('object.status.updatedAt', '2026-05-18T10:20:00.000+0000'),
    'Status time. The visible updated date comes from Jira/Figma status updated time; this does not refresh Figma, edit Jira, or confirm that the design update was reviewed.',
  );
  assert.equal(
    formatDesignUpdatedTooltip('2026-05-18T10:20:00.000+0000', 'object.status.updatedAt'),
    'Design update reported 2026-05-18 10:20 UTC. Re-check the linked design if implementation started before this update. Source: Jira/Figma status updated time.',
  );
  assert.equal(
    formatDesignUpdatedTooltip('2026-05-18'),
    'Design update reported on 2026-05-18. Source did not provide a specific time; re-check the linked design if implementation started before this date.',
  );
  assert.equal(
    formatDesignUpdatedTooltip('2026-05-18', 'object.updatedDate'),
    'Design update reported on 2026-05-18. Source did not provide a specific time; re-check the linked design if implementation started before this date. Source: Jira object updated date.',
  );
  assert.equal(
    chooseLatestDesignUpdatedAt(
      '2026-05-18T10:20:00.000+0000',
      '2026-05-19T12:34:00.000+0000',
      'not a date',
    ),
    '2026-05-19T12:34:00.000+0000',
  );
  assert.deepEqual(
    chooseLatestDesignUpdatedAtWithSource(
      { value: '2026-05-18T10:20:00.000+0000', source: 'object.updatedDate' },
      { value: '2026-05-19T12:34:00.000+0000', source: 'object.status.updatedAt' },
      { value: 'not a date', source: 'remoteLink.updatedAt' },
    ),
    {
      value: '2026-05-19T12:34:00.000+0000',
      source: 'object.status.updatedAt',
    },
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
      updatedAtSource: 'object.status.updatedAt',
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
  assert.equal((deduped[1] as any).designUpdatedAtSource, 'object.status.updatedAt');
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
      updatedAtSource: 'remoteLink.updatedDate',
    },
  ];

  const encodedDeduped = dedupeDesignData(encodedFigmaItems);
  assert.equal(encodedDeduped.length, 1);
  assert.equal(encodedDeduped[0].type, 'figma');
  assert.equal((encodedDeduped[0] as any).source, 'description, remote_link');
  assert.equal((encodedDeduped[0] as any).title, 'Ready checkout handoff');
  assert.equal((encodedDeduped[0] as any).status, 'ready_for_development');
  assert.equal((encodedDeduped[0] as any).updatedAt, '2026-05-18T10:20:00.000+0000');
  assert.equal((encodedDeduped[0] as any).updatedAtSource, 'remoteLink.updatedDate');
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
  assert.match(getDesignStatusActionHint('Missing link') || '', /no handoff URL.*add or check the design link/);
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
      issueStatus: 'To Do',
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-125',
      summary: 'Closed parent item',
      source: 'parent_issue_link',
      linkProvided: false,
      issueStatus: 'Closed',
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
  // Channel: current-ticket direct / linked+remote first, then parent (closed before open).
  assert.equal((sorted[0] as any).uxTicketKey, 'UX-123');
  assert.equal(getDesignDisplayStatusTone(sorted[0]), 'ready');
  assert.equal((sorted[1] as any).status, 'Design updated');
  assert.equal(sorted[2].type, 'figma');
  assert.equal((sorted[3] as any).uxTicketKey, 'UX-125');
  assert.equal((sorted[4] as any).uxTicketKey, 'UX-124');

  const prepared = prepareDesignDisplayItems([
    ...items,
    {
      type: 'ux_ticket',
      uxTicketKey: 'ABC-999',
      summary: 'Same project should hide',
      source: 'linked_issues',
      linkProvided: false,
    },
    {
      type: 'figma',
      url: 'https://www.figma.com/design/extra/one',
      source: 'description',
    },
    {
      type: 'figma',
      url: 'https://www.figma.com/design/extra/two',
      source: 'description',
    },
  ], 'ABC-123');
  assert.equal(prepared.length, JIRA_CONTEXT_PANEL_ITEM_LIMIT);
  assert.ok(prepared.every(item => item.type !== 'ux_ticket' || (item as any).uxTicketKey !== 'ABC-999'));

  const preparedWithoutCancelled = prepareDesignDisplayItems([
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-CANCEL',
      summary: 'Cancelled parent ticket should hide',
      source: 'parent_child_issue',
      linkProvided: false,
      issueStatus: 'Cancelled',
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-OPEN',
      summary: 'Open parent ticket should remain',
      source: 'parent_child_issue',
      linkProvided: false,
      issueStatus: 'Initial',
    },
  ], 'MTR-141170');
  assert.equal(preparedWithoutCancelled.length, 1);
  assert.equal((preparedWithoutCancelled[0] as any).uxTicketKey, 'UX-OPEN');
  assert.match(
    getDesignSourceSummary(sorted),
    /^5 entries · Remote link, Linked issue/,
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

function verifyMissingUpdatedDateReceipt() {
  assert.equal(isDesignUpdatedDateMissing({
    type: 'design_link',
    url: 'https://www.figma.com/design/no-date/Checkout',
    title: 'Changed design without timestamp',
    status: 'Design updated',
    tool: 'figma',
    label: 'Figma Design',
    source: 'jira_designs',
  }), true);
  assert.equal(isDesignUpdatedDateMissing({
    type: 'design_link',
    url: 'https://www.figma.com/design/dated/Checkout',
    title: 'Changed design with timestamp',
    status: 'Design updated',
    updatedAt: '2026-05-21T16:45:00.000+0000',
    tool: 'figma',
    label: 'Figma Design',
    source: 'remote_link',
  }), false);
  assert.equal(isDesignUpdatedDateMissing({
    type: 'ux_ticket',
    url: 'https://www.figma.com/design/ux/Checkout',
    summary: 'UX design without update time',
    designStatus: 'Changed',
    uxTicketKey: 'UX-123',
    source: 'linked_issues',
    linkProvided: true,
  }), true);
  assert.equal(isDesignUpdatedDateMissing({
    type: 'ux_ticket',
    uxTicketKey: 'UX-124',
    source: 'linked_issues',
    linkProvided: false,
  }), false);
}

function verifyDesignUpdateReviewScope() {
  const scope = getDesignUpdateReviewScope([
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/ready/Checkout',
      title: 'Ready handoff',
      status: 'Ready for dev',
      updatedAt: '2026-05-19T12:34:00.000+0000',
      updatedAtSource: 'object.status.updatedAt',
      tool: 'figma',
      label: 'Figma Design',
      source: 'remote_link',
    },
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/dayonly/Calendar',
      title: 'Changed day handoff',
      status: 'Changed',
      updatedAt: '2026-05-21',
      updatedAtSource: 'object.updatedDate',
      tool: 'figma',
      label: 'Figma Design',
      source: 'remote_link',
    },
    {
      type: 'design_link',
      url: 'https://www.figma.com/design/no-date/Settings',
      title: 'Changed without timestamp',
      status: 'Design updated',
      tool: 'figma',
      label: 'Figma Design',
      source: 'jira_designs',
    },
    {
      type: 'ux_ticket',
      uxTicketKey: 'UX-200',
      source: 'linked_issues',
      linkProvided: false,
    },
  ]);

  assert.ok(scope, 'dated and missing updated rows should produce a review scope');
  assert.equal(scope.updateSignalCount, 3);
  assert.equal(scope.missingUpdatedAtCount, 1);
  assert.equal(scope.latestUpdatedDateLabel, '2026-05-21');
  assert.equal(scope.latestUpdatedAtSource, 'object.updatedDate');
  assert.equal(scope.latestUpdatedAtSourceLabel, 'Jira object updated date');
  assert.equal(scope.latestUpdatedAtBasisLabel, 'Object date');
  assert.equal(scope.summary, '3 design update signals; latest 2026-05-21; latest source Object date; 1 missing update time');
  assert.match(scope.tooltip, /does not refresh Figma, edit Jira, or confirm that the design update was reviewed/);
  assert.match(scope.tooltip, /Latest reported update: 2026-05-21 from Jira object updated date/);
  assert.equal(getDesignUpdateReviewScope([]), undefined);
  assert.equal(getDesignUpdateReviewScope([
    {
      type: 'figma',
      url: 'https://www.figma.com/design/no-date/Checkout',
      status: 'Ready for dev',
      source: 'description',
    },
  ]), undefined);
}

function verifyDesignScanBasisReceipt() {
  const receipt = getDesignScanBasisReceipt([
    {
      type: 'figma',
      url: 'https://www.figma.com/design/abc123/Checkout',
      source: 'description',
      label: 'Figma Design',
    },
    {
      type: 'design_link',
      url: 'https://app.zeplin.io/project/abc/screen/def',
      source: 'remote_link',
      tool: 'zeplin',
      label: 'Zeplin screen',
    },
  ], [
    {
      url: 'https://www.figma.com/community/plugin/123',
      tool: 'figma',
      label: 'Figma Community',
      source: 'description',
    },
    {
      url: 'https://app.zeplin.io/project/abc/settings',
      tool: 'zeplin',
      label: 'Zeplin non-resource project page',
      source: 'design_field',
    },
  ]);

  assert.equal(receipt.handoffEntryCount, 2);
  assert.equal(receipt.filteredNonHandoffCount, 2);
  assert.equal(receipt.sourceSummary, '2 entries · Remote link, Description');
  assert.equal(receipt.ignoredSummary, '2 filtered non-handoff refs');
  assert.equal(receipt.ignoredSourceSummary, 'Design field 1, Description 1');
  assert.equal(receipt.ignoredReasonSummary, 'Figma Community 1, Zeplin non-resource project page 1');
  assert.equal(receipt.summary, 'Jira-visible handoff scan: 2 entries · Remote link, Description; 2 filtered non-handoff refs');
  assert.match(receipt.tooltip, /only uses links visible in this Jira page and read-only Jira APIs/);
  assert.match(receipt.tooltip, /does not refresh Figma or Zeplin/);
  assert.match(receipt.tooltip, /create or edit Jira links/);

  const filteredOnlyReceipt = getDesignScanBasisReceipt([], [
    {
      url: 'https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma',
      tool: 'figma',
      label: 'Figma documentation',
      source: 'description',
    },
  ]);
  assert.equal(filteredOnlyReceipt.sourceSummary, '0 handoff entries');
  assert.equal(filteredOnlyReceipt.summary, 'Jira-visible handoff scan: 0 handoff entries; 1 filtered non-handoff ref');
  assert.match(filteredOnlyReceipt.tooltip, /No handoff rows are shown/);
  assert.match(filteredOnlyReceipt.tooltip, /Filtered sources: Description 1/);
}

function verifyDesignEtaResolution() {
  assert.deepEqual(
    resolveDesignEta({
      targetEnd: '2026-10-27',
      dueDate: '2026-05-10',
      fixVersion: '26Q2',
    }),
    { eta: '2026-10-27', source: 'targetEnd' },
  );
  assert.deepEqual(
    resolveDesignEta({
      targetEnd: '  ',
      dueDate: '2026-05-10',
      fixVersion: '26Q2',
    }),
    { eta: '2026-05-10', source: 'duedate' },
  );
  assert.deepEqual(
    resolveDesignEta({
      targetEnd: null,
      dueDate: null,
      fixVersion: '26Q2',
    }),
    { eta: '26Q2', source: 'fixVersion' },
  );
  assert.deepEqual(resolveDesignEta({}), {});
}

verifyProjectPatternMatching();
verifyUrlNormalization();
verifyUXTicketKeySourceReceipts();
verifyRemoteLinkPayloadExtraction();
verifyEscaping();
verifyDesignUpdatedDates();
verifySourceLabels();
verifyFigmaLabels();
verifyDedupe();
verifyStatusTones();
verifyDisplayOrdering();
verifyUpdatedDateOrdering();
verifyMissingUpdatedDateReceipt();
verifyDesignUpdateReviewScope();
verifyDesignScanBasisReceipt();
verifyDesignEtaResolution();

console.log('Jira design links verification passed');
