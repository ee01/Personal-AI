export const ENV_CONFIG_KEY = 'envConfig';
export const CONTEXT_ASSIST_ENABLED_CONFIG_KEY = 'CONTEXT_ASSIST_ENABLED';
export const COMPOSE_ASSIST_ENABLED_CONFIG_KEY = 'COMPOSE_ASSIST_ENABLED';
export const COMPOSE_DRAFT_ENABLED_CONFIG_KEY = 'COMPOSE_DRAFT_ENABLED';
export const COMPOSE_REFINE_ENABLED_CONFIG_KEY = 'COMPOSE_REFINE_ENABLED';
export const CONFIDENCE_THRESHOLD_CONFIG_KEY =
  'COMPOSER_GUARD_CONFIDENCE_THRESHOLD';
export const SURFACE_THRESHOLDS_CONFIG_KEY =
  'COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS';

export type ComposerAssistIntent = 'draft_compose' | 'draft_refine';

export function isComposerAssistEnabledFromConfig(
  config?: Record<string, unknown> | null,
): boolean {
  return (
    config?.[CONTEXT_ASSIST_ENABLED_CONFIG_KEY] !== false &&
    config?.[COMPOSE_ASSIST_ENABLED_CONFIG_KEY] !== false
  );
}

export function isComposerDraftComposeEnabledFromConfig(
  config?: Record<string, unknown> | null,
): boolean {
  return (
    isComposerAssistEnabledFromConfig(config) &&
    config?.[COMPOSE_DRAFT_ENABLED_CONFIG_KEY] !== false
  );
}

export function isComposerDraftRefineEnabledFromConfig(
  config?: Record<string, unknown> | null,
): boolean {
  return (
    isComposerAssistEnabledFromConfig(config) &&
    config?.[COMPOSE_REFINE_ENABLED_CONFIG_KEY] !== false
  );
}

export function isComposerAssistIntentEnabledFromConfig(
  intent: ComposerAssistIntent,
  config?: Record<string, unknown> | null,
): boolean {
  return intent === 'draft_compose'
    ? isComposerDraftComposeEnabledFromConfig(config)
    : isComposerDraftRefineEnabledFromConfig(config);
}
