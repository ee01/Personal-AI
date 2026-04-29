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
  return PURE_NON_SPEECH_RE.test(cleaned) ? '' : cleaned;
}
