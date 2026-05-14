import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractRingCentralVideoJoinUrl,
  openRingCentralVideoNativeJoin,
  parseRingCentralVideoJoinTarget,
  shouldPreserveDefaultNativeJoinClick,
} from '../ringcentralNativeJoin.js';

test('parseRingCentralVideoJoinTarget converts RingCentral web join links to native links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/conf/on/123456?foo=bar#speaker',
  );

  assert.deepEqual(target, {
    originalUrl: 'https://v.ringcentral.com/conf/on/123456?foo=bar#speaker',
    nativeUrl: 'rcvdt://join/123456?foo=bar#speaker',
    browserUrl: 'https://v.ringcentral.com/conf/on/123456?foo=bar#speaker',
    meetingId: '123456',
  });
});

test('parseRingCentralVideoJoinTarget uses direct browser join for launcher links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/join/123456?foo=bar#speaker',
  );

  assert.deepEqual(target, {
    originalUrl: 'https://v.ringcentral.com/join/123456?foo=bar#speaker',
    nativeUrl: 'rcvdt://join/123456?foo=bar#speaker',
    browserUrl: 'https://v.ringcentral.com/conf/on/123456?foo=bar#speaker',
    meetingId: '123456',
  });
});

test('parseRingCentralVideoJoinTarget upgrades insecure RingCentral browser fallback to https', () => {
  const target = parseRingCentralVideoJoinTarget(
    'http://v.ringcentral.com/join/123456?foo=bar#speaker',
  );

  assert.deepEqual(target, {
    originalUrl: 'http://v.ringcentral.com/join/123456?foo=bar#speaker',
    nativeUrl: 'rcvdt://join/123456?foo=bar#speaker',
    browserUrl: 'https://v.ringcentral.com/conf/on/123456?foo=bar#speaker',
    meetingId: '123456',
  });
});

test('parseRingCentralVideoJoinTarget rejects non-browser protocols on RingCentral host', () => {
  assert.equal(
    parseRingCentralVideoJoinTarget('ftp://v.ringcentral.com/join/123456'),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget('file://v.ringcentral.com/join/123456'),
    null,
  );
});

test('parseRingCentralVideoJoinTarget is safe to call outside a browser', () => {
  assert.equal(typeof window, 'undefined');

  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/join/987654',
  );

  assert.equal(target?.nativeUrl, 'rcvdt://join/987654');
});

test('parseRingCentralVideoJoinTarget preserves native join links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'rcvdt://join/246810?foo=bar',
  );

  assert.deepEqual(target, {
    originalUrl: 'rcvdt://join/246810?foo=bar',
    nativeUrl: 'rcvdt://join/246810?foo=bar',
    browserUrl: 'https://v.ringcentral.com/conf/on/246810?foo=bar',
    meetingId: '246810',
  });
});

test('parseRingCentralVideoJoinTarget builds browser fallback for native links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'rcvdt://join/246810?foo=bar#speaker',
  );

  assert.equal(
    target?.browserUrl,
    'https://v.ringcentral.com/conf/on/246810?foo=bar#speaker',
  );
});

test('extractRingCentralVideoJoinUrl strips common markup punctuation', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      '{"joinUrl":"https://v.ringcentral.com/join/123456"}',
    ),
    'https://v.ringcentral.com/join/123456',
  );

  assert.equal(
    extractRingCentralVideoJoinUrl(
      '(https://v.ringcentral.com/conf/on/987654?passcode=abc&amp;source=glip)',
    ),
    'https://v.ringcentral.com/conf/on/987654?passcode=abc&source=glip',
  );
});

test('extractRingCentralVideoJoinUrl ignores non-RingCentral hosts', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      'https://v.ringcentral.com.evil.test/join/123456',
    ),
    null,
  );
});

test('shouldPreserveDefaultNativeJoinClick keeps modified and fallback-link clicks untouched', () => {
  const regularClick = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
  } as MouseEvent;

  const metaClick = {
    ...regularClick,
    metaKey: true,
  } as MouseEvent;

  assert.equal(shouldPreserveDefaultNativeJoinClick(regularClick), false);
  assert.equal(shouldPreserveDefaultNativeJoinClick(metaClick), true);

  const originalElement = (globalThis as typeof globalThis & {
    Element?: unknown;
  }).Element;
  class TestElement {
    closest(selector: string) {
      return selector === '[data-pai-ringcentral-native-join-fallback-link]'
        ? {}
        : null;
    }
  }
  (globalThis as typeof globalThis & { Element?: unknown }).Element =
    TestElement;

  try {
    const fallbackClick = {
      ...regularClick,
      target: new TestElement(),
    } as MouseEvent;
    assert.equal(shouldPreserveDefaultNativeJoinClick(fallbackClick), true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as typeof globalThis & { Element?: unknown }).Element;
    } else {
      (globalThis as typeof globalThis & { Element?: unknown }).Element =
        originalElement;
    }
  }
});

test('openRingCentralVideoNativeJoin keeps browser fallback available until dismissed', () => {
  const originalDocument = (globalThis as typeof globalThis & {
    document?: unknown;
  }).document;
  const originalWindow = (globalThis as typeof globalThis & {
    window?: unknown;
  }).window;
  const timeoutDelays: number[] = [];
  const elementsById = new Map<string, FakeElement>();

  class FakeElement {
    public id = '';
    public href = '';
    public target = '';
    public rel = '';
    public type = '';
    public textContent = '';
    public tabIndex = 0;
    public parent: FakeElement | null = null;
    public children: FakeElement[] = [];
    public attributes = new Map<string, string>();
    public style = { cssText: '', display: '' };

    constructor(public readonly tagName: string) {}

    appendChild(child: FakeElement) {
      child.parent = this;
      this.children.push(child);
      if (child.id) {
        elementsById.set(child.id, child);
      }
      return child;
    }

    remove() {
      if (this.id) {
        elementsById.delete(this.id);
      }
      if (this.parent) {
        this.parent.children = this.parent.children.filter(
          (child) => child !== this,
        );
      }
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }

    addEventListener() {
      return undefined;
    }

    click() {
      return undefined;
    }
  }

  const body = new FakeElement('body');
  (globalThis as typeof globalThis & { document?: unknown }).document = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    getElementById: (id: string) => elementsById.get(id) || null,
  };
  (globalThis as typeof globalThis & { window?: unknown }).window = {
    location: {
      assign: () => undefined,
    },
    open: () => null,
    setTimeout: (_callback: () => void, delay: number) => {
      timeoutDelays.push(delay);
      return timeoutDelays.length;
    },
  };

  try {
    openRingCentralVideoNativeJoin({
      originalUrl: 'https://v.ringcentral.com/join/123456',
      nativeUrl: 'rcvdt://join/123456',
      browserUrl: 'https://v.ringcentral.com/join/123456',
      meetingId: '123456',
    });

    assert.ok(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      'fallback panel should be mounted',
    );
    assert.deepEqual(timeoutDelays, [10000]);
  } finally {
    if (originalDocument === undefined) {
      delete (globalThis as typeof globalThis & { document?: unknown })
        .document;
    } else {
      (globalThis as typeof globalThis & { document?: unknown }).document =
        originalDocument;
    }

    if (originalWindow === undefined) {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    } else {
      (globalThis as typeof globalThis & { window?: unknown }).window =
        originalWindow;
    }
  }
});
