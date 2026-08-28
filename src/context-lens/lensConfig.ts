export const CONTEXT_LENS_ENABLED_CONFIG_KEY = 'CONTEXT_LENS_ENABLED';

export const PASSIVE_CONTEXT_LENS_SURFACES = [
  'web_passive',
  'meeting_passive',
  'popup_passive',
  'follow_thread',
] as const;

export type PassiveContextLensSurface =
  (typeof PASSIVE_CONTEXT_LENS_SURFACES)[number];

export type PassiveContextRecallRequestLike = {
  surface?: string | null;
  contextType?: string | null;
};

export function isContextLensEnabledFromConfig(
  config?: Record<string, unknown> | null,
): boolean {
  return config?.[CONTEXT_LENS_ENABLED_CONFIG_KEY] !== false;
}

export function isPassiveContextLensSurface(
  surface?: string | null,
): surface is PassiveContextLensSurface {
  return (
    typeof surface === 'string' &&
    (PASSIVE_CONTEXT_LENS_SURFACES as readonly string[]).includes(surface)
  );
}

/**
 * Per-user Options gate for Memory Lens / passive context recall.
 * Explicit selected-text search stays available when Lens is off, matching
 * site-mute behavior. Compose Assist / other non-passive surfaces are untouched.
 */
export function shouldRequestPassiveContextRecall(
  request?: PassiveContextRecallRequestLike | null,
  config?: Record<string, unknown> | null,
): boolean {
  if (request?.contextType === 'selected_text') {
    return true;
  }
  if (!isPassiveContextLensSurface(request?.surface)) {
    return true;
  }
  return isContextLensEnabledFromConfig(config);
}

export function emptyPassiveContextRecallResponse(): {
  success: true;
  topMatch: null;
  matches: [];
} {
  return { success: true, topMatch: null, matches: [] };
}
