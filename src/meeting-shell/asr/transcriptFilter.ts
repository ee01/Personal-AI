const NON_SPEECH_TOKEN_PATTERNS = [
  /\[(?:blank[\s_-]*audio|no[\s_-]*speech|silence|noise|inaudible|music|background\s+music|laughter|laughs|applause|空白音频|无语音|静音|噪音|听不清|音乐|背景音乐|笑声|掌声)\]/gi,
  /[（(](?:keyboard\s+(?:clicking|clacking)|mouse\s+(?:clicking|clacking)|clicking|clacking|typing|crickets?\s+chirping|crackling|speaking\s+in\s+foreign\s+language|upbeat\s+music|background\s+music|music|silence|noise|inaudible|laughter|laughs|applause|host|主持人|主播|旁白|键盘声|点击声|鼠标声|打字声|蟋蟀声|噼啪声|外语讲话|音乐|背景音乐|静音|噪音|听不清|笑声|掌声)[）)]/gi,
  /<\|(?:nospeech|notimestamps|endoftext)\|>/gi,
];
const PURE_NON_SPEECH_RE =
  /^(?:blank[\s_-]*audio|no[\s_-]*speech|silence|noise|inaudible|music|laughter|laughs|applause|空白音频|无语音|静音|噪音|听不清|音乐|笑声|掌声)$/i;
const STRONG_SUBTITLE_HALLUCINATION_RE =
  /(?:[（(]\s*)?(?:CC\s*字幕(?:製作|制作)?|字幕\s*(?:[:：]|by\b)|字幕(?:製作|制作|君)|MING\s+PAO\s+CANADA|MING\s+PAO\s+TORONTO|小明星大跟班|謝謝(?:大家|各位)?(?:觀看|收看)|谢谢(?:大家|各位)?(?:观看|收看)|下次再[見见])[\s\S]*$/i;
const REPEATED_SUBTITLE_PHRASE_RE =
  /(?:謝謝(?:大家|各位)?(?:觀看|收看)|谢谢(?:大家|各位)?(?:观看|收看)|下次再[見见])/gi;
const LOW_VALUE_PREFIX_BEFORE_SUBTITLE_RE =
  /^[\s,，.。!！?？~～、:：;；"'“”‘’（()）\-\u2014]*(?:拜拜|掰掰|嗯|呃|啊|哈囉|哈啰|你好|好開心|好开心|謝謝|谢谢)[\s,，.。!！?？~～、:：;；"'“”‘’（()）\-\u2014]*$/i;
const MAX_REAL_PREFIX_BEFORE_SUBTITLE = 48;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function sanitizeASRTranscriptText(
  text: string | null | undefined,
): string {
  let cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of NON_SPEECH_TOKEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  if (
    STRONG_SUBTITLE_HALLUCINATION_RE.test(cleaned) ||
    countMatches(cleaned, REPEATED_SUBTITLE_PHRASE_RE) >= 2
  ) {
    const prefix = cleaned.replace(STRONG_SUBTITLE_HALLUCINATION_RE, '').trim();
    cleaned =
      prefix.length > MAX_REAL_PREFIX_BEFORE_SUBTITLE ||
      LOW_VALUE_PREFIX_BEFORE_SUBTITLE_RE.test(prefix)
        ? ''
        : prefix;
  }

  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (looksGarbledWhisperText(cleaned)) return '';
  return PURE_NON_SPEECH_RE.test(cleaned) ? '' : cleaned;
}

function looksGarbledWhisperText(text: string): boolean {
  if (!text) return false;
  if (text.includes('\uFFFD')) return true;
  const garbledCount = Array.from(text).filter(isGarbledSymbol).length;
  if (garbledCount >= 4) return true;
  return text.length >= 40 && garbledCount / text.length > 0.08;
}

function isGarbledSymbol(char: string): boolean {
  const code = char.codePointAt(0) || 0;
  return (
    (code >= 0x0488 && code <= 0x0489) ||
    (code >= 0x0590 && code <= 0x05ff) ||
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0700 && code <= 0x074f) ||
    (code >= 0x07c0 && code <= 0x07ff) ||
    (code >= 0x0900 && code <= 0x0fff) ||
    (code >= 0x20a0 && code <= 0x20cf) ||
    (code >= 0x2300 && code <= 0x27bf)
  );
}
