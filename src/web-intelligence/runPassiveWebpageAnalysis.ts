import { CAPABILITIES } from '../analytics/capabilities';
import { callLLMJsonAPI } from '../llm';
import {
  buildPassiveWebpageAnalysisPrompt,
  normalizePassiveWebpageAnalysisResult,
  type PassiveWebpageAnalysisInput,
  type PassiveWebpageAnalysisResult,
} from './passiveWebpageAnalysis';

export async function analyzePassiveWebpageOnce(
  input: PassiveWebpageAnalysisInput,
): Promise<PassiveWebpageAnalysisResult> {
  const raw = await callLLMJsonAPI({
    prompt: buildPassiveWebpageAnalysisPrompt(input),
    type: 'query',
    scenario: 'extraction',
    max_tokens: 1800,
    reasoning_effort: 'low',
    capability: CAPABILITIES.MEMORY_CAPTURE,
    feature: 'passive_webpage_memory_analysis',
  });
  return normalizePassiveWebpageAnalysisResult(raw, input.mainContent);
}
