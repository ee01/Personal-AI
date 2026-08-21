# Teach Once Memory Demo · Brand / Asset Spec

## Scope

This spec applies only to `docs/progressing/teach-once-memory-demo.html`. It is a concept-demo contract, not a replacement for the production design system.

## Verified assets

| Role | Repository asset | Use |
| --- | --- | --- |
| Personal AI mark | `static/icons/icon128.png` | 28–34px identity mark beside the correction band and composer entry |
| Existing Compose reference | `docs/progressing/extension-help-center-assets/compose-assist.png` | White host surface, suggestion proximity, and red Personal AI entry-point reference |
| Existing compact reference | `docs/progressing/extension-help-center-assets/popup.png` | Narrow-surface density and spacing reference |

The real mark and relevant product references are complete. The demo needs no invented logo, avatar, stock image, mascot, or external asset.

## Visual rules

- Personal AI is a lightweight embedded layer inside a neutral AI conversation host; it is not a new dashboard.
- Brand accent: `#e83f57`, sampled from the existing product mark. Do not recolor the image asset.
- Host action: `#0969a9`. Conflict: `#a65d18`. Success/evidence: `#176746`. All state colors are paired with text and a geometric marker.
- Surfaces: `#fffefb`, `#f7f5ef`, `#ece9e1`; primary text: `#222725`; secondary text: `#616966`.
- Use plain dividers and typographic hierarchy. No gradients, glass effects, bento grid, decorative metrics, emoji, or third-party branding.

## Typography

- Concept label: `Iowan Old Style`, `Songti SC`, serif fallback.
- Product body: `Aptos`, `PingFang SC`, `Microsoft YaHei`, sans-serif fallback.
- Evidence IDs and scope: `SFMono-Regular`, `Menlo`, monospace fallback.
- Desktop body is at least 14px; narrow-view body is at least 16px. Controls have at least a 44px hit target.

## Layout signature

- The signature component is a thin correction band directly above the host composer: Personal AI mark → decision-first state → scope → reversible actions.
- Expanded evidence stays in the conversation context on desktop and becomes a bottom sheet on narrow viewports.
- Current-turn instructions sit above remembered contracts in both information order and visual hierarchy.
- The no-match state is deliberately quiet: no badge inflation, no invented advice, and no extra click required.

## Interaction variations

1. `自动补齐`: two narrow contracts match the current task; the user can inspect, insert, or remove one for this turn.
2. `本次覆盖`: the current prompt conflicts with an older contract; the prompt wins, and the older contract is suspended only for this turn.
3. `证据不足`: similarity or evidence is insufficient; Personal AI does not patch the prompt.
4. `再次纠错`: after a second independent correction, an inline, optional promotion chip offers project-scoped reuse; dismissal keeps it one-off.

## Content integrity

- Demo examples are sanitized composites derived from aggregate usage patterns, not copied private messages.
- No token, credential, email address, private message body, internal URL, or query string may appear.
- All actions are explicitly draft-only or contract-state-only. The demo never claims a message was sent or an external system was written.
