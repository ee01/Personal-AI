import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractRingCentralVideoJoinUrl,
  openRingCentralVideoNativeJoin,
  parseRingCentralVideoJoinTarget,
  RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR,
  RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE,
  RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST,
  RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE,
  setRingCentralNativeJoinEnabled,
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

test('parseRingCentralVideoJoinTarget uses direct browser join for join links', () => {
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

test('parseRingCentralVideoJoinTarget uses direct browser join for launcher links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/launcher/123456?foo=bar#speaker',
  );

  assert.deepEqual(target, {
    originalUrl:
      'https://v.ringcentral.com/launcher/123456?foo=bar#speaker',
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

test('parseRingCentralVideoJoinTarget accepts safe alphanumeric meeting ids', () => {
  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/join/abc-DEF_123?pw=secret',
  );

  assert.deepEqual(target, {
    originalUrl: 'https://v.ringcentral.com/join/abc-DEF_123?pw=secret',
    nativeUrl: 'rcvdt://join/abc-DEF_123?pw=secret',
    browserUrl: 'https://v.ringcentral.com/conf/on/abc-DEF_123?pw=secret',
    meetingId: 'abc-DEF_123',
  });
});

test('parseRingCentralVideoJoinTarget accepts vanity meeting aliases with dots', () => {
  const target = parseRingCentralVideoJoinTarget(
    'https://v.ringcentral.com/join/fnoz.lu?pw=secret',
  );

  assert.deepEqual(target, {
    originalUrl: 'https://v.ringcentral.com/join/fnoz.lu?pw=secret',
    nativeUrl: 'rcvdt://join/fnoz.lu?pw=secret',
    browserUrl: 'https://v.ringcentral.com/conf/on/fnoz.lu?pw=secret',
    meetingId: 'fnoz.lu',
  });
});

test('parseRingCentralVideoJoinTarget rejects unsafe encoded meeting ids', () => {
  assert.equal(
    parseRingCentralVideoJoinTarget(
      'https://v.ringcentral.com/join/%2F123456?pw=secret',
    ),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget(
      'https://v.ringcentral.com/join/fnoz..lu?pw=secret',
    ),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget(
      'https://v.ringcentral.com/join/.fnoz?pw=secret',
    ),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget('rcvdt://join/123%0A456?pw=secret'),
    null,
  );
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

  assert.equal(
    extractRingCentralVideoJoinUrl(
      '<a href="https://v.ringcentral.com/launcher/246810?passcode=abc">Join</a>',
    ),
    'https://v.ringcentral.com/launcher/246810?passcode=abc',
  );
});

test('extractRingCentralVideoJoinUrl handles escaped JSON slash forms', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      '{"joinUrl":"https:\\/\\/v.ringcentral.com\\/join\\/123456?passcode=abc"}',
    ),
    'https://v.ringcentral.com/join/123456?passcode=abc',
  );

  assert.equal(
    extractRingCentralVideoJoinUrl(
      '{"joinUrl":"https:\\u002f\\u002fv.ringcentral.com\\u002fconf\\u002fon\\u002f987654"}',
    ),
    'https://v.ringcentral.com/conf/on/987654',
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
      return selector.includes(this.matchingSelector)
        ? {}
        : null;
    }

    constructor(private readonly matchingSelector: string) {}
  }
  (globalThis as typeof globalThis & { Element?: unknown }).Element =
    TestElement;

  try {
    const fallbackClick = {
      ...regularClick,
      target: new TestElement(
        '[data-pai-ringcentral-native-join-fallback-link]',
      ),
    } as MouseEvent;
    assert.equal(shouldPreserveDefaultNativeJoinClick(fallbackClick), true);

    const closeClick = {
      ...regularClick,
      target: new TestElement('[data-pai-ringcentral-native-join-close]'),
    } as MouseEvent;
    assert.equal(shouldPreserveDefaultNativeJoinClick(closeClick), true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as typeof globalThis & { Element?: unknown }).Element;
    } else {
      (globalThis as typeof globalThis & { Element?: unknown }).Element =
        originalElement;
    }
  }
});

test('setRingCentralNativeJoinEnabled uses a page bridge when chrome storage is unavailable', async () => {
  const originalChrome = (globalThis as typeof globalThis & {
    chrome?: unknown;
  }).chrome;
  const originalDocument = (globalThis as typeof globalThis & {
    document?: unknown;
  }).document;
  const originalWindow = (globalThis as typeof globalThis & {
    window?: unknown;
  }).window;
  const attributes = new Map<string, string>();
  const postedMessages: Array<{ message: any; targetOrigin: string }> = [];
  const messageListeners = new Set<(event: MessageEvent) => void>();

  const fakeWindow = {
    location: { origin: 'https://app.ringcentral.com' },
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') {
        messageListeners.add(listener);
      }
    },
    removeEventListener: (
      type: string,
      listener: (event: MessageEvent) => void,
    ) => {
      if (type === 'message') {
        messageListeners.delete(listener);
      }
    },
    postMessage: (message: any, targetOrigin: string) => {
      postedMessages.push({ message, targetOrigin });
      if (message?.type !== RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST) {
        return;
      }
      const response = {
        source: RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE,
        target: 'page',
        type: RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE,
        requestId: message.requestId,
        success: true,
        enabled: message.enabled,
      };
      const listeners = Array.from(messageListeners);
      for (const listener of listeners) {
        listener({
          source: fakeWindow,
          data: response,
        } as MessageEvent);
      }
    },
    setTimeout: (callback: () => void, delay: number) =>
      setTimeout(callback, delay) as unknown as number,
    clearTimeout: (timerId: number) =>
      clearTimeout(timerId as unknown as ReturnType<typeof setTimeout>),
  };

  (globalThis as typeof globalThis & { chrome?: unknown }).chrome = undefined;
  (globalThis as typeof globalThis & { document?: unknown }).document = {
    documentElement: {
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
      getAttribute: (name: string) => attributes.get(name) || null,
    },
  };
  (globalThis as typeof globalThis & { window?: unknown }).window = fakeWindow;

  try {
    await setRingCentralNativeJoinEnabled(false);

    assert.equal(attributes.get(RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR), 'false');
    assert.equal(postedMessages.length, 1);
    assert.equal(
      postedMessages[0].message.source,
      RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE,
    );
    assert.equal(
      postedMessages[0].message.type,
      RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST,
    );
    assert.equal(postedMessages[0].message.enabled, false);
    assert.equal(postedMessages[0].targetOrigin, 'https://app.ringcentral.com');
    assert.equal(messageListeners.size, 0);
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
    } else {
      (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
        originalChrome;
    }

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

test('openRingCentralVideoNativeJoin keeps browser recovery when app handoff leaves the page active', () => {
  const originalDocument = (globalThis as typeof globalThis & {
    document?: unknown;
  }).document;
  const originalWindow = (globalThis as typeof globalThis & {
    window?: unknown;
  }).window;
  const scheduledTimeouts: Array<{ callback: () => void; delay: number }> = [];
  const clearedTimeouts: number[] = [];
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
    public listeners = new Map<
      string,
      Array<(event: FakeEvent) => void>
    >();
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

    getAttribute(name: string) {
      return this.attributes.get(name) || null;
    }

    addEventListener(type: string, listener: (event: FakeEvent) => void) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    dispatchTestEvent(type: string) {
      const event = {
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        stopImmediatePropagation: () => undefined,
      };
      for (const listener of this.listeners.get(type) || []) {
        listener(event);
      }
    }

    contains(element: FakeElement | null) {
      if (!element) return false;
      if (element === this) return true;
      return this.children.some((child) => child.contains(element));
    }

    click() {
      return undefined;
    }
  }

  interface FakeEvent {
    preventDefault: () => void;
    stopPropagation: () => void;
    stopImmediatePropagation: () => void;
  }

  function findElementByAttribute(
    root: FakeElement,
    name: string,
  ): FakeElement | null {
    if (root.attributes.has(name)) {
      return root;
    }
    for (const child of root.children) {
      const match = findElementByAttribute(child, name);
      if (match) {
        return match;
      }
    }
    return null;
  }

  function findElementByText(
    root: FakeElement,
    text: string,
  ): FakeElement | null {
    if (root.textContent === text) {
      return root;
    }
    for (const child of root.children) {
      const match = findElementByText(child, text);
      if (match) {
        return match;
      }
    }
    return null;
  }

  const body = new FakeElement('body');
  const documentElement = new FakeElement('html');
  let pageVisibilityState: 'visible' | 'hidden' = 'visible';
  let pageHasFocus = true;
  (globalThis as typeof globalThis & { document?: unknown }).document = {
    body,
    documentElement,
    get visibilityState() {
      return pageVisibilityState;
    },
    hasFocus: () => pageHasFocus,
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => {
      const node = new FakeElement('#text');
      node.textContent = text;
      return node;
    },
    getElementById: (id: string) => elementsById.get(id) || null,
  };
  (globalThis as typeof globalThis & { window?: unknown }).window = {
    location: {
      assign: () => undefined,
    },
    open: () => null,
    setTimeout: (callback: () => void, delay: number) => {
      scheduledTimeouts.push({ callback, delay });
      return scheduledTimeouts.length;
    },
    clearTimeout: (timerId: number) => {
      clearedTimeouts.push(timerId);
    },
  };

  try {
    openRingCentralVideoNativeJoin({
      originalUrl: 'https://v.ringcentral.com/join/123456',
      nativeUrl: 'rcvdt://join/123456',
      browserUrl: 'https://v.ringcentral.com/conf/on/123456',
      meetingId: '123456',
    });

    assert.ok(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      'fallback panel should be mounted',
    );
    assert.deepEqual(
      scheduledTimeouts.map((item) => item.delay),
      [5000, 6000, 10000],
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-launch-link')?.href,
      'rcvdt://join/123456',
      'native protocol should be launched from a top-level link click',
    );

    const status = findElementByAttribute(
      elementsById.get('pai-ringcentral-native-join-fallback')!,
      'data-pai-ringcentral-native-join-status',
    );
    assert.equal(status?.textContent, 'Meeting 123456');
    const visibleLink = findElementByAttribute(
      elementsById.get('pai-ringcentral-native-join-fallback')!,
      'data-pai-ringcentral-native-join-visible-link',
    );
    assert.equal(
      visibleLink?.textContent,
      'https://v.ringcentral.com/conf/on/123456',
      'fallback panel should show a direct browser meeting link for manual recovery',
    );

    const closeButton = findElementByAttribute(
      elementsById.get('pai-ringcentral-native-join-fallback')!,
      'data-pai-ringcentral-native-join-close',
    );
    assert.equal(
      closeButton?.textContent,
      'x',
      'fallback panel should expose a top-right close control',
    );
    assert.equal(
      findElementByText(
        elementsById.get('pai-ringcentral-native-join-fallback')!,
        'Dismiss',
      ),
      null,
      'fallback panel should not render a bottom Dismiss button',
    );

    scheduledTimeouts[0].callback();
    assert.ok(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      'native app handoff panel should stay visible when the page is still active',
    );
    assert.equal(
      status?.textContent,
      'Still on this page? RingCentral app may not have opened. Use Join in browser or Copy link.',
      'active page handoff should become an explicit recovery state',
    );
    assert.ok(
      clearedTimeouts.includes(2),
      'manual recovery state should clear the pending handoff escalation timer',
    );

    closeButton?.dispatchTestEvent('click');
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      undefined,
      'top-right close control should remove the native handoff panel',
    );

    pageVisibilityState = 'hidden';
    pageHasFocus = false;
    openRingCentralVideoNativeJoin({
      originalUrl: 'https://v.ringcentral.com/join/123456',
      nativeUrl: 'rcvdt://join/123456',
      browserUrl: 'https://v.ringcentral.com/conf/on/123456',
      meetingId: '123456',
    });

    scheduledTimeouts[3].callback();
    assert.ok(
      !elementsById.get('pai-ringcentral-native-join-fallback'),
      'native app handoff panel should auto-dismiss when the page is no longer active',
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-launch-link'),
      undefined,
      'auto-dismiss should remove the temporary native launch link',
    );
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
