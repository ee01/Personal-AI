const GLIP_NATIVE_POPOUT_BRIDGE_SOURCE = 'personal-ai-glip-native-popout-bridge';
const GLIP_NATIVE_POPOUT_BRIDGE_ATTR = 'data-pai-glip-native-popout-bridge';
const GLIP_NATIVE_POPOUT_REQUEST = 'PAI_GLIP_NATIVE_POPOUT_REQUEST';
const GLIP_NATIVE_POPOUT_RESPONSE = 'PAI_GLIP_NATIVE_POPOUT_RESPONSE';
const GLIP_NATIVE_POPOUT_READY = 'PAI_GLIP_NATIVE_POPOUT_READY';
const GLIP_MESSAGE_TARGET_REQUEST = 'PAI_GLIP_MESSAGE_TARGET_REQUEST';
const GLIP_MESSAGE_TARGET_RESPONSE = 'PAI_GLIP_MESSAGE_TARGET_RESPONSE';
const GLIP_MESSAGE_TARGET_ELEMENT_ATTR = 'data-pai-glip-message-target-id';
const GLIP_NATIVE_POPOUT_MENU_ITEM_SELECTOR =
  '[data-test-automation-id="header-pop-out-conversation"]';
const GLIP_NATIVE_POPOUT_MORE_BUTTON_SELECTOR =
  'button[aria-label*="More actions for this conversation"], [role="button"][aria-label*="More actions for this conversation"]';
const GLIP_NATIVE_POPOUT_WAIT_TIMEOUT_MS = 5000;
const GLIP_NATIVE_POPOUT_WAIT_INTERVAL_MS = 120;

interface GlipNativePopoutRequestPayload {
  groupId: string;
  popOutConversationFirstLevel?: boolean;
}

interface GlipNativePopoutRequestMessage {
  source: string;
  target: 'page';
  type: typeof GLIP_NATIVE_POPOUT_REQUEST;
  requestId: string;
  payload: GlipNativePopoutRequestPayload;
}

interface GlipNativePopoutResponseMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_NATIVE_POPOUT_RESPONSE;
  requestId: string;
  success: boolean;
  error?: string;
}

interface GlipNativePopoutReadyMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_NATIVE_POPOUT_READY;
}

interface GlipMessageTargetRequestMessage {
  source: string;
  target: 'page';
  type: typeof GLIP_MESSAGE_TARGET_REQUEST;
  requestId: string;
  payload: {
    elementId: string;
  };
}

interface GlipMessageTargetResponseMessage {
  source: string;
  target: 'content-script';
  type: typeof GLIP_MESSAGE_TARGET_RESPONSE;
  requestId: string;
  success: boolean;
  payload?: {
    groupId: string;
    postId: string;
    url: string;
  };
  error?: string;
}

interface MenuViewLike {
  props?: {
    popOutConversationFirstLevel?: boolean;
  };
  popOutConversationConfig?: {
    onClick?: (
      eventLike: { nativeEvent: Event },
      groupId: number | string,
      popOutConversationFirstLevel: boolean,
    ) => Promise<unknown> | unknown;
  };
}

interface MenuViewContext {
  menuViewInstance: MenuViewLike;
  moreButton: HTMLElement;
  menuItem: HTMLElement;
}

declare global {
  interface Window {
    __PAI_GLIP_NATIVE_POPOUT_BRIDGE__?: boolean;
  }
}

function setBridgeState(state: 'ready' | 'error') {
  document.documentElement.setAttribute(GLIP_NATIVE_POPOUT_BRIDGE_ATTR, state);
}

function postBridgeMessage(message: GlipNativePopoutResponseMessage | GlipNativePopoutReadyMessage) {
  window.postMessage(message, window.location.origin);
}

function buildGlipMessageUrl(groupId: string, postId: string): string {
  return new URL(
    `/messages/${groupId}/${postId}`,
    window.location.origin,
  ).toString();
}

function isElementVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (!element.isConnected || element.getClientRects().length === 0) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForElement<T extends Element>(
  getter: () => T | null,
  timeout = GLIP_NATIVE_POPOUT_WAIT_TIMEOUT_MS,
  interval = GLIP_NATIVE_POPOUT_WAIT_INTERVAL_MS,
): Promise<T | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = getter();
    if (isElementVisible(element)) {
      return element;
    }
    await delay(interval);
  }

  return null;
}

function getMenuViewInstanceFromMenuItem(menuItem: HTMLElement): MenuViewLike | null {
  const reactFiberKey = Object.keys(menuItem).find(key => key.startsWith('__reactFiber$'));
  if (!reactFiberKey) {
    return null;
  }

  let fiberNode: any = (menuItem as any)[reactFiberKey];
  while (fiberNode) {
    const typeName =
      typeof fiberNode.type === 'string'
        ? fiberNode.type
        : fiberNode.type?.displayName || fiberNode.type?.name || typeof fiberNode.type;

    if (typeName === 'MenuView') {
      return fiberNode.stateNode || null;
    }

    fiberNode = fiberNode.return;
  }

  return null;
}

function isMenuStillOpen(menuItem: HTMLElement): boolean {
  return isElementVisible(menuItem);
}

function dispatchPointerClick(target: Element, clientX: number, clientY: number) {
  const pointerOptions = {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  };

  target.dispatchEvent(new MouseEvent('mousedown', pointerOptions));
  target.dispatchEvent(new MouseEvent('mouseup', pointerOptions));
  target.dispatchEvent(new MouseEvent('click', pointerOptions));
}

function tryClickOutsideMenu(moreButton: HTMLElement, menuItem: HTMLElement): boolean {
  const menuContainer = menuItem.closest<HTMLElement>('[role="menu"]') || menuItem.parentElement || menuItem;
  const candidatePoints = [
    { x: Math.round(window.innerWidth * 0.65), y: Math.round(window.innerHeight * 0.66) },
    { x: Math.round(window.innerWidth * 0.5), y: Math.round(window.innerHeight * 0.6) },
    { x: Math.max(20, Math.round(menuContainer.getBoundingClientRect().left - 32)), y: Math.round(window.innerHeight * 0.5) },
  ];

  for (const point of candidatePoints) {
    const target = document.elementFromPoint(point.x, point.y);
    if (!target) {
      continue;
    }

    if (menuContainer.contains(target) || moreButton.contains(target)) {
      continue;
    }

    dispatchPointerClick(target, point.x, point.y);
    return true;
  }

  return false;
}

async function closeOpenMenu(moreButton: HTMLElement, menuItem: HTMLElement): Promise<void> {
  if (!isMenuStillOpen(menuItem)) {
    return;
  }

  if (tryClickOutsideMenu(moreButton, menuItem)) {
    await delay(80);
  }

  if (!isMenuStillOpen(menuItem)) {
    return;
  }

  await delay(80);

  const escapeOptions = {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  };
  const activeElement = document.activeElement as HTMLElement | null;
  activeElement?.dispatchEvent(new KeyboardEvent('keydown', escapeOptions));
  activeElement?.dispatchEvent(new KeyboardEvent('keyup', escapeOptions));
  document.dispatchEvent(new KeyboardEvent('keydown', escapeOptions));
  document.dispatchEvent(new KeyboardEvent('keyup', escapeOptions));
  await delay(80);

  if (!isMenuStillOpen(menuItem)) {
    return;
  }

  moreButton.click();
  await delay(80);
}

async function getMenuViewContext(): Promise<MenuViewContext> {
  const moreButton = await waitForElement(() =>
    document.querySelector<HTMLElement>(GLIP_NATIVE_POPOUT_MORE_BUTTON_SELECTOR),
  );

  if (!moreButton) {
    throw new Error('glip_popout_more_button_not_found');
  }

  moreButton.click();

  const menuItem = await waitForElement(() =>
    document.querySelector<HTMLElement>(GLIP_NATIVE_POPOUT_MENU_ITEM_SELECTOR),
  );

  if (!menuItem) {
    throw new Error('glip_popout_menu_item_not_found');
  }

  const menuViewInstance = getMenuViewInstanceFromMenuItem(menuItem);
  if (!menuViewInstance?.popOutConversationConfig?.onClick) {
    throw new Error('glip_popout_menu_view_not_found');
  }

  return {
    menuViewInstance,
    moreButton,
    menuItem,
  };
}

function getReactFiberFromElement(element: Element): any | null {
  const reactFiberKey = Object.keys(element).find((key) =>
    key.startsWith('__reactFiber$'),
  );
  if (!reactFiberKey) {
    return null;
  }

  return (element as any)[reactFiberKey] || null;
}

function normalizeNumericIdentifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? trimmed : null;
  }

  return null;
}

function extractForwardedMessageIdsFromQuotedPost(
  quotedPost: Record<string, unknown> | null | undefined,
): { groupId: string; postId: string } | null {
  if (!quotedPost || typeof quotedPost !== 'object') {
    return null;
  }

  const groupId = normalizeNumericIdentifier(
    quotedPost.group_id ?? quotedPost.groupId,
  );
  const postId = normalizeNumericIdentifier(
    quotedPost.post_id ?? quotedPost.postId,
  );
  if (!groupId || !postId) {
    return null;
  }

  return { groupId, postId };
}

function getPostModelFromFiber(fiberNode: any): Record<string, unknown> | null {
  let fiber = fiberNode;
  while (fiber) {
    const post = fiber.memoizedProps?.post;
    if (post && typeof post === 'object') {
      return post;
    }
    fiber = fiber.return;
  }

  return null;
}

function getForwardedMessageQuotedPost(anchor: HTMLAnchorElement): Record<string, unknown> | null {
  const anchorFiber = getReactFiberFromElement(anchor);
  const anchorPostModel = getPostModelFromFiber(anchorFiber);
  if (anchorPostModel?.quotedPost && typeof anchorPostModel.quotedPost === 'object') {
    return anchorPostModel.quotedPost as Record<string, unknown>;
  }

  const conversationCard = anchor.closest<HTMLElement>(
    '.conversation-card-wrapper[data-id]',
  );
  const cardFiber = conversationCard
    ? getReactFiberFromElement(conversationCard)
    : null;
  if (!cardFiber) {
    return null;
  }

  const queue: any[] = [cardFiber];
  const visited = new Set<any>();
  while (queue.length > 0) {
    const currentFiber = queue.shift();
    if (!currentFiber || visited.has(currentFiber)) {
      continue;
    }
    visited.add(currentFiber);

    const post = currentFiber.memoizedProps?.post;
    if (post?.quotedPost && typeof post.quotedPost === 'object') {
      return post.quotedPost as Record<string, unknown>;
    }

    if (currentFiber.child) {
      queue.push(currentFiber.child);
    }
    if (currentFiber.sibling) {
      queue.push(currentFiber.sibling);
    }
  }

  return null;
}

function getForwardedMessageGroupId(anchor: HTMLAnchorElement): string | null {
  const paragraph = anchor.closest('p');
  const mention = paragraph?.querySelector<HTMLSpanElement>(
    'span[role="link"][data-id]',
  );
  const groupId = mention?.dataset.id?.trim();

  return groupId && /^\d+$/.test(groupId) ? groupId : null;
}

async function resolveForwardedMessageTarget(anchor: HTMLAnchorElement): Promise<{
  groupId: string;
  postId: string;
  url: string;
}> {
  const quotedPost = getForwardedMessageQuotedPost(anchor);
  const targetIds = extractForwardedMessageIdsFromQuotedPost(quotedPost);
  const fallbackGroupId = getForwardedMessageGroupId(anchor);
  const groupId = targetIds?.groupId ?? fallbackGroupId;
  const postId = targetIds?.postId ?? null;

  if (!groupId || !postId) {
    throw new Error('glip_message_target_unresolved');
  }

  return {
    groupId,
    postId,
    url: buildGlipMessageUrl(groupId, postId),
  };
}

async function handleNativePopoutRequest(message: GlipNativePopoutRequestMessage) {
  let menuContext: MenuViewContext | null = null;
  try {
    menuContext = await getMenuViewContext();
    const { menuViewInstance } = menuContext;
    const { groupId, popOutConversationFirstLevel } = message.payload;
    const normalizedGroupId = /^\d+$/.test(groupId) ? Number(groupId) : groupId;
    const firstLevel =
      popOutConversationFirstLevel ?? menuViewInstance.props?.popOutConversationFirstLevel ?? false;

    await menuViewInstance.popOutConversationConfig?.onClick?.(
      { nativeEvent: new Event('click') },
      normalizedGroupId,
      firstLevel,
    );

    postBridgeMessage({
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'content-script',
      type: GLIP_NATIVE_POPOUT_RESPONSE,
      requestId: message.requestId,
      success: true,
    });
  } catch (error) {
    postBridgeMessage({
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'content-script',
      type: GLIP_NATIVE_POPOUT_RESPONSE,
      requestId: message.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (menuContext) {
      void closeOpenMenu(menuContext.moreButton, menuContext.menuItem);
    }
  }
}

async function handleMessageTargetRequest(message: GlipMessageTargetRequestMessage) {
  try {
    const selector =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? `[${GLIP_MESSAGE_TARGET_ELEMENT_ATTR}="${CSS.escape(
            message.payload.elementId,
          )}"]`
        : `[${GLIP_MESSAGE_TARGET_ELEMENT_ATTR}="${message.payload.elementId}"]`;
    const anchor = document.querySelector(selector);
    if (!(anchor instanceof HTMLAnchorElement)) {
      throw new Error('glip_message_target_element_not_found');
    }

    const payload = await resolveForwardedMessageTarget(anchor);
    const responseMessage: GlipMessageTargetResponseMessage = {
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'content-script',
      type: GLIP_MESSAGE_TARGET_RESPONSE,
      requestId: message.requestId,
      success: true,
      payload,
    };

    window.postMessage(responseMessage, window.location.origin);
  } catch (error) {
    const responseMessage: GlipMessageTargetResponseMessage = {
      source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
      target: 'content-script',
      type: GLIP_MESSAGE_TARGET_RESPONSE,
      requestId: message.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    window.postMessage(responseMessage, window.location.origin);
  }
}

if (!window.__PAI_GLIP_NATIVE_POPOUT_BRIDGE__) {
  window.__PAI_GLIP_NATIVE_POPOUT_BRIDGE__ = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data as
      | GlipNativePopoutRequestMessage
      | GlipMessageTargetRequestMessage
      | undefined;
    if (
      !message ||
      message.source !== GLIP_NATIVE_POPOUT_BRIDGE_SOURCE ||
      message.target !== 'page'
    ) {
      return;
    }

    if (message.type === GLIP_NATIVE_POPOUT_REQUEST) {
      void handleNativePopoutRequest(message);
      return;
    }

    if (message.type === GLIP_MESSAGE_TARGET_REQUEST) {
      void handleMessageTargetRequest(message);
    }
  });

  setBridgeState('ready');
  postBridgeMessage({
    source: GLIP_NATIVE_POPOUT_BRIDGE_SOURCE,
    target: 'content-script',
    type: GLIP_NATIVE_POPOUT_READY,
  });
}
