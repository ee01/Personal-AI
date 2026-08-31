import { describe, expect, it } from 'vitest';

import {
  authorValuesMatchOwner,
  extractPrimaryAddressees,
  resolveComposerReplyTarget,
} from '../core/composerReplyTarget.js';

const identity = {
  names: ['esone qiu', 'esone', 'qiu'],
  stopwords: new Set(['esone qiu', 'esone', 'qiu']),
};

describe('extractPrimaryAddressees', () => {
  it('reads paired names after Hi and ignores CC', () => {
    expect(
      extractPrimaryAddressees(
        'Hi Alexander Krotov Venky Iyer Attached is the JVD 26.3.30 feature scope. Please let me know if you have any questions. Thanks,CC Chang He Allen Wang Vita Huang Nicole Zheng',
      ),
    ).toEqual(['Alexander Krotov', 'Venky Iyer']);
  });

  it('reads a vocative after BTW', () => {
    expect(
      extractPrimaryAddressees(
        'BTW, Venky Iyer it is time to start to prepare the wishlist for Q4. The teams will start to do quarterly planning by late this month.',
      ),
    ).toEqual(['Venky Iyer']);
  });
});

describe('resolveComposerReplyTarget', () => {
  it('does not draft a reply to a group message named to other people', () => {
    const result = resolveComposerReplyTarget(
      {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        contextItems: [
          {
            type: 'message',
            text: 'BTW, Venky Iyer it is time to start to prepare the wishlist for Q4.',
            metadata: { isSelf: false },
          },
          {
            type: 'message',
            sender: 'Fred Gu',
            text: 'Hi Alexander Krotov Venky Iyer Attached is the JVD 26.3.30 feature scope. Please let me know if you have any questions. Thanks,CC Chang He Allen Wang',
            metadata: { isSelf: false },
          },
        ],
      },
      identity,
    );
    expect(result.state).toBe('not_addressed');
    expect(result.addressees).toEqual(['Alexander Krotov', 'Venky Iyer']);
  });

  it('still drafts when the latest incoming message names the owner', () => {
    const result = resolveComposerReplyTarget(
      {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        contextItems: [
          {
            type: 'message',
            sender: 'Fred Gu',
            text: 'Hi Esone Qiu, can you review the JVD scope?',
          },
        ],
      },
      identity,
    );
    expect(result.state).toBe('addressed');
  });

  it('keeps unnamed questions as replyable', () => {
    const result = resolveComposerReplyTarget(
      {
        surface: 'ringcentral_message',
        contextType: 'message_thread',
        contextItems: [
          {
            type: 'message',
            sender: 'Fred Gu',
            text: 'Capacity Management poster 这期怎么处理？',
          },
        ],
      },
      identity,
    );
    expect(result.state).toBe('addressed');
    expect(result.reason).toBe('no_named_addressee');
  });

  it('treats the owner message as self even when isSelf is missing', () => {
    const result = resolveComposerReplyTarget(
      {
        surface: 'ringcentral_thread',
        contextType: 'message_thread',
        contextItems: [
          {
            type: 'thread_reply',
            sender: 'Venky Iyer',
            text: 'Esone Qiu Let’s also demo this tool in the Weekly Sync Meeting for a wider audience?',
            metadata: { isSelf: false },
          },
          {
            type: 'thread_reply',
            sender: 'Esone Qiu',
            text: 'Venky Iyer Absolutely, NC Switcher is a great productivity booster. I’ll loop the demo in our weekly.',
            metadata: { isSelf: false },
          },
        ],
      },
      identity,
    );
    expect(result.state).toBe('addressed');
    expect(result.incomingText).toMatch(/also demo this tool/);
  });
});

describe('authorValuesMatchOwner', () => {
  it('matches compact userId to display name and does not match another Qiu', () => {
    expect(authorValuesMatchOwner(['Esone Qiu'], identity)).toBe(true);
    expect(authorValuesMatchOwner(['Alice Qiu'], identity)).toBe(false);
  });
});
