import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendAttachmentSummaryToText,
  buildFileItemsMap,
  extractPostFileAttachments,
  formatMessageAttachment,
} from '../metadata/attachments.js';

test('extractPostFileAttachments resolves RingCentral fileItem attachments from post item ids', () => {
  const fileItemsMap = buildFileItemsMap([
    {
      id: 4103924465674,
      name: 'LLM-Scenario-POC.mp4',
      type: 'mp4',
      __size: 70915640,
      creator_id: 1333296857091,
    },
    {
      id: 2002,
      name: 'screenshot.PNG',
      __size: 2048,
    },
    {
      id: 3003,
      name: 'notes.pdf',
      mime_type: 'application/pdf',
    },
    {
      id: 4004,
      name: 'voice-message',
      mimeType: 'audio/mpeg',
    },
  ]);
  const attachments = extractPostFileAttachments(
    {
      id: 80220230991876,
      group_id: 160443817990,
      item_ids: [4103924465674, 2002, 3003, 4004],
      items: [{ id: 4103924465674, type_id: 10 }],
    },
    fileItemsMap,
  );

  assert.deepEqual(
    attachments.map((attachment) => attachment.category),
    ['video', 'image', 'document', 'audio'],
  );
  assert.equal(attachments[0].name, 'LLM-Scenario-POC.mp4');
  assert.equal(attachments[0].size, 70915640);
  assert.equal(
    attachments[0].sourceUrl,
    'https://app.ringcentral.com/messages/160443817990/80220230991876',
  );
  assert.match(formatMessageAttachment(attachments[0]), /link=https:\/\/app\.ringcentral\.com\/messages\/160443817990\/80220230991876/);
  assert.equal(attachments[1].type, undefined);
  assert.equal(attachments[1].category, 'image');
});

test('appendAttachmentSummaryToText keeps file-only messages visible to filtering', () => {
  const attachments = extractPostFileAttachments(
    {
      id: 'post-with-file-only',
      groupId: 'team-1',
      item_ids: [5005],
      items: [{ id: 5005, type_id: 10 }],
    },
    buildFileItemsMap([
      {
        id: 5005,
        name: 'handoff.docx',
        type: 'docx',
      },
    ]),
  );
  const text = appendAttachmentSummaryToText('', attachments);

  assert.match(text, /^\[Attachment 1\] Document: handoff\.docx/);
  assert.match(text, /link=https:\/\/app\.ringcentral\.com\/messages\/team-1\/post-with-file-only/);
  assert.match(formatMessageAttachment(attachments[0]), /Document/);
});

test('extractPostFileAttachments builds direct RingCentral download URLs from full item versions', () => {
  const attachments = extractPostFileAttachments(
    {
      id: 80439921582084,
      group_id: 1463750737922,
      item_ids: [4103941627914],
      items: [{ id: 4103941627914, type_id: 10, company_id: 44466177 }],
    },
    buildFileItemsMap([
      {
        id: 4103941627914,
        name: 'az_recorder_20260527_092549.mp4',
        type: 'mp4',
        __size: 14033215,
        __latest_post_id: 80439921582084,
      },
      {
        id: 4103941627914,
        name: 'az_recorder_20260527_092549.mp4',
        type: 'mp4',
        company_id: 44466177,
        versions: [
          {
            stored_file_id: 7090862645260,
            size: 14033215,
          },
        ],
      },
    ]),
  );

  assert.equal(attachments[0].category, 'video');
  assert.equal(attachments[0].storedFileId, 7090862645260);
  assert.equal(
    attachments[0].messageUrl,
    'https://app.ringcentral.com/messages/1463750737922/80439921582084',
  );
  assert.equal(
    attachments[0].downloadUrl,
    'https://dl.mvp.ringcentral.com/company/44466177/file/4103941627914?stored_file_id=7090862645260&contentDisposition=Attachment',
  );
  assert.equal(attachments[0].sourceUrl, attachments[0].downloadUrl);
  assert.equal(
    attachments[0].previewUrl,
    'https://dl.mvp.ringcentral.com/company/44466177/file/4103941627914?stored_file_id=7090862645260&contentDisposition=Inline',
  );
  assert.match(
    formatMessageAttachment(attachments[0]),
    /link=https:\/\/dl\.mvp\.ringcentral\.com\/company\/44466177\/file\/4103941627914/,
  );
});

test('unknown file item refs are retained only when RingCentral marks them as file attachments', () => {
  const attachments = extractPostFileAttachments(
    {
      item_ids: [6006, 7007],
      items: [
        { id: 6006, type_id: 10 },
        { id: 7007, type_id: 3 },
      ],
    },
    buildFileItemsMap([]),
  );

  assert.deepEqual(attachments, [{ id: 6006, category: 'unknown' }]);
});

test('attachment summary is appended after the original message text', () => {
  const text = appendAttachmentSummaryToText(
    'please review this poc',
    [
      {
        id: '9009',
        name: 'demo.mov',
        type: 'mov',
        category: 'video',
      },
    ],
  );

  assert.equal(
    text,
    'please review this poc\n[Attachment 1] Video: demo.mov (type=mov)',
  );
});
