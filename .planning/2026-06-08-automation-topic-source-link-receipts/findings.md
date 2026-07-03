# Topic Source Link Receipt Findings

## Local Findings

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over verification item.
- Automation memory shows the freshest exact target was Google Slides atomic writeback; this run avoids that feature family.
- `TopicDetailPage.vue` already filters source candidates through `topic-link-safety.ts`, rejects non-http(s), invalid, and credentialed URLs, and falls back from parent conversation links to context-message links.
- Current visible safe-link label is only `来源` or `上下文来源`; the actual host is in the title/aria label, which helps screen readers/hover but is weak for scanability.
- Current unsafe-only state shows `来源已隐藏` plus reason/count. That is correct, but the safe-link state can better match the hidden-state clarity.

## External Reference Findings

- Slack and Microsoft Teams both support copying links to specific messages as a way to carry context without copying the whole conversation.
- Microsoft Teams message links navigate to the specific message and highlight it for members who have access, reinforcing that a source link is a traceability anchor with access boundaries.
- Zulip supports links to messages/topics/channels and keeps topic links tied to stable message IDs, reinforcing stable anchors over mutable topic names.
- Zulip muted topics remain recoverable through explicit filters, supporting the existing Topic Messages pattern that hidden/low-priority state should remain explainable.
- URL inspection and phishing research points to users missing real domains; visible destination-host receipts are more useful than burying the domain in a tooltip.
- RFC 3986 warns against exposing userinfo in clear text URLs; the existing credentialed-URL block remains the right safety boundary.

## Proposed UX Contract

- For safe parent-message links, render a compact host chip such as `example.com` next to `来源`.
- For safe context fallback links, keep `上下文来源` and show the host so users know this is a fallback source from the surrounding message.
- For blocked candidates, keep the non-clickable badge and reason/count visible.
