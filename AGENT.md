# Agent Instructions

This file provides instructions for AI coding agents (Codex, Claude Code, Cursor, etc.) working on this project.

## Project Overview

This is a Chrome Extension project called "Personal AI" (Radar PoC), built with:
- TypeScript / JavaScript
- React & Vue.js
- Webpack (dev/prod configurations)

## Development Workflow

### After Modifying Code

When you modify TypeScript/JavaScript files in `src/`:

1. **Prefer `npm start`** for development verification
   - Uses webpack watch mode
   - Faster rebuilds with hot-reload
   - Output goes to `dist/` folder

### Build Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm start` | Development build with watch mode | After code changes (default) |

### Chrome Extension E2E Validation

When a feature can be verified through the built Chrome extension, do an E2E check against `dist/` before handing off.

Recommended flow:

1. Run `npm run build` to produce the latest extension bundle in `dist/`
2. Launch Chromium with a **new Playwright persistent context** and load the unpacked extension from `dist/`
3. Verify the feature in the extension page, content script, popup, side panel, or background-driven flow
4. If you need to prove the latest build was picked up, relaunch a **new extension instance** after the rebuild and validate the changed text/data from that fresh instance

Important constraints discovered in this repo:

- Headless validation is allowed **only** when you launch Playwright with `channel: 'chromium'` together with `headless: true`
- Do **not** assume default Playwright headless is equivalent: without `channel: 'chromium'`, it uses the Chromium headless shell and this repo's unpacked extension may never register its service worker
- Local verification in this repo showed that `channel: 'chromium'` + `headless: true` can cover the same extension checks as headed mode for:
  - loading `dist/`
  - waiting for the MV3 extension service worker
  - opening extension pages such as `meeting-sidepanel.html`
  - rebuilding `dist/`, relaunching a fresh extension instance, and validating the updated output
- Keep headed mode when the check depends on visible browser UI, OS-level focus/activation behavior, or interactive debugging
- Do **not** rely on `chrome.runtime.reload()` for automated verification in Playwright persistent context
- Do **not** rely on the `chrome://extensions` reload button either
- In this environment, both approaches can unload the unpacked extension and leave it without a recovered service worker
- The stable way to verify a rebuilt extension is:
  - rebuild `dist/`
  - close the current extension browser context
  - launch a fresh persistent context that loads the rebuilt `dist/`

For Meeting Pilot / RingCentral flows:

- Prefer keeping the target URL real, for example `https://v.ringcentral.com/conf/on/:meetingId`
- Use Playwright `page.route()` / `context.route()` to fulfill that URL with local fixture HTML when you need deterministic E2E coverage
- This keeps manifest matching and content-script injection behavior real, while avoiding dependence on live RingCentral state
- When validating `meeting-sidepanel.html`, `meeting-live-map.html`, or `meeting-panorama.html` against a specific meeting session, pass the real Chrome tab id in the query string, for example `?tabId=<real-tab-id>`
- If you open those pages without the meeting tab id, they may resolve against the extension page tab itself and fall back to demo/empty state

Available E2E helpers:

- `npm run test:meeting-pilot`
  - validates Meeting Pilot demo HTML scenes
- `npm run test:meeting-pilot-build-check`
  - validates that a rebuilt extension instance reads the latest `dist/` output
- `npm run test:meeting-pilot-scene1`
  - validates Meeting Pilot Scene 1 by serving fixture RingCentral pages under the real `v.ringcentral.com` URL pattern

If `node` / `npm` is not on PATH in the Codex shell, prepend the local nvm path before running these commands:

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
```

## Code Conventions

### File Aliases
- `@manifest.json` → `src/manifest.json`
- `@webpack.config.js` → `webpack.common.cjs`

### Version Updates
When modifying `src/scheduled-messages/app-script-template.gs`:
- **Bug fixes**: Increment patch version (e.g., 2.0.0 → 2.0.1)
- **New features**: Increment minor version (e.g., 2.0.1 → 2.1.0)
- **Breaking changes**: Increment major version (e.g., 2.1.0 → 3.0.0)

### Documentation
- When discussing features in `docs/`, check if updates should be reflected in `.mdc` files
- For `google_slides_analyzer` changes, update `docs/features/google_slides_analyzer.mdc`

## Language Preference

Reply to user in Chinese (中文回复).
