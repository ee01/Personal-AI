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

test('parseRingCentralVideoJoinTarget canonicalizes native join links', () => {
  const target = parseRingCentralVideoJoinTarget(
    'rcvdt://join/abc%2DDEF_123?foo=bar#speaker',
  );

  assert.deepEqual(target, {
    originalUrl: 'rcvdt://join/abc%2DDEF_123?foo=bar#speaker',
    nativeUrl: 'rcvdt://join/abc-DEF_123?foo=bar#speaker',
    browserUrl:
      'https://v.ringcentral.com/conf/on/abc-DEF_123?foo=bar#speaker',
    meetingId: 'abc-DEF_123',
  });
});

test('parseRingCentralVideoJoinTarget rejects native links with extra path material', () => {
  assert.equal(
    parseRingCentralVideoJoinTarget('rcvdt://join/246810/extra?foo=bar'),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget('rcvdt://join/246810/%2Funsafe'),
    null,
  );
  assert.equal(
    parseRingCentralVideoJoinTarget('rcvdt://meeting/246810?foo=bar'),
    null,
  );
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

test('extractRingCentralVideoJoinUrl handles unicode-escaped URL punctuation', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      '{"joinUrl":"https\\u003a\\u002f\\u002fv.ringcentral.com\\u002flauncher\\u002f123456\\u003fpasscode\\u003dabc\\u0026source\\u003dglip"}',
    ),
    'https://v.ringcentral.com/launcher/123456?passcode=abc&source=glip',
  );
});

test('extractRingCentralVideoJoinUrl unwraps encoded redirect links without leaking wrapper params', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      'https://www.google.com/url?q=https%3A%2F%2Fv.ringcentral.com%2Fjoin%2F123456%3Fpw%3Dsecret%26source%3Demail&sa=D&source=calendar',
    ),
    'https://v.ringcentral.com/join/123456?pw=secret&source=email',
  );

  assert.equal(
    extractRingCentralVideoJoinUrl(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fv.ringcentral.com%2Flauncher%2F987654%3Fpasscode%3Dabc%26utm_source%3Dinvite&data=opaque',
    ),
    'https://v.ringcentral.com/launcher/987654?passcode=abc&utm_source=invite',
  );
});

test('extractRingCentralVideoJoinUrl decodes standalone percent-encoded join URLs', () => {
  assert.equal(
    extractRingCentralVideoJoinUrl(
      'encoded=https%3A%2F%2Fv.ringcentral.com%2Fconf%2Fon%2F246810%3Fpw%3Dsecret',
    ),
    'https://v.ringcentral.com/conf/on/246810?pw=secret',
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

test('openRingCentralVideoNativeJoin keeps browser recovery when app handoff leaves the page active', async () => {
  const originalDocument = (globalThis as typeof globalThis & {
    document?: unknown;
  }).document;
  const originalWindow = (globalThis as typeof globalThis & {
    window?: unknown;
  }).window;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const scheduledTimeouts: Array<{ callback: () => void; delay: number }> = [];
  const clearedTimeouts: number[] = [];
  const elementsById = new Map<string, FakeElement>();
  let copiedText = '';

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
      Array<(event: FakeEvent) => void | Promise<void>>
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

    addEventListener(
      type: string,
      listener: (event: FakeEvent) => void | Promise<void>,
    ) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    async dispatchTestEvent(type: string) {
      const event = {
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        stopImmediatePropagation: () => undefined,
      };
      for (const listener of this.listeners.get(type) || []) {
        await listener(event);
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

  function collectElementText(root: FakeElement | null | undefined): string {
    if (!root) return '';
    return [root.textContent, ...root.children.map(collectElementText)]
      .filter(Boolean)
      .join(' ');
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
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (text: string) => {
          copiedText = String(text || '');
        },
      },
    },
  });

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

    openRingCentralVideoNativeJoin({
      originalUrl: 'https://v.ringcentral.com/join/222222',
      nativeUrl: 'rcvdt://join/222222?passcode=secret',
      browserUrl: 'https://v.ringcentral.com/conf/on/222222?passcode=secret',
      meetingId: '222222',
    });
    assert.deepEqual(
      scheduledTimeouts.map((item) => item.delay),
      [5000, 6000, 10000, 5000, 6000, 10000],
      'replacement fallback should schedule a fresh handoff lifecycle',
    );
    assert.ok(
      clearedTimeouts.includes(1) && clearedTimeouts.includes(2),
      'replacement fallback should clear previous auto-dismiss and escalation timers',
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-launch-link')?.href,
      'rcvdt://join/222222?passcode=secret',
      'replacement fallback should keep the latest native launch link',
    );

    const fallbackHost = elementsById.get(
      'pai-ringcentral-native-join-fallback',
    )!;
    assert.ok(
      fallbackHost.style.cssText.includes(
        'max-height:min(680px,calc(100vh - 36px))',
      ) &&
        fallbackHost.style.cssText.includes('overflow:auto') &&
        fallbackHost.style.cssText.includes('overscroll-behavior:contain'),
      'fallback panel should stay bounded and internally scrollable in short browser windows',
    );
    const title = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-title',
    );
    assert.equal(title?.textContent, 'Opening RingCentral app...');
    const visibleLink = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-visible-link',
    );
    assert.equal(
      visibleLink?.textContent,
      'https://v.ringcentral.com/conf/on/222222',
      'fallback panel should hide passcode-bearing URL details by default',
    );
    assert.equal(
      findElementByText(fallbackHost, 'Handoff receipt'),
      null,
      'fallback panel should omit explanatory handoff copy',
    );
    assert.equal(
      findElementByText(fallbackHost, 'Meeting ID'),
      null,
      'fallback panel should omit manual meeting-ID controls',
    );
    assert.equal(
      findElementByText(fallbackHost, 'Meeting passcode'),
      null,
      'fallback panel should omit passcode controls',
    );

    const closeButton = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-close',
    );
    assert.equal(
      closeButton?.textContent,
      'x',
      'fallback panel should expose a top-right close control',
    );
    assert.equal(
      findElementByText(
        fallbackHost,
        'Dismiss',
      ),
      null,
      'fallback panel should not render a bottom Dismiss button',
    );

    scheduledTimeouts[3].callback();
    assert.ok(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      'native app handoff panel should stay visible when the page is still active',
    );
    assert.equal(
      title?.textContent,
      'RingCentral app did not take over',
      'active page handoff should update the fallback title into recovery copy',
    );
    assert.ok(
      clearedTimeouts.includes(5),
      'manual recovery state should clear the pending handoff escalation timer',
    );
    const retryAppButton = findElementByText(fallbackHost, 'Try app again');
    assert.ok(
      retryAppButton,
      'active page recovery should expose an explicit app retry action',
    );
    assert.ok(
      retryAppButton?.getAttribute('aria-label')?.includes(
        'validated RingCentral app link again',
      ) &&
        retryAppButton?.getAttribute('aria-label')?.includes(
          'does not open the browser fallback',
        ) &&
        retryAppButton?.getAttribute('aria-label')?.includes(
          'cannot confirm whether you joined',
        ) &&
        retryAppButton?.getAttribute('title') ===
          retryAppButton?.getAttribute('aria-label'),
      'app retry button should expose its action boundary at focus and hover time',
    );
    await retryAppButton?.dispatchTestEvent('click');
    assert.equal(
      title?.textContent,
      'Trying RingCentral app again...',
      'app retry should return the panel to a handoff state',
    );
    assert.deepEqual(
      scheduledTimeouts.map((item) => item.delay),
      [5000, 6000, 10000, 5000, 6000, 10000, 5000, 6000, 10000],
      'app retry should schedule a fresh handoff lifecycle',
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-launch-link')?.href,
      'rcvdt://join/222222?passcode=secret',
      'app retry should relaunch the already validated native URL',
    );
    scheduledTimeouts[6].callback();
    assert.equal(
      title?.textContent,
      'RingCentral app did not take over',
      'failed app retry should return to the recovery state when the page stays active',
    );
    const copyLinkButton = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-copy-link',
    );
    const browserButton = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-fallback-link',
    );
    assert.ok(
      browserButton?.getAttribute('aria-label')?.includes(
        'new browser window',
      ) &&
        browserButton?.getAttribute('aria-label')?.includes(
          'including hidden passcode/details',
        ) &&
        browserButton?.getAttribute('aria-label')?.includes(
          'cannot confirm the new window joined',
        ) &&
        browserButton?.getAttribute('aria-label')?.includes(
          'does not retry the app',
        ) &&
        browserButton?.getAttribute('title') ===
          browserButton?.getAttribute('aria-label'),
      'Join in browser should expose a button-level recovery boundary',
    );
    assert.ok(
      copyLinkButton?.getAttribute('aria-label')?.includes(
        'full RingCentral browser meeting link',
      ) &&
        copyLinkButton?.getAttribute('aria-label')?.includes(
          'including hidden passcode/details',
        ) &&
        copyLinkButton?.getAttribute('aria-label')?.includes(
          'does not join the meeting',
        ) &&
        copyLinkButton?.getAttribute('title') ===
          copyLinkButton?.getAttribute('aria-label'),
      'Copy link should expose a button-level copy boundary',
    );
    await copyLinkButton?.dispatchTestEvent('click');
    assert.equal(
      copiedText,
      'https://v.ringcentral.com/conf/on/222222?passcode=secret',
      'copy link should copy the full browser recovery link, not the hidden display URL',
    );

    const defaultPreferenceButton = findElementByAttribute(
      fallbackHost,
      'data-pai-ringcentral-native-join-prefer-browser',
    );
    await defaultPreferenceButton?.dispatchTestEvent('click');
    assert.equal(
      defaultPreferenceButton?.textContent,
      'Use browser by default',
      'failed default save should keep the visible preference action unchanged',
    );

    await closeButton?.dispatchTestEvent('click');
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-fallback'),
      undefined,
      'top-right close control should remove the native handoff panel',
    );
    const dismissedRecovery = elementsById.get(
      'pai-ringcentral-native-join-dismissed-recovery',
    );
    assert.ok(
      dismissedRecovery,
      'closing the handoff panel should leave a compact recovery affordance',
    );
    assert.ok(
      collectElementText(dismissedRecovery).includes(
        'RingCentral handoff hidden',
      ) &&
        collectElementText(dismissedRecovery).includes('No join was confirmed') &&
        collectElementText(dismissedRecovery).includes(
          'default path is unchanged',
        ) &&
        collectElementText(dismissedRecovery).includes('Restore recovery'),
      'dismissed recovery strip should preserve the unconfirmed handoff boundary',
    );
    assert.deepEqual(
      scheduledTimeouts.map((item) => item.delay),
      [
        5000, 6000, 10000, 5000, 6000, 10000, 5000, 6000, 10000, 12000,
      ],
      'dismissed recovery strip should use a short bounded lifetime',
    );
    const restoreRecoveryButton = findElementByAttribute(
      dismissedRecovery!,
      'data-pai-ringcentral-native-join-restore-recovery',
    );
    await restoreRecoveryButton?.dispatchTestEvent('click');
    const restoredFallback = elementsById.get(
      'pai-ringcentral-native-join-fallback',
    );
    assert.ok(
      restoredFallback,
      'Restore recovery should rebuild the full browser recovery panel',
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-dismissed-recovery'),
      undefined,
      'restoring the full panel should clear the compact recovery strip',
    );
    assert.equal(
      elementsById.get('pai-ringcentral-native-join-launch-link'),
      undefined,
      'restoring recovery controls should not relaunch the native app',
    );
    assert.equal(
      findElementByAttribute(
        restoredFallback,
        'data-pai-ringcentral-native-join-title',
      )?.textContent,
      'RingCentral recovery restored',
      'restored recovery should retain only its title and controls',
    );
    assert.ok(
      findElementByText(restoredFallback, 'Try app again'),
      'restored recovery should retain the app retry control',
    );

    pageVisibilityState = 'hidden';
    pageHasFocus = false;
    openRingCentralVideoNativeJoin({
      originalUrl: 'https://v.ringcentral.com/join/123456',
      nativeUrl: 'rcvdt://join/123456',
      browserUrl: 'https://v.ringcentral.com/conf/on/123456',
      meetingId: '123456',
    });

    const hiddenPageAutoDismissTimer =
      scheduledTimeouts[scheduledTimeouts.length - 3];
    assert.equal(
      hiddenPageAutoDismissTimer?.delay,
      5000,
      'hidden page handoff should schedule an auto-dismiss timer',
    );
    hiddenPageAutoDismissTimer.callback();
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

    if (originalNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        originalNavigatorDescriptor,
      );
    } else {
      delete (globalThis as typeof globalThis & { navigator?: unknown })
        .navigator;
    }
  }
});
