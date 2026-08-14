import { showToast } from './utils';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Preserve message-analysis failures across extension execution contexts.
 * Content pages may show a toast, while MV3 service workers must not touch DOM.
 */
export function reportAndRethrowMessageAnalysisError(error: unknown): never {
  if (typeof document !== 'undefined') {
    showToast(`Error: ${getErrorMessage(error)}`, 'error');
  }
  throw error;
}
