/**
 * Markdown text chunker.
 *
 * Splits text into chunks that fit within a token budget, preserving
 * paragraph and sentence boundaries where possible.
 */

export interface ChunkResult {
  content: string;
  lineStart: number;
  lineEnd: number;
  tokenCount: number;
}

/**
 * Estimate token count from a string.
 * Rough approximation: 1 token ~= 4 characters.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into sentence-level fragments.
 * Keeps the delimiter (period / question / exclamation) attached to the sentence.
 */
function splitSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.filter((s) => s.length > 0);
}

/**
 * Chunk a block of text into pieces that fit within `maxTokens`,
 * using an `overlap` token budget for context carry-over between chunks.
 *
 * Strategy:
 *   1. Split into paragraphs (double newline).
 *   2. If a paragraph fits within the budget, accumulate it.
 *   3. If a paragraph is too large, split by sentences and accumulate.
 *   4. When the budget is exceeded, flush the current chunk and begin
 *      a new one, carrying over the last `overlap` tokens of text.
 *
 * @param text       Source text to chunk.
 * @param maxTokens  Maximum token count per chunk (default 400).
 * @param overlap    Token overlap between consecutive chunks (default 80).
 * @returns          Array of ChunkResult objects.
 */
export function chunkText(
  text: string,
  maxTokens: number = 400,
  overlap: number = 80,
): ChunkResult[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const lines = text.split('\n');
  const results: ChunkResult[] = [];

  // Build paragraph groups with their line ranges
  interface ParagraphSegment {
    text: string;
    lineStart: number; // 1-based
    lineEnd: number;   // 1-based, inclusive
  }

  const paragraphs: ParagraphSegment[] = [];
  let currentPara = '';
  let paraLineStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based

    if (line.trim() === '') {
      // Empty line: flush current paragraph
      if (currentPara.trim().length > 0) {
        paragraphs.push({
          text: currentPara.trim(),
          lineStart: paraLineStart,
          lineEnd: lineNum - 1,
        });
        currentPara = '';
      }
      paraLineStart = lineNum + 1;
    } else {
      if (currentPara.length === 0) {
        paraLineStart = lineNum;
      }
      currentPara += (currentPara.length > 0 ? '\n' : '') + line;
    }
  }
  // Flush trailing paragraph
  if (currentPara.trim().length > 0) {
    paragraphs.push({
      text: currentPara.trim(),
      lineStart: paraLineStart,
      lineEnd: lines.length,
    });
  }

  if (paragraphs.length === 0) {
    return [];
  }

  // Break paragraphs into fine-grained segments (sentence-level if needed)
  interface Segment {
    text: string;
    lineStart: number;
    lineEnd: number;
  }

  const segments: Segment[] = [];
  for (const para of paragraphs) {
    if (estimateTokens(para.text) <= maxTokens) {
      segments.push(para);
    } else {
      // Split paragraph into sentences
      const sentences = splitSentences(para.text);
      // Approximate line distribution within the paragraph
      const totalChars = para.text.length;
      let charOffset = 0;
      const lineSpan = para.lineEnd - para.lineStart + 1;

      for (const sentence of sentences) {
        const fraction = totalChars > 0 ? charOffset / totalChars : 0;
        const endFraction = totalChars > 0 ? (charOffset + sentence.length) / totalChars : 1;
        const segStart = para.lineStart + Math.floor(fraction * lineSpan);
        const segEnd = para.lineStart + Math.floor(endFraction * lineSpan);
        segments.push({
          text: sentence,
          lineStart: Math.max(segStart, para.lineStart),
          lineEnd: Math.min(segEnd, para.lineEnd),
        });
        charOffset += sentence.length;
      }
    }
  }

  // Accumulate segments into chunks
  let chunkSegments: Segment[] = [];
  let chunkTokens = 0;

  function flushChunk(): void {
    if (chunkSegments.length === 0) return;

    const content = chunkSegments.map((s) => s.text).join('\n\n');
    const lineStart = chunkSegments[0].lineStart;
    const lineEnd = chunkSegments[chunkSegments.length - 1].lineEnd;

    results.push({
      content,
      lineStart,
      lineEnd,
      tokenCount: estimateTokens(content),
    });

    // Carry overlap: keep trailing segments that fit within the overlap budget
    if (overlap > 0) {
      const overlapSegments: Segment[] = [];
      let overlapTokens = 0;
      for (let i = chunkSegments.length - 1; i >= 0; i--) {
        const seg = chunkSegments[i];
        const segTokens = estimateTokens(seg.text);
        if (overlapTokens + segTokens > overlap) break;
        overlapSegments.unshift(seg);
        overlapTokens += segTokens;
      }
      chunkSegments = overlapSegments;
      chunkTokens = overlapTokens;
    } else {
      chunkSegments = [];
      chunkTokens = 0;
    }
  }

  for (const seg of segments) {
    const segTokens = estimateTokens(seg.text);

    // If a single segment exceeds maxTokens, emit it alone
    if (segTokens > maxTokens) {
      flushChunk();
      results.push({
        content: seg.text,
        lineStart: seg.lineStart,
        lineEnd: seg.lineEnd,
        tokenCount: segTokens,
      });
      chunkSegments = [];
      chunkTokens = 0;
      continue;
    }

    if (chunkTokens + segTokens > maxTokens) {
      flushChunk();
    }

    chunkSegments.push(seg);
    chunkTokens += segTokens;
  }

  flushChunk();

  return results;
}
