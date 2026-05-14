import assert from 'node:assert/strict';
import {
  applyProjectUpdates,
  ProjectUpdateSuggestion,
} from '../src/slide';
import { TableContentAnalyzerImpl } from '../src/analyzers/tableAnalyzer';
import { TextContentAnalyzerImpl } from '../src/analyzers/textAnalyzer';
import {
  containsSuggestionText,
  extractJiraTicketKeys,
  getNewSuggestionText,
  joinSuggestionText,
  normalizeComparableText,
} from '../src/utils/slidesAnalyzerSuggestions';
import { createProjectUpdateSuggestion } from '../src/utils/slidesAnalyzerUpdateSuggestions';
import {
  hasAttentionRiskLevelSignal,
  hasProjectRiskSignal,
  hasRiskLevelSignal,
  includesRiskKeyword,
  isClosedStatus,
  normalizeProjectRiskLevel,
} from '../src/utils/slidesAnalyzerRisk';

assert.equal(
  joinSuggestionText(['Design review done', '', 'Design review done'], undefined, ['Backend work started']),
  'Design review done\nBackend work started',
);

assert.equal(joinSuggestionText(undefined, [], ''), '');

assert.equal(
  normalizeComparableText('  Design   Review\nDone  '),
  'design review done',
);

assert.equal(
  containsSuggestionText('Existing note. Design review done Backend work started.', 'Design review done\nBackend work started'),
  true,
);

assert.equal(
  containsSuggestionText('Existing note only.', 'Design review done'),
  false,
);

assert.equal(
  getNewSuggestionText(
    'Existing note.\nRelease notes drafted.',
    'Release notes drafted\nCustomer rollout owner confirmed',
  ),
  'Customer rollout owner confirmed',
);

assert.equal(
  getNewSuggestionText('Existing note. Customer rollout owner confirmed.', 'Customer rollout owner confirmed'),
  '',
);

assert.deepEqual(
  extractJiraTicketKeys('MTR-123407: Project', 'See AIT2-11063 and MTR-123407 again', 'bad-123'),
  ['MTR-123407', 'AIT2-11063'],
);

assert.equal(includesRiskKeyword('No risk: launch is on track'), false);
assert.equal(includesRiskKeyword('without schedule delay'), false);
assert.equal(includesRiskKeyword('blocked on API review'), true);
assert.equal(includesRiskKeyword('Incomplete'), false);
assert.equal(isClosedStatus('Incomplete'), false);
assert.equal(isClosedStatus('Not done'), false);
assert.equal(isClosedStatus('not completed'), false);
assert.equal(isClosedStatus('未完成'), false);
assert.equal(isClosedStatus('Completed'), true);
assert.equal(normalizeProjectRiskLevel(' MEDIUM '), 'medium');
assert.equal(normalizeProjectRiskLevel('unknown'), undefined);
assert.equal(hasRiskLevelSignal('critical'), true);
assert.equal(hasRiskLevelSignal('High'), true);
assert.equal(hasRiskLevelSignal('medium'), false);
assert.equal(hasAttentionRiskLevelSignal('medium'), true);
assert.equal(hasAttentionRiskLevelSignal('normal'), true);
assert.equal(hasAttentionRiskLevelSignal('low'), false);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'No risk',
    riskLevel: 'normal',
    jiraIssues: [],
  }),
  false,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'medium',
    jiraIssues: [],
  }),
  false,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'High',
    jiraIssues: [],
  }),
  true,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'Blocked',
    riskLevel: 'normal',
    jiraIssues: [],
  }),
  true,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'normal',
    now: new Date('2026-05-11T00:00:00Z').getTime(),
    jiraIssues: [{
      key: 'MTR-123412',
      status: 'Incomplete',
      priority: 'Medium',
      duedate: '2026-05-01',
    } as any],
  }),
  true,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'normal',
    now: new Date('2026-05-11T00:00:00Z').getTime(),
    jiraIssues: [{
      key: 'MTR-123413',
      status: 'Done',
      priority: 'Medium',
      duedate: '2026-05-01',
    } as any],
  }),
  false,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'normal',
    jiraIssues: [{
      key: 'MTR-123414',
      status: 'Done',
      priority: 'High',
      duedate: '2026-05-01',
    } as any],
  }),
  false,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'normal',
    jiraIssues: [{
      key: 'MTR-123415',
      status: 'In Progress',
      priority: 'High',
      duedate: '2026-05-01',
    } as any],
  }),
  true,
);

assert.equal(
  hasProjectRiskSignal({
    currentStatus: 'On track',
    riskLevel: 'normal',
    now: new Date('2026-05-11T00:00:00Z').getTime(),
    jiraIssues: [{
      key: 'MTR-123416',
      status: 'Not done',
      priority: 'Medium',
      duedate: '2026-05-01',
    } as any],
  }),
  true,
);

const blockedSuggestion = createProjectUpdateSuggestion(
  {
    id: 'MTR-123407',
    name: 'Missing status column',
    status: 'At risk',
    owner: 'Ada',
    comments: '',
    slideId: 'slide-1',
    tableId: 'table-1',
    row: 1,
    columnIndices: {
      status: -1,
      owner: 2,
      comments: 3,
    },
  },
  {
    type: 'project',
    projectId: 'MTR-123407',
    projectName: 'Missing status column',
    summary: 'Jira moved forward',
    importanceLevel: 'medium',
    needsProcessing: true,
    confidence: 0.91,
    riskLevel: 'normal',
    suggestions: {
      status: 'On track',
      statusReason: 'Jira is resolved',
    },
  },
);

assert.equal(blockedSuggestion?.suggestedStatus, 'On track');
assert.equal(blockedSuggestion?.columnIndices?.status, -1);

const partialDuplicateCommentSuggestion = createProjectUpdateSuggestion(
  {
    id: 'MTR-123408',
    name: 'Partial duplicate comments',
    status: 'In progress',
    owner: 'Ada',
    comments: 'Release notes drafted.',
    slideId: 'slide-1',
    tableId: 'table-1',
    row: 2,
    columnIndices: {
      status: 1,
      owner: 2,
      comments: 3,
    },
  },
  {
    type: 'project',
    projectId: 'MTR-123408',
    projectName: 'Partial duplicate comments',
    summary: 'Only one action item is new',
    importanceLevel: 'medium',
    needsProcessing: true,
    confidence: 0.88,
    riskLevel: 'normal',
    suggestions: {
      highlights: ['Release notes drafted'],
      actionItems: ['Customer rollout owner confirmed'],
    },
  },
);

assert.equal(
  partialDuplicateCommentSuggestion?.suggestedComments,
  'Customer rollout owner confirmed',
);

const fullyDuplicateCommentSuggestion = createProjectUpdateSuggestion(
  {
    id: 'MTR-123409',
    name: 'Duplicate comments',
    status: 'In progress',
    owner: 'Ada',
    comments: 'Release notes drafted. Customer rollout owner confirmed.',
    slideId: 'slide-1',
    tableId: 'table-1',
    row: 3,
    columnIndices: {
      status: 1,
      owner: 2,
      comments: 3,
    },
  },
  {
    type: 'project',
    projectId: 'MTR-123409',
    projectName: 'Duplicate comments',
    summary: 'No new comment content',
    importanceLevel: 'low',
    needsProcessing: false,
    confidence: 0.92,
    riskLevel: 'low',
    suggestions: {
      highlights: ['Release notes drafted'],
      actionItems: ['Customer rollout owner confirmed'],
    },
  },
);

assert.equal(fullyDuplicateCommentSuggestion, null);

const normalizedNoopSuggestion = createProjectUpdateSuggestion(
  {
    id: 'MTR-123410',
    name: 'Whitespace only update',
    status: 'In progress',
    owner: 'Ada Lovelace',
    track: 'Core Platform',
    comments: '',
    slideId: 'slide-1',
    tableId: 'table-1',
    row: 4,
    columnIndices: {
      status: 1,
      owner: 2,
      track: 3,
      comments: 4,
    },
  },
  {
    type: 'project',
    projectId: 'MTR-123410',
    projectName: 'Whitespace only update',
    summary: 'Values only differ by case and whitespace',
    importanceLevel: 'low',
    needsProcessing: false,
    confidence: 0,
    riskLevel: 'low',
    suggestions: {
      status: '  in   progress  ',
      owner: 'ada lovelace',
      track: 'Core   Platform',
    },
  },
);

assert.equal(normalizedNoopSuggestion, null);

const zeroConfidenceSuggestion = createProjectUpdateSuggestion(
  {
    id: 'MTR-123411',
    name: 'Zero confidence update',
    status: 'At risk',
    owner: 'Ada',
    comments: '',
    slideId: 'slide-1',
    tableId: 'table-1',
    row: 5,
    columnIndices: {
      status: 1,
      owner: 2,
      comments: 3,
    },
  },
  {
    type: 'project',
    projectId: 'MTR-123411',
    projectName: 'Zero confidence update',
    summary: 'Changed but confidence is zero',
    importanceLevel: 'low',
    needsProcessing: true,
    confidence: 0,
    riskLevel: 'low',
    suggestions: {
      status: 'Blocked',
      statusReason: 'No supporting source',
    },
  },
);

assert.equal(zeroConfidenceSuggestion?.confidence, 0);

const makeCell = (content: string) => ({
  text: {
    textElements: [
      {
        textRun: { content },
      },
    ],
  },
});

const tableAnalyzer = new TableContentAnalyzerImpl();
const highlightsTable = await tableAnalyzer.analyzeTable({
  objectId: 'table-highlights',
  table: {
    tableRows: [
      {
        tableCells: [
          makeCell('Project'),
          makeCell('Status'),
          makeCell('Owner'),
          makeCell('Highlights / Next steps'),
        ],
      },
      {
        tableCells: [
          makeCell('MTR-123407: Slides analyzer'),
          makeCell('In progress'),
          makeCell('Ada'),
          makeCell('Need rollout plan'),
        ],
      },
    ],
  },
} as any);

assert.equal(highlightsTable.columnMapping.comments, 3);
assert.equal(highlightsTable.projectRows[0].comments, 'Need rollout plan');

const multiTableSlide = await tableAnalyzer.analyze({
  objectId: 'slide-multi-table',
  pageElements: [
    {
      objectId: 'table-core',
      table: {
        tableRows: [
          {
            tableCells: [
              makeCell('Project'),
              makeCell('Status'),
              makeCell('Owner'),
              makeCell('Next steps'),
            ],
          },
          {
            tableCells: [
              makeCell('MTR-123501: Core rollout'),
              makeCell('In progress'),
              makeCell('Ada'),
              makeCell('Need design signoff'),
            ],
          },
          {
            tableCells: [
              makeCell('MTR-123502: Core migration'),
              makeCell('Blocked'),
              makeCell('Ben'),
              makeCell('Waiting on API contract'),
            ],
          },
        ],
      },
    },
    {
      objectId: 'table-growth',
      table: {
        tableRows: [
          {
            tableCells: [
              makeCell('Project'),
              makeCell('Status'),
              makeCell('Owner'),
              makeCell('Comments'),
            ],
          },
          {
            tableCells: [
              makeCell('MTR-123503: Growth summary'),
              makeCell('At risk'),
              makeCell('Cara'),
              makeCell('Need launch decision'),
            ],
          },
        ],
      },
    },
    {
      objectId: 'table-metrics',
      table: {
        tableRows: [
          {
            tableCells: [
              makeCell('Metric'),
              makeCell('Value'),
              makeCell('Notes'),
            ],
          },
          {
            tableCells: [
              makeCell('Revenue'),
              makeCell('42'),
              makeCell('Not a project table'),
            ],
          },
        ],
      },
    },
  ],
} as any);

assert.equal(multiTableSlide.projects.length, 3);
assert.deepEqual(
  multiTableSlide.projects.map(project => project.id),
  ['MTR-123501', 'MTR-123502', 'MTR-123503'],
);
assert.deepEqual(
  multiTableSlide.projects.map(project => project.tableId),
  ['table-core', 'table-core', 'table-growth'],
);
assert.match((multiTableSlide.warnings || []).join('\n'), /2 个可信项目表格/);

const numberedProjectKeyTable = await tableAnalyzer.analyzeTable({
  objectId: 'table-numbered-project-key',
  table: {
    tableRows: [
      {
        tableCells: [
          makeCell('Project'),
          makeCell('Status'),
          makeCell('Owner'),
        ],
      },
      {
        tableCells: [
          makeCell('AIT2-11063: Numbered Jira prefix'),
          makeCell('In progress'),
          makeCell('Ada'),
        ],
      },
    ],
  },
} as any);

assert.equal(numberedProjectKeyTable.projectRows[0].id, 'AIT2-11063');
assert.equal(numberedProjectKeyTable.projectRows[0].name, 'Numbered Jira prefix');

const textAnalyzer = new TextContentAnalyzerImpl();
const numberedProjectKeyText = await textAnalyzer.analyzeTextElements([
  {
    objectId: 'shape-numbered-project-key',
    shape: {
      text: {
        textElements: [
          {
            paragraphMarker: {
              style: {},
            },
          },
          {
            textRun: {
              content: 'AIT2-11063: Leadership summary [In progress] @Ada. Needs final review.',
            },
          },
        ],
      },
    },
  },
] as any);

assert.equal(numberedProjectKeyText.projects[0].id, 'AIT2-11063');
assert.equal(numberedProjectKeyText.projects[0].owner, 'Ada');

const nestedTextProject = await textAnalyzer.analyzeTextElements([
  {
    objectId: 'shape-nested-project',
    shape: {
      text: {
        textElements: [
          {
            paragraphMarker: {
              style: {
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                indent: { magnitude: 0 },
              },
            },
          },
          {
            textRun: {
              content: 'MTR-123500: Nested project',
            },
          },
          {
            paragraphMarker: {
              style: {
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                indent: { magnitude: 20 },
              },
            },
          },
          {
            textRun: {
              content: 'Status: In progress',
            },
          },
          {
            paragraphMarker: {
              style: {
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                indent: { magnitude: 20 },
              },
            },
          },
          {
            textRun: {
              content: 'Owner: Ada',
            },
          },
          {
            paragraphMarker: {
              style: {
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                indent: { magnitude: 20 },
              },
            },
          },
          {
            textRun: {
              content: 'Need rollout plan',
            },
          },
        ],
      },
    },
  },
] as any);

assert.equal(nestedTextProject.projects.length, 1);
assert.equal(nestedTextProject.projects[0].id, 'MTR-123500');
assert.equal(nestedTextProject.projects[0].status, 'In progress');
assert.equal(nestedTextProject.projects[0].owner, 'Ada');
assert.equal(nestedTextProject.projects[0].comments, 'Need rollout plan');

const requestsSeen: any[] = [];

(globalThis as any).fetch = async (url: string, init: RequestInit) => {
  assert.equal(url, 'https://slides.googleapis.com/v1/presentations/presentation-1:batchUpdate');
  assert.equal(init.method, 'POST');
  assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer token-1');

  const body = JSON.parse(String(init.body));
  requestsSeen.push(...body.requests);

  return {
    ok: true,
    json: async () => ({ presentationId: 'presentation-1', replies: [] }),
  };
};

const fullUpdate: ProjectUpdateSuggestion = {
  projectId: 'MTR-123407',
  projectName: 'Slides writeback',
  currentStatus: 'At risk',
  suggestedStatus: 'On track',
  currentOwner: 'Old Owner',
  suggestedOwner: 'New Owner',
  currentTrack: 'Core',
  suggestedTrack: 'Growth',
  currentComments: 'Existing note',
  suggestedComments: 'New validated action item',
  reason: ['Jira status changed'],
  sourceInfo: {},
  confidence: 0.9,
  slideId: 'slide-1',
  tableId: 'table-1',
  rowIndex: 2,
  columnIndices: {
    status: 1,
    owner: 2,
    track: 3,
    comments: 4,
  },
};

const writeResult = await applyProjectUpdates('presentation-1', 'token-1', [fullUpdate]);
assert.equal(writeResult.success, true);
assert.equal(writeResult.updatedCount, 4);
assert.equal(requestsSeen.length, 8);

for (let i = 0; i < requestsSeen.length; i += 2) {
  assert.deepEqual(requestsSeen[i].deleteText.textRange, { type: 'ALL' });
  assert.equal(requestsSeen[i + 1].insertText.insertionIndex, 0);
  assert.deepEqual(
    requestsSeen[i].deleteText.cellLocation,
    requestsSeen[i + 1].insertText.cellLocation,
  );
}

assert.equal(requestsSeen[7].insertText.text, 'Existing note\nNew validated action item');

requestsSeen.length = 0;
const duplicateCommentResult = await applyProjectUpdates('presentation-1', 'token-1', [{
  ...fullUpdate,
  suggestedStatus: undefined,
  suggestedOwner: undefined,
  suggestedTrack: undefined,
  currentComments: 'Existing note. New validated action item',
}]);

assert.equal(duplicateCommentResult.success, true);
assert.equal(duplicateCommentResult.updatedCount, 0);
assert.equal(requestsSeen.length, 0);

requestsSeen.length = 0;
const partialDuplicateCommentResult = await applyProjectUpdates('presentation-1', 'token-1', [{
  ...fullUpdate,
  suggestedStatus: undefined,
  suggestedOwner: undefined,
  suggestedTrack: undefined,
  currentComments: 'Existing note. New validated action item',
  suggestedComments: 'New validated action item\nFollow up with PM',
}]);

assert.equal(partialDuplicateCommentResult.success, true);
assert.equal(partialDuplicateCommentResult.updatedCount, 1);
assert.equal(requestsSeen.length, 2);
assert.equal(requestsSeen[1].insertText.text, 'Existing note. New validated action item\nFollow up with PM');

requestsSeen.length = 0;
const normalizedNoopWriteResult = await applyProjectUpdates('presentation-1', 'token-1', [{
  ...fullUpdate,
  suggestedStatus: '  at   risk ',
  suggestedOwner: 'old owner',
  suggestedTrack: 'Core',
  suggestedComments: undefined,
}]);

assert.equal(normalizedNoopWriteResult.success, true);
assert.equal(normalizedNoopWriteResult.updatedCount, 0);
assert.equal(requestsSeen.length, 0);

requestsSeen.length = 0;
const missingColumnResult = await applyProjectUpdates('presentation-1', 'token-1', [{
  ...fullUpdate,
  suggestedOwner: undefined,
  suggestedTrack: undefined,
  suggestedComments: undefined,
  columnIndices: {
    ...fullUpdate.columnIndices,
    status: -1,
  },
}]);

assert.equal(missingColumnResult.success, false);
assert.equal(missingColumnResult.updatedCount, 0);
assert.match(missingColumnResult.errors?.[0] || '', /无法更新状态/);
assert.equal(requestsSeen.length, 0);

requestsSeen.length = 0;
const invalidRowResult = await applyProjectUpdates('presentation-1', 'token-1', [{
  ...fullUpdate,
  rowIndex: -1,
  suggestedOwner: undefined,
  suggestedTrack: undefined,
  suggestedComments: undefined,
}]);

assert.equal(invalidRowResult.success, false);
assert.equal(invalidRowResult.updatedCount, 0);
assert.match(invalidRowResult.errors?.[0] || '', /缺少或无效更新位置信息/);
assert.equal(requestsSeen.length, 0);

console.log('google_slides_analyzer checks passed');
