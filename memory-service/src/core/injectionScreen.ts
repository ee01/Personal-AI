/**
 * injectionScreen — ingest-side prompt-injection defense (P0-2).
 *
 * The memory write path is itself an attack surface: a malicious web page can
 * hide instructions in its text that later get recalled into an /ask or compose
 * prompt and executed ("SpAIware"-style delayed injection). This module is the
 * deterministic, zero-LLM first layer:
 *
 *  - classifyTrust(): map a source type to a trust class. Untrusted content
 *    (web pages, external AI, OpenClaw results, external email) is wrapped in a
 *    neutral data frame before it ever enters a model prompt.
 *  - screenForInjection(): flag instruction-like patterns in content at ingest
 *    so the signal is persisted (and can later drive UI markers / action
 *    isolation). Flagging never deletes or rewrites content — memory stays
 *    faithful; only its framing changes.
 *
 * This is nervous-system defense-in-depth, not a guarantee: a regex layer will
 * miss novel attacks. The neutral framing + (future) action isolation are the
 * other layers.
 */

export type TrustClass = 'trusted' | 'internal' | 'untrusted';

const TRUSTED_SOURCES = new Set([
  'user_manual',
  'manual',
  'user',
  'confirm_request_answer',
  'profile_confirmed',
]);

const UNTRUSTED_SOURCES = new Set([
  'webpage',
  'web',
  'web_page',
  'external_ai',
  'external_ai_import',
  'openclaw',
  'openclaw_result',
  'email_external',
]);

/**
 * Classify a source type into a trust class. Unknown sources default to
 * 'internal' (company systems like ringcentral/jira/meeting are half-trusted).
 */
export function classifyTrust(sourceType: string | null | undefined): TrustClass {
  if (!sourceType) return 'internal';
  const key = sourceType.toLowerCase().trim();
  if (TRUSTED_SOURCES.has(key)) return 'trusted';
  if (UNTRUSTED_SOURCES.has(key)) return 'untrusted';
  // Heuristic: source-type tokens containing web/external/openclaw are
  // untrusted (substring match — the internal vocab does not contain these).
  if (/(web|http|external|openclaw)/.test(key)) return 'untrusted';
  return 'internal';
}

export interface InjectionScreenResult {
  flags: string[];
  flagged: boolean;
}

// Each rule: a flag label + a matcher. English + Chinese variants.
const RULES: Array<{ flag: string; re: RegExp }> = [
  {
    flag: 'role_override',
    re: /\b(ignore|disregard|forget)\b[^.\n]{0,30}\b(previous|above|prior|earlier|all|everything)\b[^.\n]{0,20}\b(instruction|prompt|message|context|rule)/i,
  },
  { flag: 'role_override', re: /\bnew instructions?\s*[:：]/i },
  { flag: 'role_override', re: /忽略(以上|之前|前面|上述)[^。\n]{0,12}(指令|提示|消息|规则|内容)/ },
  { flag: 'role_override', re: /无视(上述|前面|之前|以上)[^。\n]{0,12}(指令|提示|规则)/ },
  { flag: 'role_override', re: /\byou are now\b|\bfrom now on,? you\b|\bact as\b[^.\n]{0,30}\b(assistant|ai|system)\b/i },
  { flag: 'system_impersonation', re: /(^|\n)\s*(system|assistant|developer)\s*[:：]/i },
  { flag: 'system_impersonation', re: /\[(system|assistant|admin|developer)\]/i },
  { flag: 'tool_injection', re: /\b(call|use|invoke|run|execute)\b[^.\n]{0,24}\b(tool|function|command|api|skill)\b/i },
  { flag: 'tool_injection', re: /execute the following|run this command|执行(以下|下面)(命令|指令|代码)/i },
  { flag: 'memory_injection', re: /\b(remember|store|save|add)\b[^.\n]{0,20}\b(to (your )?memory|that you|this)\b/i },
  { flag: 'memory_injection', re: /(记住|存入|写入|保存)[^。\n]{0,10}(记忆|以下|这条|这个)/ },
  {
    flag: 'exfiltration',
    re: /\b(send|forward|email|post|upload|leak)\b[^.\n]{0,40}\b(to\s+)?(https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+)/i,
  },
  { flag: 'exfiltration', re: /(发送|转发|上传|外发)[^。\n]{0,20}(到|至)[^。\n]{0,20}(https?:\/\/|@)/ },
  { flag: 'hidden_unicode', re: /[​-‍﻿⁠]/ },
];

/**
 * Screen text for instruction-like / injection patterns. Returns the set of
 * matched flag labels. Pure and cheap (regex only) — safe on the ingest path.
 */
export function screenForInjection(text: string | null | undefined): InjectionScreenResult {
  const flags: string[] = [];
  if (text && text.length > 0) {
    for (const rule of RULES) {
      if (!flags.includes(rule.flag) && rule.re.test(text)) {
        flags.push(rule.flag);
      }
    }
  }
  return { flags, flagged: flags.length > 0 };
}
