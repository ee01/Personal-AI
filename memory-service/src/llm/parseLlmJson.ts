/**
 * Normalize LLM text into JSON before parse — strips markdown fences and
 * extracts the first balanced JSON object/array when models add prose or truncate.
 */
export function parseJsonFromLlmText<T>(text: string): T {
  let cleaned = text.trim();
  if (!cleaned) {
    throw new SyntaxError('empty LLM response');
  }

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
    cleaned = cleaned.trim();
  }

  const attempts: string[] = [cleaned];
  const extracted = extractFirstJsonSlice(cleaned);
  if (extracted && extracted !== cleaned) {
    attempts.push(extracted);
  }

  let lastErr: unknown;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      lastErr = err;
    }
  }

  const repaired = tryRepairTruncatedJson(cleaned);
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new SyntaxError(String(lastErr));
}

function tryRepairTruncatedJson(text: string): string | null {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr);
  else if (startObj >= 0) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;

  const slice = text.slice(start);
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('{');
    else if (ch === '[') stack.push('[');
    else if (ch === '}') {
      if (stack[stack.length - 1] === '{') stack.pop();
    } else if (ch === ']') {
      if (stack[stack.length - 1] === '[') stack.pop();
    }
  }

  if (stack.length === 0 && !inString) return null;

  let repaired = slice;
  if (inString) {
    repaired += '"';
  }

  let suffix = '';
  for (let i = stack.length - 1; i >= 0; i--) {
    suffix += stack[i] === '{' ? '}' : ']';
  }
  return repaired + suffix;
}

function extractFirstJsonSlice(text: string): string | null {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr);
  else if (startObj >= 0) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
