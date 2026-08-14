# Agent Instructions

This file provides instructions for AI coding agents (Codex, Claude Code, Cursor, etc.) working on this project.

## Project Overview

This is a Chrome Extension project called "Personal AI" (Radar PoC), built with:
- TypeScript / JavaScript
- React & Vue.js
- Webpack (dev/prod configurations)

Icon assets under `static/icons/` are Personal AI icons. Treat them as the product/brand icon source for UI badges, extension entry points, and Personal AI identity markers, not as generic decorative images.

## Product Vision Guardrails

Personal AI is a private memory system for the user. Its purpose is to retain the user's memories across AI conversations, messages, browsing, operations, preferences, personal skills, and memories formed on other platforms, then bring the right memory back into scenes such as chat, meetings, Jira work, and conversations with other AI tools.

Treat the memory system as an autonomous reflective companion, not as a queue that asks the user to review every internal judgment. New capability proposals should prefer internal mechanisms such as salience scoring, decay, consolidation, self-reflection, dream replay, ambient calibration, confidence thresholds, and reversible receipts. Add explicit user review only when the action crosses a high-responsibility boundary: external sending, destructive deletion, privacy/scope crossing, durable user-profile facts, or other irreversible/user-representing mutations.

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

### New Capability Ideation Harness

When the user asks for a new Personal AI capability idea, future feature concept, or `docs/progressing` plan and has not asked for implementation, run a docs-first planning loop. Do not modify runtime code in that turn unless the user explicitly approves implementation.

Start from the product vision above: Personal AI is the user's private memory system across AI conversations, messages, browsing, operations, preferences, personal skills, and memories from other platforms. The proposal should improve how those memories are retained, governed, distilled, recalled, or brought back into real scenes such as chat, meetings, Jira work, desktop workflows, and conversations with other AI tools.

Before choosing the idea:

- Set or suggest the Codex conversation title in the form `新能力：<capability name>` when the current tool surface supports thread titles
- Read `AGENT.md`, then check `docs/progressing/to-verify.md` for carry-over work
- Inspect `docs/progressing/` for active, shelved, or adjacent plans; do not propose a duplicate or a near-renamed variant
- If the request comes from automation, read the automation memory path that was provided; for the recurring new-capability automation, check `${CODEX_HOME:-$HOME/.codex}/automations/automation-2/memory.md` when it exists
- Check the local Reminders list named `Personal AI` for all-new feature ideas, not feedback on existing features or small improvements. If multiple suitable Reminder ideas exist, choose one at random. If the list is absent, blocked, or has no suitable new idea, say so and continue from repo, memory, product, and research signals
- Query current real `esone.qiu` memory-service data from `10.32.56.212` with read-only checks where possible, and look for repeated user pain patterns rather than isolated anecdotes
- Use current AI product, research paper, and expert/product references when the idea depends on the state of the art; include links so the user can inspect comparable products or sources
- Prefer mechanisms, governance layers, retrieval/write boundaries, consolidation loops, or scene contracts over another passive overview page or user-maintained review queue

The plan artifact must be written under `docs/progressing/<slug>-plan.md` and should include:

- One or two concrete user scenarios before detailed design, describing the actual user journey step by step
- Why this feature should exist, what user need it satisfies, and what makes it surprising or practically useful
- A comparison with existing Personal AI features and nearby shelved `docs/progressing` ideas, clearly stating what already exists and what this adds
- A small competitor or industry scan for similar AI-product patterns when relevant, with links
- UX interaction details from the user's point of view, including source, scope, freshness, privacy, authority, review, recovery, and writeback boundaries where they matter
- A proposed implementation shape, key data contracts, integration points, risks, and rollout phases
- An eval decision. If success depends on recall quality, ranking, LLM judgment, generated content usefulness, or behavioral drift, the plan must say that implementation should add an `evals/` suite, run it once, produce a report, and keep iterating until the suite passes. Use real scenarios and, when needed, real `esone.qiu` memory-service data
- A documentation handoff note saying that after implementation, the key behavior and logic must be summarized in the relevant canonical feature docs under `docs/features/` or `desktop-app/docs/features/`; create a new feature doc only when it does not fit an existing one

If the capability has a UI or user interaction, also create `docs/progressing/<slug>-demo.html`:

- Default the demo copy to Chinese; keep original memory snippets in their source language when useful
- If the UI is a new page, make the demo preview that page
- If the UI is integrated into another surface, the demo should simulate that host page and show the integrated interaction in context
- Use realistic sample data grounded in the scenario and memory evidence, without exposing secrets or unnecessary personal data

For docs/demo-only new-capability planning, validate the artifacts without drifting into implementation:

- Run path-scoped whitespace checks such as `git diff --check -- AGENT.md docs/progressing/<slug>-plan.md docs/progressing/<slug>-demo.html`
- Use `rg` to confirm required sections are present
- If the demo has inline JavaScript, parse or check the extracted script with Node where practical
- Browser or Playwright proof is useful for visual demos, but only report it when it actually ran

If the selected idea came from a Reminder item, finish by marking that Reminder done and writing a short note on the item with the plan path, demo path if any, and a one-paragraph summary. If Reminder access is blocked or the `Personal AI` list is missing, report that exact state instead of inventing completion.

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

### Experience Evals For Complete Features

When implementing a complete new feature, decide whether ordinary unit/API/E2E checks are enough or whether the user-facing quality needs an experience eval. If the feature's value depends on LLM judgment, ranking quality, recall relevance, generated content usefulness, or long-running behavioral drift, create or update a suite under `evals/`.

For a new eval suite:

- Add cases under `evals/cases/<suite>/`, workflow instructions under `evals/workflows/<suite>/experience.md`, and register the suite in `evals/registry.yaml`
- In `evals/registry.yaml`, declare `readerProof.claims` that map reader-facing requirement statements to real `caseIds` and optional `requiredScores`, plus `readerProof.boundaries` for behavior the suite does not execute. Report-format completeness is not feature proof.
- Set a reasonable schedule in `registry.yaml` based on drift risk; weekly is the default for recall/ranking/generation features, while lower-risk deterministic features can be manual or every 14-30 days
- Use LLM judge only when heuristic checks cannot judge the user-facing quality; otherwise keep the eval deterministic and explain that choice in the workflow
- Run `npm run eval:validate`
- Run the new/updated suite once with `npm run eval:run -- --suite <suite-id> --no-repair`
- Return the generated report path and a short pass/fail summary to the user

#### Memory Abilities Regression Gate

When you change a memory **recall or write path** — `RecallEngine`, `IngestionPipeline`, `ConsolidationEngine`, `SalienceScorer`, `TruthMaintainer`, `ForgettingEngine`, `injectionScreen`, `graphPpr`, `BehaviorAffinityService`, or the `/ask` prompt assembly — run the six-ability benchmark and include the report before the Commit / Push gate:

```bash
npm run eval:memory-abilities
# regression gate: exits non-zero if any ability drops > 0.05 below
# evals/.baseline/memory-abilities.json
```

- The benchmark hits the `--endpoint` server (default `http://10.32.56.212:3210/api/v1/ask`), which runs the **deployed** code, not your local branch. To validate your branch's recall/write change, either run it after `npm run deploy:memory` (Tier 3), or point `--endpoint` at a local memory-service started from your branch.
- This is a deterministic heuristic judge (no judge model), so it is reproducible. Paste the per-ability scores and the regression line into your validation evidence; any regression must be explained or fixed before delivery.
- Rubric and baseline policy: `evals/judges/memory-abilities.md`. It is the standalone counterpart to the registry suites — intentionally not wired into `eval:run` because it judges end-to-end answers from a live server.

Manual-interaction pauses:

- When a flow needs user action that automation cannot safely perform, pause with exact instructions and wait for the user to reply before continuing
- Example: "请在 Meeting Pilot popup 里点击 `开启会议弹幕`，完成后回复我继续验证"
- After the user replies, continue the same validation tier and include the manual step in the final evidence

### Real Chrome / webpage-mcp Harness

For checks that need the user's installed development extension, read the extension id from env:

```bash
HARNESS_EXTENSION_ID=hkmimegiefnbeadjoonnlogikcdddcho
```

Use `.env.development` first, then `.env`, then fall back to the literal id above. Prefer precise id targeting over name search:

- Extension origin: `chrome-extension://$HARNESS_EXTENSION_ID`
- Common pages: `popup.html`, `options.html`, `meeting-sidepanel.html`, `meeting-panorama.html`
- Treat webpage-mcp as a real-browser control surface, not a simulated or read-only browser. It operates the user's actual Google Chrome profile and tabs by default, so prefer inspecting an already-open relevant tab before opening or navigating pages. Use Chrome Canary only when the user explicitly asks for it or the task requires a Canary-only extension/runtime check.
- For webpage-mcp or similar real-browser testing and validation, keep operations silent in the background by default. Pass `background: true` when the tool supports it, and do not activate Google Chrome, switch visible tabs, or bring browser windows to the foreground unless the check explicitly depends on visible UI, OS-level focus/activation behavior, interactive debugging, or the user asks to see/control the page.
- If webpage-mcp can inspect Chrome extension pages in the current environment, open or select the page by id
- If Chrome internal / extension URLs are redacted or unsupported by the active webpage-mcp tool, use a Playwright persistent context loaded from `dist/`, or ask the user to open the exact extension page and continue from the available tab
- If webpage-mcp is unavailable or cannot inspect the needed active Google Chrome page, and the task still needs the user's real browser/profile state, fall back to narrow AppleScript probes first. Prefer read-only tab URL inspection and small `execute javascript` checks in `Google Chrome`. Use `Google Chrome Canary` only when the user explicitly asks for it or the task requires a Canary-only extension/runtime check. Do not use AppleScript as a replacement for reproducible E2E verification; use Playwright for rebuilt-extension validation.
- If validating the user's already-installed dev extension, do not stop at "please reload the extension" when browser control is available:
  - Open or ask the user to open `chrome://extensions/?id=$HARNESS_EXTENSION_ID`
  - Reload the unpacked extension from the extension details page
  - Confirm the page shows the extension id and a reload result, or report exactly why automation could not operate on the Chrome internal page
  - If webpage-mcp cannot operate `chrome://extensions` but Apple Events JavaScript is enabled in Google Chrome, fall back to AppleScript. Use `Google Chrome` by default and keep the extension id exact; use `Google Chrome Canary` only for an explicitly requested or Canary-only check:

    ```bash
    HARNESS_EXTENSION_ID="${HARNESS_EXTENSION_ID:-hkmimegiefnbeadjoonnlogikcdddcho}"
    osascript <<APPLESCRIPT
    tell application "Google Chrome"
      set extTab to make new tab at end of tabs of front window with properties {URL:"chrome://extensions/?id=$HARNESS_EXTENSION_ID"}
      delay 2
      set js to "(() => { const mgr = document.querySelector('extensions-manager'); const detail = mgr?.shadowRoot?.querySelector('extensions-detail-view'); const item = detail || mgr?.shadowRoot?.querySelector('extensions-item'); const reload = item?.shadowRoot?.querySelector('#dev-reload-button, cr-icon-button[iron-icon=\"cr:reload\"]'); if (!reload) return 'NO_RELOAD_BUTTON'; reload.click(); return 'RELOADED'; })()"
      return execute extTab javascript js
    end tell
    APPLESCRIPT
    ```

    After reload, refresh or reopen the target tab so content scripts are reinjected from the rebuilt `dist/`.
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
| `npm run deploy:memory` | Sync local `memory-service/` to `10.32.56.212` and rebuild the memory container | After local verification when you need real-environment validation for memory |
| `npm run deploy:roadmap` | Sync local `roadmap-service/` only to `10.32.56.212` and rebuild the roadmap container | Roadmap-only changes |
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
- Mirror the current `APP_SCRIPT_VERSION` and `APP_SCRIPT_LAST_UPDATED` into `docs/features/scheduled_messages_manager.md`, and keep `tools/verify-appscript-auto-update.ts` passing.

### Documentation
- When making a large feature change, user-visible behavior change, or meaningful logic/ranking/data-contract change, check the relevant file under `docs/features/` and update it in the same task when the feature behavior or boundary changed
- When creating or updating a feature doc under `docs/features/` (or `desktop-app/docs/features/` when that is the canonical surface), also update `docs/index.md` in the same task: add or revise the corresponding small-capability row(s), keep `所在文档` pointing at the current source of truth, and refresh the index date when the navigation set changes
- Keep `docs/features/` for current product feature docs. Do not add rule-only `.mdc`, compatibility-pointer, quick-guide, or implementation-summary docs there; merge durable agent rules into `AGENT.md` and merge valid user-visible behavior into the primary feature `.md`.
- When a feature described in `docs/progressing/` is implemented and landed into canonical feature docs, summarize the completed behavior as key feature points in the appropriate `docs/features/` document, then update `docs/index.md` to reference that landed capability, and delete the related `docs/progressing/` planning notes. Creating or revising a `docs/progressing/` plan alone does not require an index update. If the feature has an associated HTML demo, move that demo into `docs/demo/`.
- Feature docs under `docs/features/` should explain not only what the feature does, but how it decides what to show or do. For each product feature doc, include near the top a plain-language `大白话运行逻辑` / equivalent section that answers:
  - what the feature is trying to decide for the user
  - what inputs or data sources influence the result
  - which factors matter most, in rough priority order
  - what gets filtered, gated, delayed, or requires user confirmation
- If a feature uses scoring, ranking, recall, rules, thresholds, routing, or multiple data sources, include a necessary implementation-logic section after the plain-language summary. Keep formulas/tables only where they help maintainers, and put the user-readable summary before technical details. If there is no fixed source weight, say so explicitly and describe the actual allowlist, gate, priority, or fallback mechanism instead.
- Avoid feature docs that are only bullet lists of capabilities. Each current feature doc should include: product boundary, primary user flow, important data sources, decision/gating logic, safety/privacy defaults, key source-of-truth files or APIs, and minimal validation guidance.
- For Rehearsal / 场景预演 work, preserve the product boundary in docs and implementation: it is future-scene memory for “when a recognizable future scene appears, remember/say/do this,” not unrestricted brainstorming, ordinary facts, Dream weak association, or generic todos. Relevant `docs/features/` entries should state this in human language: the future trigger, the content to bring into that moment, and when the system should stay quiet.
- For `google_slides_analyzer` changes, keep `docs/features/google_slides_analyzer.md` concise and current. Verify invalid row/column indexes are not sent, cell replacement uses `deleteText.textRange.type = ALL` plus `insertText.insertionIndex = 0`, review windows use constrained `postMessage` origins, default selections are field-level, review and blocked queues show before/after plus rationale, partial-success results keep skipped reasons visible, writeback selection is locked while pending, and risk detection does not treat negated phrases, open statuses, closed high-priority issues, or `medium` risk as normal.

## Language Preference

Reply to user in Chinese (中文回复).
