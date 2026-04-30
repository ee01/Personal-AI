import assert from 'node:assert/strict';
import {
  containsSuggestionText,
  extractJiraTicketKeys,
  joinSuggestionText,
  normalizeComparableText,
} from '../src/utils/slidesAnalyzerSuggestions';

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

assert.deepEqual(
  extractJiraTicketKeys('MTR-123407: Project', 'See AIT2-11063 and MTR-123407 again', 'bad-123'),
  ['MTR-123407', 'AIT2-11063'],
);

console.log('google_slides_analyzer utility checks passed');
