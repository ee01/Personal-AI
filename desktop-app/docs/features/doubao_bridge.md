# Personal AI Desktop App Memory Flow

## Overview

`Personal AI Desktop App` is the local macOS app and background service that keeps three things aligned on the same machine:

- `Memory Service` as the source of truth
- outbound sync into Doubao threads
- inbound explorer ingestion from Doubao and ChatGPT back into memory

The app is no longer just a one-way Doubao bridge. It now manages a bidirectional memory loop:

1. read memory from `Memory Service` and push stable context into Doubao
2. read supported chat history from external sources
3. clean, preview, extract, and write useful artifacts back into `Memory Service`

## Two Flows

### Output flow

The output side remains responsible for the established Doubao sync path:

- login and auth status for the managed Doubao profile
- optional reuse of the user's daily Chrome session through `webpage-mcp`
- managed Chromium fallback for outbound broadcast when `webpage-mcp` is
  unavailable or cannot verify that a message was sent, with a short cooldown
  before retrying the connector
- an in-place broadcast transport save action in the broadcast card, so switching
  between the managed profile and daily Chrome session does not require finding
  the Doubao explorer settings card; unsaved changes are shown inline and are
  saved automatically before immediate login, binding, or manual push actions
- visible transport banners on Doubao and ChatGPT explorer cards, including the
  most recent daily-browser fallback reason when the app had to use the managed
  Chromium profile
- `memory_sync_thread` for long-lived memory sync
- `mobile_context_thread` for the real mobile conversation context
- scheduled stable-memory, briefing, and reminder delivery
- manual run-now delivery returns `succeeded` or `skipped`, so the app can tell
  users when there was no real content to push instead of showing a false
  success message

### Input flow

The input side is the explorer pipeline:

- `Doubao` and `ChatGPT` can be enabled independently
- raw messages are cached locally first
- cleaned preview and extracted artifacts are visible before further action
- extracted memories are written back to `Memory Service` with scope and source metadata
- ingested memories can be revoked by source and scope without deleting the remote conversation

## Scope and Source Model

Explorer-ingested memories use the memory-service scope/source model:

- scopes: `work`, `personal`, `both` for ask/recall merging
- default recall/ask scope in the current plan variant: `work`
- Doubao explorer memories are written with ingest source `doubao_chat`
- ChatGPT explorer memories are written with ingest source `chatgpt`

The desktop app keeps per-source default scopes in settings, and explorer revoke uses the chosen source plus scope to delete previously ingested memories from `Memory Service`.

## Explorer Runtime

Explorer is opt-in by source.

Per source, the app supports:

- login/open-login
- enabled toggle
- lookback window
- polling interval
- default scope
- manual run-now
- preview cached conversations
- reset local cache and cursor state
- revoke already ingested memories from `Memory Service`
- source cards expose a guarded revoke action for the current source and scope,
  while keeping local audit cache and remote chat history untouched

ChatGPT additionally supports:

- max conversations limit
- persisted processed-message cursor tracking
- two transport modes:
  - **Playwright Chromium** (default): the explorer launches its own bundled Chromium with a dedicated profile. Works without any browser setup but is frequently challenged by Cloudflare's "Verify you are human" prompt.
  - **User Chrome via CDP** (recommended): the explorer attaches to your everyday Chrome through Chrome DevTools Protocol and runs all `chatgpt.com` requests inside an already-logged-in tab. This reuses your real cookies, fingerprint, and CF clearance, so Cloudflare does not interrupt automated reads.

### ChatGPT transport: User Chrome via CDP

Configuration lives under `explorer.chatgpt`:

- `useUserChrome` (boolean, default `false`): pick the User-Chrome transport when on, Playwright when off.
- `userChromeCdpEndpoint` (string, default `http://127.0.0.1:9222`): where to reach Chrome's debug port.

Operator setup (macOS):

```sh
open -na "Google Chrome" --args --remote-debugging-port=9222
```

The explorer expects an open `chatgpt.com` tab in that Chrome window. Behavior:

- Each `runNow` re-reads the toggle, so changes take effect on the next request without restarting the desktop app.
- If `useUserChrome=true` but Chrome is closed or the port is unreachable, the explorer transparently falls back to the Playwright transport. `GET /explorer/status` reports the most recent transport via `sources.chatgpt.transport.{mode, fellBackFromUserChrome, fallbackReason}`.
- The CDP transport uses the same 1 req/s rate limit as the Playwright transport and never closes the user's Chrome window on shutdown.

Doubao additionally supports:

- DOM-based conversation reading using the existing managed Playwright profile
- optional `webpage-mcp` transport that reads from the user's existing Chrome tab when enabled
- managed Chromium fallback for Doubao explorer reads when `webpage-mcp` fails
- explicit `doubao.com` tab targeting for the `webpage-mcp` transport, so an
  unrelated active Chrome tab is never scraped as Doubao
- visible fallback diagnostics for Doubao explorer reads, so users can tell
  whether the current run used their daily browser session or the managed
  Chromium profile
- normalized `/chat/<id>`, `/thread/<id>`, and absolute conversation links in the
  DOM fallback
- conservative skip logic for obviously active/in-progress threads

For outbound Doubao broadcast, both the managed Chromium transport and the
`webpage-mcp` transport only report success after they submit the message and
observe a new copy of the sent text in the non-editable page body. They exclude
composer/input text and compare pre-send/post-send match counts, so old sync
messages or unsent input text do not mark reminder and notice jobs delivered.
Both transports also preflight challenge pages and wait briefly after submit for
slow pages. If the daily-browser checks return an unsent result, outbound sync
falls back to the managed Chromium profile instead of treating that attempt as
final.

## Local Desktop App API

Default local address:

- `http://127.0.0.1:46321`

Explorer endpoints:

- `GET /explorer/status`
- `POST /explorer/auth/open-login`
- `POST /explorer/run-now`
- `POST /explorer/reset-cache`
- `POST /explorer/revoke-ingested-memory`
- `GET /explorer/preview`

Preview returns the current explorer view of a source/conversation, including:

- raw cached messages
- cleaned preview messages
- extracted artifacts
- cursor state

## Privacy Model

Explorer defaults to disabled for all sources.

The app intentionally separates local cache actions from memory deletion:

- `reset-cache` clears local explorer cache, local artifacts, and cursor state only
- `revoke-ingested-memory` deletes previously written memories from `Memory Service` by source and scope only
- neither action deletes the original remote conversation

## Packaging and Runtime

Desktop packaging and runtime naming now use the desktop-app identity:

- app directory: `desktop-app/`
- package name: `personal-ai-desktop`
- bundle id: `com.personalai.desktop`
- installer: `Personal-AI-Desktop-<version>-Installer.pkg`
- release tag prefix: `desktop-v`

Legacy `DOUBAO_BRIDGE_*` environment variables still work as fallbacks, but `DESKTOP_APP_*` names are primary.

## Extension Relationship

The Chrome extension still exposes a `Desktop App` entry point for onboarding and status, but full configuration now lives in the desktop app itself. Configured setup cards (Memory Service, login, thread bindings, background sync, and connected explorer sources) auto-collapse after they are ready; the header stays visible so the user can expand them again.

Compatibility aliases remain in the extension-facing client surface so older code paths do not break immediately, while the primary naming has moved to `DesktopApp*`.

## Quick Ask Runtime Status

The tray Quick Ask status pill keeps runtime issues inside the chat surface. A
pill click expands an in-chat status card first, including setup blockers, so the
user can see what is missing before opening settings. Doubao sync issues include
the failed lane, trigger, timestamp, and a short next-action hint before the user
continues troubleshooting or retries from settings.

## Quick Ask Conversation Continuity

Quick Ask stores one versioned, redacted `AskResumeSnapshot` in desktop-local
storage after a successful Ask. The snapshot expires after 24 hours and keeps
only bounded question/answer previews, topic metadata, up to five evidence
references, and up to three pending candidates. It is not a full transcript and
is not written to Memory Service.

When no live renderer session is available, Quick Ask embeds a compact resume
strip above the composer:

- **Continue** activates the snapshot for the next request and renders a local
  receipt before any server response.
- **New question** hides the strip and sends no `contextHints`.
- **Discard** removes only the desktop-local snapshot and leaves long-term
  memory untouched.
- Direct typing while the strip is visible is treated as a new question.

The next resumed request sends `contextHints.source =
local_ask_resume_snapshot`. Memory Service may use it for topic
disambiguation/retrieval boost, but must re-run evidence recall and return a
`continuityReceipt` with `localOnly`, `usedAsHint`, and `reRetrieved` set to
`true`. Expired or malformed snapshots are deleted during load; secret-like
fields, tokens, emails, phone numbers, and URL credentials are redacted before
storage.

`contextHints.topicTitle` is sent as an explicit preferred topic rather than
being appended to the user's query. The server prioritizes a semantically
matching topic candidate over ambient recent frames that merely share a broad
anchor, and deterministic generation fallback retains evidence using that
locked topic's aliases and source anchors.

Verification:

- `npm --prefix desktop-app run test:quick-ask-resume`
- `npm run verify:quick-ask:e2e`
- `npm run eval:run -- --suite ask-conversation-continuity --no-repair`
