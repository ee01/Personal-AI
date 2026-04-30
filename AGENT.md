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

1. **Prefer `npm start` for extension development verification**
   - Uses webpack watch mode with `.env.development`
   - Needed for development Google OAuth / Google Sheets keys
   - Output goes to `dist/` folder
   - Because it watches forever, run it only until the first successful compile, then stop it cleanly
2. Use `npm run build` only when you intentionally need the production bundle / zip flow, release packaging, or a production-env regression check

### Harness Source Of Truth

Use this `AGENT.md` as the source of truth for automated validation policy. Keep `AGENTS.md` as a compatibility pointer for tools that prefer the plural filename.

When adding or changing automation rules:

- Put durable agent behavior and validation decision policy in `AGENT.md`
- Put reusable executable checks in `package.json` scripts or `tools/` scripts, then reference them from this file
- Keep feature-specific investigation notes in `docs/` or `.cursor/plans/`; do not bury required harness behavior only in a plan file

### Post-Change Verification Harness

After implementing code, choose the smallest validation tier that gives real confidence. Do not run the full matrix for every tiny edit, but do escalate when the touched surface or risk justifies it.

| Tier | Use When | Required Checks |
|------|----------|-----------------|
| 0 - Docs/config-only | Markdown, comments, non-runtime docs, or agent instructions only | Review diff. No build needed unless scripts/env/runtime config changed |
| 1 - Local compile / targeted tests | Any runtime source, webpack/static assets, manifest, package scripts, env plumbing | Run targeted tests if available. Run dev extension build via `npm start`, wait for first successful compile, then stop it |
| 2 - Extension E2E | Popup/options/side panel/content script/background/manifest behavior, user-visible UI, cross-context messaging | Tier 1 plus Playwright extension E2E against fresh `dist/` or the relevant existing helper script |
| 3 - Real browser / real service validation | Google Sheets/OAuth/session-dependent behavior, real Chrome profile state, RingCentral live pages, flows needing installed dev extension, real memory-service data, or installed desktop app integration | Tier 2 where practical, then use webpage-mcp against the real Chrome profile/dev extension, `npm run deploy:memory` plus `10.32.56.212` checks, or `npm run build:app` plus Computer Use installer validation |
| 4 - Delivery gate | A complete feature/fix that is ready to hand off | Ensure relevant validation passes, summarize evidence, then commit and push when the task calls for delivery and the staging set is cleanly owned |

Decision examples:

- `src/meeting-shell/**`, Meeting Pilot popup/side panel/panorama/offscreen/background changes: start at Tier 2; use existing `test:meeting-pilot-*` scripts where they match the feature
- Google Sheets content script, OAuth, manifest permissions, or API key behavior: start at Tier 3 because dev Chrome auth/key state matters
- Pure memory-service logic: run the relevant `memory-service` tests first; if the local result needs validation against real memory data, promote to Tier 3 with `npm run deploy:memory`, then verify against `http://10.32.56.212:3210`
- `desktop-app/**`, native messaging, local service, packaged app, or extension-to-desktop integration changes: run local desktop tests/build first; if installed-app behavior matters, promote to Tier 3 with `npm run build:app`, install the generated `.pkg` via Computer Use, then validate the app behavior end to end
- UI copy/style-only edits in an extension page: Tier 1 is enough unless layout or click behavior is part of the task
- `src/manifest.json` changes: Tier 2 minimum because extension registration and permissions can break outside TypeScript

Failure loop:

- If a required check fails, inspect the failure, fix the code, and rerun the same tier until it passes
- If the failure shows a missing lower-level guard, add or update a targeted test before rerunning higher-level E2E
- Stop and ask the user only when blocked by credentials, external service state, unavailable browser connection, or a required human click
- Never report a validation as passed unless it actually ran in this turn

Manual-interaction pauses:

- When a flow needs user action that automation cannot safely perform, pause with exact instructions and wait for the user to reply before continuing
- Example: "请在 Meeting Pilot popup 里点击 `开启会议全貌`，完成后回复我继续验证"
- After the user replies, continue the same validation tier and include the manual step in the final evidence

### Real Chrome / webpage-mcp Harness

For checks that need the user's installed development extension, read the extension id from env:

```bash
HARNESS_EXTENSION_ID=hkmimegiefnbeadjoonnlogikcdddcho
```

Use `.env.development` first, then `.env`, then fall back to the literal id above. Prefer precise id targeting over name search:

- Extension origin: `chrome-extension://$HARNESS_EXTENSION_ID`
- Common pages: `popup.html`, `options.html`, `meeting-sidepanel.html`, `meeting-panorama.html`
- If webpage-mcp can inspect Chrome extension pages in the current environment, open or select the page by id
- If Chrome internal / extension URLs are redacted or unsupported by the active webpage-mcp tool, use a Playwright persistent context loaded from `dist/`, or ask the user to open the exact extension page and continue from the available tab
- If validating the user's already-installed dev extension, do not stop at "please reload the extension" when browser control is available:
  - Open or ask the user to open `chrome://extensions/?id=$HARNESS_EXTENSION_ID`
  - Reload the unpacked extension from the extension details page
  - Confirm the page shows the extension id and a reload result, or report exactly why automation could not operate on the Chrome internal page
- For Google Sheets and other auth-bound flows, prefer the real Chrome profile/webpage-mcp route because Playwright's clean profile may not have the required session

### Commit / Push Gate

After a complete feature or bug fix is validated:

- Commit and push when the user requested a deliverable implementation or the task explicitly includes git delivery
- Stage only files owned by the current task; do not include unrelated dirty worktree changes
- If unrelated changes are present, report them and ask before staging anything ambiguous
- Consider bumping `src/manifest.json` version for release-facing extension changes, permission changes, packaging updates, or user-visible features that should be identifiable in Chrome; skip for internal tests/docs unless asked
- Include the validation evidence in the final response and, when appropriate, in the commit message body

### Build Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm start` | Development build with watch mode using `.env.development`; stop after first successful compile for harness checks | After code changes (default) |
| `npm run build` | Production build and zip | Release/package verification or production-env regression checks |
| `npm run deploy:memory` | Sync local `memory-service/` to `10.32.56.212` and rebuild the remote memory service | Only after local verification is complete and you need real-environment validation |
| `npm run build:app` | Build the desktop app and macOS installer package | When desktop-app or extension-to-desktop behavior needs packaged/installed-app E2E validation |

### Chrome Extension E2E Validation

When a feature can be verified through the built Chrome extension, do an E2E check against `dist/` before handing off.

Recommended flow:

1. Run `npm start`, wait for the first successful development compile to `dist/`, then stop the watch process
   - Use `npm run build` instead only when the check specifically needs the production bundle / zip
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
- For real Chrome validation against the installed dev extension, after rebuilding `dist/` and reloading the extension, do not trust an already-open meeting tab or existing embedded side panel:
  - Stop any existing Meeting Pilot capture first
  - Refresh or close/reopen the RingCentral meeting tab so the content script is injected from the rebuilt extension
  - Reopen the Meeting Pilot embedded panel or side panel from the fresh meeting tab
  - Start capture again only after the refreshed tab is active
- Extension reload can invalidate the active offscreen document and leave old content-script UI state behind. Symptoms include an embedded panel iframe stuck at `about:blank`, an old side panel still showing a previous ASR tier, or capture state that does not match the freshly loaded extension. Treat these as stale page state and reload/reopen the meeting tab before validating.
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

## Memory Service Deploy And Real Validation

When the change is primarily in `memory-service/` and local verification is already complete, you may deploy the latest local memory-service code to the real server and validate against real data.

Recommended flow:

1. Complete local verification first
   - Run targeted tests and/or `npm --prefix memory-service run build`
   - For extension-facing flows, finish the relevant local Playwright / extension E2E validation first
2. Deploy with `npm run deploy:memory` from the repo root
   - This syncs the local working tree `memory-service/` and repo-root `docker-compose.yml` to `rcadmin@10.32.56.212:/Users/rcadmin/personal-ai`
   - It preserves remote `memory-service/.env` and `memory-service/data/`
   - It rebuilds and restarts the remote `memory-service` container
3. After deploy, real-environment checks may target `http://10.32.56.212:3210`
   - Use `X-User-Id: esone.qiu` when checking APIs against the real user dataset
   - Example read-only checks:
     - `GET /health`
     - `GET /api/v1/confirm-requests?...`
     - other read-only memory-service endpoints needed by the feature

Important constraints:

- `npm run deploy:memory` deploys the **local working tree**, not just committed Git history
- This is useful when the latest verified fix has not been committed yet
- Because deploy uses file sync, the remote Git worktree can become dirty; do not assume a later `git pull` on the server will be clean unless those same changes are committed upstream
- Prefer read-only API checks against `10.32.56.212` unless the task explicitly requires mutating real data

## Desktop App Package And Real Validation

When a change depends on the installed desktop app, native messaging, packaged resources, login/session state, or extension-to-desktop integration, validate the packaged app instead of only running local Node/Electron commands.

Recommended flow:

1. Complete local verification first
   - Run targeted `desktop-app` tests and/or `npm --prefix desktop-app run build`
   - For extension-facing flows, finish the relevant extension build/E2E validation first
2. Build the installer from the repo root with `npm run build:app`
   - This runs the desktop packaging flow and writes the installer under `desktop-app/release/`
   - Expected installer shape: `desktop-app/release/Personal-AI-Desktop-<version>-Installer.pkg`
3. Use Computer Use to run the generated `.pkg`, install/update the app, launch it, and validate the real behavior
   - Prefer validating the installed app plus the Chrome extension together when the feature crosses that boundary
   - If macOS permissions, installer prompts, or app login state require the user, pause with exact instructions and continue after the user confirms completion
4. Include the installed-app evidence in the final response

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
