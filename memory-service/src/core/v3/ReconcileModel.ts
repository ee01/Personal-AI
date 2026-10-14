import { getConfig } from '../../config.js';
import { isLLMProviderName,defaultModelForProvider } from '../../llm/LLMTarget.js';

/** Reuse the configured extraction cheap tier, without its retry/fallback chain. */
export function reconcileModelConfig(targetOverride?:string) {
  const config=getConfig();
  const legacyOverride=targetOverride?undefined:process.env.RECONCILE_CHEAP_MODEL;
  const target=legacyOverride?'':(targetOverride??process.env.RECONCILE_CHEAP_TARGET??process.env.MEMORY_EXTRACTION_LLM_FALLBACKS??'').split(',')[0].trim();
  const slash=target.indexOf('/'),provider=slash<0?target:target.slice(0,slash);
  if(target && !isLLMProviderName(provider)) throw new Error('Invalid RECONCILE_CHEAP_TARGET provider');
  const llmProvider=target&&isLLMProviderName(provider)?provider:config.llmProvider;
  if(!isLLMProviderName(llmProvider)) throw new Error('Invalid reconciliation LLM provider');
  const model=legacyOverride||(slash>=0?target.slice(slash+1):'')||defaultModelForProvider(llmProvider,config);
  return {...config,llmProvider,openaiModel:model,claudeModel:model,ollamaModel:model,llmFallbacks:[]};
}
export function reconcileModelVersion() {
  const config=reconcileModelConfig();
  return `${config.llmProvider}/${config.openaiModel}`;
}

export function reconcileModelOptions() {
  const model=reconcileModelConfig().openaiModel;
  const mandatoryReasoning=/glm-5|kimi-k/i.test(model);
  return {maxTokens:mandatoryReasoning?2048:768,reasoningEffort:mandatoryReasoning?'minimal' as const:'none' as const};
}
