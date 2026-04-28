# Personal AI Desktop App

Personal AI Desktop App is the local macOS app and background service that keeps Personal AI Memory Service, explorer ingestion, and Doubao in sync on the same machine.

It does four things:

1. Keeps a dedicated Playwright browser profile for Doubao login state.
2. Pushes long term memory, reminders, and query answers from Memory Service into the correct Doubao conversations.
3. Pulls supported chat history back into Memory Service through the explorer pipeline, with preview, cache reset, and revoke controls.
4. Exposes a localhost API for the Chrome extension and the desktop app shell.

## End-User Install

Download the latest installer from GitHub Releases:

[https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

After installing:

1. Open `/Applications/Personal AI.app`
2. In the app, complete these steps in order:
   - Connect Memory Service
   - Open Doubao login
   - Create or repair the long-term memory thread
   - Bind the mobile chat thread
   - Enable auto sync
   - Review explorer source status if you want inbound chat ingestion enabled
3. Close the window when finished. The app keeps running in the background.
4. Use the Chrome extension's Desktop App page only as a status/onboarding page. Real configuration now lives in the app.

To really stop syncing, open the app again and click `停止后台并退出`.

## Developer Setup

```bash
cd /Users/Esone/git/personal-ai/desktop-app
npm install
cp .env.example .env
```

The packaged app vendors Playwright Chromium automatically during `package:macos`, so end users do not need to run `playwright install`.

Useful local commands:

```bash
npm run dev
npm run app:start
npm run package:macos
npm run macos:signing-info
npm run deploy
```

From the repo root, you can also use `npm run build:desktop` and `npm run deploy:desktop`.

`npm run deploy` reads `desktop-app/.env` first, then falls back to shell environment variables. If no token is found, it tries `gh auth token`, and finally falls back to `gh release` commands when `gh` is installed and already authenticated.

## Release Configuration

Required variables:

- `GITHUB_TOKEN` or `GH_TOKEN` if you do not want to rely on `gh auth login`
- `GITHUB_REPOSITORY` if the GitHub remote cannot be inferred
- Optional: `GITHUB_RELEASE_TAG`, `GITHUB_RELEASE_TITLE`, `GITHUB_RELEASE_NOTES`
- Optional for signing/notarization: `APPLE_APPLICATION_SIGNING_IDENTITY`, `APPLE_INSTALLER_SIGNING_IDENTITY`, `APPLE_NOTARY_KEYCHAIN_PROFILE`

Local packaging writes:

```text
desktop-app/release/Personal AI.app
desktop-app/release/Personal-AI-Desktop-<version>-Installer.pkg
```

GitHub Release should only publish the `.pkg` installer for end users.

Versioning is driven by `desktop-app/package.json.version`, for example:

- release tag: `desktop-v2.0.2`
- release title: `Personal AI Desktop 2.0.2`
- installer: `Personal-AI-Desktop-2.0.2-Installer.pkg`

## Runtime Defaults

Default bridge address:

```text
http://127.0.0.1:46321
```

Environment/default variables:

- `DESKTOP_APP_PORT` (preferred) / `DOUBAO_BRIDGE_PORT` (fallback)
- `DESKTOP_APP_HOST` (preferred) / `DOUBAO_BRIDGE_HOST` (fallback)
- `DESKTOP_APP_DATA_DIR` (preferred) / `DOUBAO_BRIDGE_DATA_DIR` (fallback)
- `DESKTOP_APP_PROFILE_DIR` (preferred) / `DOUBAO_BRIDGE_PROFILE_DIR` (fallback)
- `DOUBAO_BASE_URL`
- `DESKTOP_APP_HEADLESS` (preferred) / `DOUBAO_BRIDGE_HEADLESS` (fallback)
- `DESKTOP_APP_AUTH_TOKEN` (preferred) / `DOUBAO_BRIDGE_AUTH_TOKEN` (fallback)
- `DOUBAO_BRIDGE_PROVIDER`
- `DESKTOP_APP_AUTO_SYNC` (preferred) / `DOUBAO_BRIDGE_AUTO_SYNC` (fallback)
- `DESKTOP_APP_POLL_INTERVAL_MS` (preferred) / `DOUBAO_BRIDGE_POLL_INTERVAL_MS` (fallback)
- `DESKTOP_APP_STABLE_SYNC_INTERVAL_MS` (preferred) / `DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS` (fallback)
- `DESKTOP_APP_MOBILE_SYNC_INTERVAL_MS` (preferred) / `DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS` (fallback)
- `DESKTOP_APP_REMINDER_SYNC_INTERVAL_MS` (preferred) / `DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS` (fallback)
- `MEMORY_SERVICE_BASE_URL`
- `MEMORY_SERVICE_API_KEY`
- `MEMORY_SERVICE_USER_ID`

For normal users, these values are configured in `Personal AI.app`, not in the extension UI.

## Main Flow Readiness

Auto sync only runs when all of these are true:

1. `Memory Service Base URL` is configured
2. `autoSync` is enabled
3. Doubao login state is `connected`
4. `memory_sync` is bound, for `stable_memory`
5. `mobile_context` is bound, for `mobile_briefing` and `reminder_sync`

Default cadence:

- poll: every 5 minutes
- stable memory: every 12 hours
- mobile briefing: every 4 hours
- reminder sync: every 15 minutes

## Bidirectional Memory Flow

The desktop app is not only an output sync daemon.

- Output flow: `Memory Service` renders long term memory, recent briefings, reminders, and query answers, then the app sends them into Doubao threads.
- Input flow: the explorer pipeline can read supported chat sources, cache raw messages locally, preview extracted artifacts, and write approved memories back into `Memory Service`.
- Cache reset only clears local explorer cache and cursor state for the selected source or conversation. It does not delete remote chats.
- Revoke ingested memory removes previously ingested memories from `Memory Service` by explorer source and scope. It does not delete the source conversation.

### ChatGPT explorer: use your own Chrome (recommended)

ChatGPT routinely challenges Playwright's bundled Chromium with a "Verify you are human" Cloudflare prompt. The explorer can route requests through your everyday Chrome instead, reusing your existing cookies and CF clearance:

1. Quit any running Chrome instance (or use a separate profile), then start Chrome with the CDP debug port:

   ```sh
   open -na "Google Chrome" --args --remote-debugging-port=9222
   ```

   You should be able to open `http://127.0.0.1:9222/json/version` in any browser to confirm CDP is reachable.

2. Sign in to https://chatgpt.com in this Chrome window if you are not already.
3. In the desktop app's `ChatGPT 输入源` card, enable **"使用我自己的 Chrome（推荐，绕过 Cloudflare）"**. Adjust the CDP endpoint if you used a non-default port.
4. Click **保存来源设置**, then **立即抓取**. The transport banner will show whether the run actually used your Chrome (`user_chrome`) or fell back to Playwright (`playwright`) and why.

If your Chrome is closed or no `chatgpt.com` tab is open, the explorer transparently falls back to the Playwright client and surfaces the reason in the UI; flip the toggle off if you'd rather only ever use Playwright.

## Local API

The desktop app exposes these endpoints:

- `GET /health`
- `POST /pair`
- `GET /status`
- `GET /auth/status`
- `POST /auth/open-login`
- `GET /settings`
- `PUT /settings`
- `POST /settings/test-memory-service`
- `GET /threads`
- `POST /threads/create-memory-sync`
- `POST /threads/auto-bind-mobile`
- `POST /threads/bind`
- `POST /sync/run-now`
- `POST /sync/stable-memory`
- `POST /sync/mobile-briefing`
- `POST /inject/query`
- `POST /reminders/sync`
- Explorer API
  - `GET /explorer/status`
  - `POST /explorer/auth/open-login`
  - `POST /explorer/run-now`
  - `POST /explorer/reset-cache`
  - `POST /explorer/revoke-ingested-memory`
  - `GET /explorer/preview`
- **Memo API** (随手记智能分类同步)
  - `POST /memo/sync` - 同步随手记内容
  - `POST /memo/stable-memory` - 随手记格式的长期记忆同步
  - `POST /memo/reminders` - 随手记格式的提醒同步
  - `POST /memo/classify` - 测试文本分类

Explorer endpoint behavior summary:

- `/explorer/status` returns source auth, cadence, last run, and cache stats.
- `/explorer/run-now` triggers immediate ingestion for a source.
- `/explorer/preview` shows cached raw messages, cleaned preview text, extracted artifacts, and cursor state.
- `/explorer/reset-cache` clears only local raw-message cache and cursor state.
- `/explorer/revoke-ingested-memory` removes previously ingested memories from `Memory Service` for the chosen source and scope.

## Signing and Notarization

Use this when you want the released `.pkg` to install cleanly on other Macs without Gatekeeper warnings.

1. Run:

```bash
npm run macos:signing-info
```

2. Import both `Developer ID Application` and `Developer ID Installer` certificates into Keychain Access.
3. Copy the exact names into `desktop-app/.env`:

```env
APPLE_APPLICATION_SIGNING_IDENTITY=Developer ID Application: Your Name (TEAMID)
APPLE_INSTALLER_SIGNING_IDENTITY=Developer ID Installer: Your Name (TEAMID)
```

4. Create a notary profile:

```bash
xcrun notarytool store-credentials "personal-ai-notary" \
  --apple-id "you@example.com" \
  --team-id "YOURTEAMID" \
  --password "app-specific-password"
```

5. Put `APPLE_NOTARY_KEYCHAIN_PROFILE=personal-ai-notary` into `desktop-app/.env`.
6. Re-run:

```bash
npm run package:macos
npm run deploy
```
