# Doubao Bridge

Doubao Bridge v2 is the local macOS app and background service that connects Personal AI Memory Service with Doubao.

It does three things:

1. Keeps a dedicated Playwright browser profile for Doubao login state.
2. Pulls memory/context packages from Memory Service and sends them into the correct Doubao conversation.
3. Exposes a localhost API for the Chrome extension and the desktop app shell.

## End-User Install

Download the latest installer from GitHub Releases:

[https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

After installing:

1. Open `/Applications/Doubao Bridge.app`
2. In the app, complete these steps in order:
   - Connect Memory Service
   - Open Doubao login
   - Create or repair the long-term memory thread
   - Bind the mobile chat thread
   - Enable auto sync
3. Close the window when finished. The app keeps running in the background.
4. Use the Chrome extension's Doubao page only as a status/onboarding page. Real configuration now lives in the app.

To really stop syncing, open the app again and click `停止后台并退出`.

## Developer Setup

```bash
cd /Users/Esone/git/personal-ai/doubao-bridge
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

`npm run deploy` reads `doubao-bridge/.env` first, then falls back to shell environment variables. If no token is found, it tries `gh auth token`, and finally falls back to `gh release` commands when `gh` is installed and already authenticated.

## Release Configuration

Required variables:

- `GITHUB_TOKEN` or `GH_TOKEN` if you do not want to rely on `gh auth login`
- `GITHUB_REPOSITORY` if the GitHub remote cannot be inferred
- Optional: `GITHUB_RELEASE_TAG`, `GITHUB_RELEASE_TITLE`, `GITHUB_RELEASE_NOTES`
- Optional for signing/notarization: `APPLE_APPLICATION_SIGNING_IDENTITY`, `APPLE_INSTALLER_SIGNING_IDENTITY`, `APPLE_NOTARY_KEYCHAIN_PROFILE`

Local packaging writes:

```text
doubao-bridge/release/Doubao Bridge.app
doubao-bridge/release/Doubao-Bridge-<version>-Installer.pkg
```

GitHub Release should only publish the `.pkg` installer for end users.

Versioning is driven by `doubao-bridge/package.json.version`, for example:

- release tag: `doubao-bridge-v2.0.1`
- release title: `Doubao Bridge 2.0.1`
- installer: `Doubao-Bridge-2.0.1-Installer.pkg`

## Runtime Defaults

Default bridge address:

```text
http://127.0.0.1:46321
```

Environment/default variables:

- `DOUBAO_BRIDGE_PORT`
- `DOUBAO_BRIDGE_HOST`
- `DOUBAO_BRIDGE_DATA_DIR`
- `DOUBAO_BRIDGE_PROFILE_DIR`
- `DOUBAO_BASE_URL`
- `DOUBAO_BRIDGE_HEADLESS`
- `DOUBAO_BRIDGE_AUTH_TOKEN`
- `DOUBAO_BRIDGE_PROVIDER`
- `DOUBAO_BRIDGE_AUTO_SYNC`
- `DOUBAO_BRIDGE_POLL_INTERVAL_MS`
- `DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS`
- `DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS`
- `DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS`
- `MEMORY_SERVICE_BASE_URL`
- `MEMORY_SERVICE_API_KEY`
- `MEMORY_SERVICE_USER_ID`

For normal users, these values are configured in `Doubao Bridge.app`, not in the extension UI.

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

## Local API

The bridge exposes these endpoints:

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

## Signing and Notarization

Use this when you want the released `.pkg` to install cleanly on other Macs without Gatekeeper warnings.

1. Run:

```bash
npm run macos:signing-info
```

2. Import both `Developer ID Application` and `Developer ID Installer` certificates into Keychain Access.
3. Copy the exact names into `doubao-bridge/.env`:

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

5. Put `APPLE_NOTARY_KEYCHAIN_PROFILE=personal-ai-notary` into `doubao-bridge/.env`.
6. Re-run:

```bash
npm run package:macos
npm run deploy
```
