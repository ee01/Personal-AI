# Common Ground Memory Demo · Brand / Asset Spec

## Scope

This spec applies only to the concept demo in `docs/progressing/common-ground-memory-demo.html`. It is not a new production design system.

## Verified assets

| Role | Repository asset | Use |
|---|---|---|
| Personal AI mark | `static/icons/icon128.png` | 28–32px Compose/assistant identity mark; preserve aspect ratio |
| Existing Compose reference | `docs/progressing/extension-help-center-assets/compose-assist.png` | Host-window placement, white surface, red Personal AI entry, suggestion proximity |
| Meeting reference | `docs/progressing/extension-help-center-assets/meeting-panorama.png` | Meeting Pilot density and desktop-window framing reference |
| Small-surface reference | `docs/progressing/extension-help-center-assets/popup.png` | Mobile/narrow composition reference |

Asset completeness: the real app logo and relevant product screenshots exist. The demo needs no invented illustration, mascot, avatar photo, or external stock imagery.

## Visual rules

- Keep the host chat neutral and utilitarian; Personal AI is an embedded helper, not the whole page.
- Primary Personal AI accent: the verified coral-red mark, approximated in UI tokens as `#e83f57`; do not recolor the image asset.
- Host action blue: `#0a75c2`, used sparingly for links and the simulated Send control.
- Surfaces: `#fffefb`, `#f6f4ee`, `#e4e2dc`; text: `#232826`, secondary: `#626a67`.
- Evidence/safety states use text plus a small geometric marker; never rely on color alone.
- No purple gradient, emoji decoration, bento dashboard, glassmorphism, or decorative fake metrics.

## Typography

- Display: `Iowan Old Style`, `Songti SC`, serif fallback, only for the concept label and large Meeting Pilot count.
- Body: `Aptos`, `PingFang SC`, `Microsoft YaHei`, sans-serif fallback.
- Mono evidence labels: `IBM Plex Mono` if installed, otherwise `SFMono-Regular` / `Menlo`.
- Chinese body is at least 14px desktop and 16px on narrow viewports; line height 1.65 or greater.

## Layout signature

- The signature element is a thin “evidence ribbon” above the existing Compose area, followed by an expanded evidence ledger when requested.
- Information order is decision-first: received old version → missing delta → private evidence blocked → next safe draft action.
- Desktop evidence opens inline to preserve message context; narrow viewports use a bottom sheet.

## Interaction variations

1. `只补变化`: compact and recommended when the audience received an older version.
2. `先补背景`: more explicit when important participants lack send evidence.
3. `证据不足`: removes generative actions and explains why the assistant stays quiet.

## Content integrity

- Demo data is a sanitized composite based on current aggregate memory evidence, not a verbatim transcript.
- Internal URLs, query strings, tokens, email addresses, and private-message bodies are excluded.
- Wording must say “sent/shared evidence”, never claim recipients read, know, understand, remember, or agree.
