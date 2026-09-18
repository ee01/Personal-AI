import assert from 'node:assert/strict';

import { formatInlineMarkdown, markdownToHtml } from '../app/quick-ask-markdown.mjs';

const sample = `## 会和 Fnoz 有下午会议 —— 状态：已确认（安排中）

根据 **2026-09-16** 的群组聊天记录：

> "@Chang He 看到你明天的时间是 tentative 的，我改到今天下午"

- 原计划的会议时间：2026-09-17 10:00
- 你已将会议改到 **2026-09-16 下午**
- 参与者：Fnoz Lu、Chang He、你（Esone Qiu）

⚠️ 注意：以上信息来自聊天记录，建议确认当前日历状态。`;

const html = markdownToHtml(sample);

assert.match(html, /<h3>会和 Fnoz 有下午会议/);
assert.match(html, /<strong>2026-09-16<\/strong>/);
assert.match(html, /<blockquote>/);
assert.match(html, /<ul>/);
assert.match(html, /<li>原计划的会议时间/);
assert.doesNotMatch(html, /## 会和/);
assert.doesNotMatch(html, /^-/m);

assert.match(
  formatInlineMarkdown('引用 **[3]** 条目'),
  /<strong>\[3\]<\/strong>/,
);

console.log('quick-ask-markdown-check: ok');
