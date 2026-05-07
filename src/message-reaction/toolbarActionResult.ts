export interface ToolbarRuntimeActionResponse {
  success?: boolean;
  error?: string;
}

export function getToolbarRuntimeActionError(
  response: ToolbarRuntimeActionResponse | undefined | null,
  fallbackMessage: string,
): string | null {
  if (response?.success) {
    return null;
  }

  const error = response?.error?.trim();
  return error || fallbackMessage;
}
