/**
 * Content-script → background bridge for memory-service calls made from a
 * Roadmap host page. Content-script fetch is subject to the host page's CORS
 * policy; the service worker is not.
 */

export const ROADMAP_MEMORY_REQUEST = 'ROADMAP_MEMORY_REQUEST';

export type RoadmapMemoryMethod =
  | 'getMemoryProjectCandidates'
  | 'getProjectDriftReceipts'
  | 'resolveProjectDriftReceipt'
  | 'syncFocusProjects'
  | 'getRuntimeConfig'
  | 'getAgentTaskRuntimeStatus'
  | 'executeAgentTask';

export type RoadmapMemoryRequest = {
  type: typeof ROADMAP_MEMORY_REQUEST;
  method: RoadmapMemoryMethod;
  args?: unknown[];
};

export type RoadmapMemoryResponse =
  | { success: true; data: unknown }
  | { success: false; error: string };

export async function roadmapMemoryCall<T>(
  method: RoadmapMemoryMethod,
  ...args: unknown[]
): Promise<T> {
  const result = (await chrome.runtime.sendMessage({
    type: ROADMAP_MEMORY_REQUEST,
    method,
    args,
  } satisfies RoadmapMemoryRequest)) as RoadmapMemoryResponse | undefined;

  if (!result?.success) {
    throw new Error(
      (result && 'error' in result && result.error) ||
        `roadmap_memory_${method}_failed`,
    );
  }
  return result.data as T;
}
