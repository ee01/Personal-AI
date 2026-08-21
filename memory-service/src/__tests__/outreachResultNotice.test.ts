import { describe, expect, it } from 'vitest';

import {
  buildGlipMessageUrl,
  buildOutreachContinueMarker,
  buildOutreachResultNotice,
  collectFollowupMessageRefs,
  normalizeContinueFollowupInput,
  parseOutreachContinueSessionId,
} from '../core/outreachResultNotice.js';

describe('outreachResultNotice', () => {
  it('builds a resolved receipt that reports no follow-up and a continue marker', () => {
    const notice = buildOutreachResultNotice({
      status: 'resolved',
      sessionId: 'f1ed8986-c549-4922-96d0-1ba362fbf14d',
      targetLabel: 'INIT-30072',
      question: 'Do we have a UX ticket?',
      summary: '对方转而询问技术方案。',
      followupCount: 0,
      originalChatId: 'chat-1',
      originalPostId: 'post-1',
    });

    expect(notice.title).toBe('主动询问结果');
    expect(notice.body).toContain('追问：未发生');
    expect(notice.body).not.toContain('查看追问消息：');
    expect(notice.body).toContain(
      '原询问：https://app.ringcentral.com/messages/chat-1/post-1',
    );
    expect(notice.body).toContain(
      'pai-outreach-continue:f1ed8986-c549-4922-96d0-1ba362fbf14d',
    );
    expect(notice.body).toContain('继续追问：');
  });

  it('builds a timeout receipt with a jump link to the latest follow-up', () => {
    const notice = buildOutreachResultNotice({
      status: 'no_reply',
      sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      question: 'Need the UX ticket',
      summary: '已达到等待与追问上限，仍未收到有效回复。',
      followupCount: 1,
      followupMessages: [
        { chatId: 'chat-9', postId: 'post-old' },
        { chatId: 'chat-9', postId: 'post-new' },
      ],
    });

    expect(notice.title).toBe('主动询问超时');
    expect(notice.body).toContain('追问：已发生 2 次');
    expect(notice.body).toContain(
      '查看追问消息：https://app.ringcentral.com/messages/chat-9/post-new',
    );
  });

  it('parses follow-up events and continue markers', () => {
    expect(
      collectFollowupMessageRefs([
        { eventType: 'created' },
        {
          eventType: 'followup_sent',
          payload: { chatId: 'c1', postId: 'p1' },
        },
      ]),
    ).toEqual([{ chatId: 'c1', postId: 'p1' }]);
    expect(buildGlipMessageUrl('c1', 'p1')).toBe(
      'https://app.ringcentral.com/messages/c1/p1',
    );
    expect(
      parseOutreachContinueSessionId(
        `hello\n${buildOutreachContinueMarker('f1ed8986-c549-4922-96d0-1ba362fbf14d')}`,
      ),
    ).toBe('f1ed8986-c549-4922-96d0-1ba362fbf14d');
  });

  it('clamps continue follow-up count and interval', () => {
    expect(
      normalizeContinueFollowupInput({
        maxFollowup: 0,
        followupIntervalSeconds: 10,
      }),
    ).toEqual({ maxFollowup: 1, followupIntervalSeconds: 3600 });
    expect(
      normalizeContinueFollowupInput({
        maxFollowup: 99,
        followupIntervalSeconds: 99999999,
      }),
    ).toEqual({ maxFollowup: 10, followupIntervalSeconds: 720 * 3600 });
  });
});
