export const ENV_CONFIG_KEY = 'envConfig';
export const CONTEXT_ASSIST_ENABLED_CONFIG_KEY = 'CONTEXT_ASSIST_ENABLED';
export const COMPOSE_ASSIST_ENABLED_CONFIG_KEY = 'COMPOSE_ASSIST_ENABLED';
export const CONFIDENCE_THRESHOLD_CONFIG_KEY =
  'COMPOSER_GUARD_CONFIDENCE_THRESHOLD';
export const SURFACE_THRESHOLDS_CONFIG_KEY =
  'COMPOSER_GUARD_SURFACE_CONFIDENCE_THRESHOLDS';

export function isComposerAssistEnabledFromConfig(
  config?: Record<string, unknown> | null,
): boolean {
  return (
    config?.[CONTEXT_ASSIST_ENABLED_CONFIG_KEY] !== false &&
    config?.[COMPOSE_ASSIST_ENABLED_CONFIG_KEY] !== false
  );
}
