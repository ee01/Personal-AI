# Doubao Bridge

Local bridge service for Personal AI. It runs on your machine and does three things:

1. Keeps a persistent Playwright browser profile for Doubao login state.
2. Can pull provider context packages from Memory Service and send them into the correct Doubao conversation.
3. Exposes a small localhost API for the extension and other local tooling.

## What It Is Not

- It is not the system of record for memory.
- It is not a cloud service.
- It does not need access to your main browser cookies.

## Install

```bash
cd /Users/Esone/git/personal-ai/doubao-bridge
npm install
npx playwright install chromium
cp .env.example .env
```

For end users, the packaged macOS installer is published on GitHub Releases:

[https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

## Run

```bash
npm run dev
```

To build an end-user macOS installer:

```bash
npm run package:macos
```

To inspect your local signing/notarization readiness:

```bash
npm run macos:signing-info
```

To package and publish the macOS installer to GitHub Releases:

```bash
npm run deploy
```

`npm run deploy` will automatically read `doubao-bridge/.env` first, then fall back to shell environment variables. If no token is found, it will try `gh auth token`, and finally fall back to `gh release` commands when `gh` is installed and already authenticated.

Required variables:

- `GITHUB_TOKEN` or `GH_TOKEN` if you do not want to rely on `gh auth login`
- `GITHUB_REPOSITORY` if the GitHub remote cannot be inferred
- Optional: `GITHUB_RELEASE_TAG`, `GITHUB_RELEASE_TITLE`, `GITHUB_RELEASE_NOTES`
- Optional for signing/notarization: `APPLE_INSTALLER_SIGNING_IDENTITY`, `APPLE_NOTARY_KEYCHAIN_PROFILE`

This writes:

```text
doubao-bridge/release/doubao-bridge-macos
doubao-bridge/release/Doubao-Bridge-Installer.pkg
```

Default address:

```text
http://127.0.0.1:46321
```

Environment variables:

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

## API

The bridge exposes these endpoints:

- `GET /health`
- `POST /pair`
- `GET /auth/status`
- `POST /auth/open-login`
- `GET /threads`
- `POST /threads/create-memory-sync`
- `POST /threads/bind`
- `POST /sync/stable-memory`
- `POST /sync/mobile-briefing`
- `POST /inject/query`
- `POST /reminders/sync`

## Automatic Sync

If `MEMORY_SERVICE_BASE_URL` is configured, the bridge can poll the provider APIs directly and push:

- `stable_memory` into the dedicated memory sync thread
- `mobile_briefing` into the bound mobile-context thread
- `reminder_sync` into the same active mobile-context thread as a fallback reminder channel

Example:

```bash
MEMORY_SERVICE_BASE_URL=http://127.0.0.1:3210 \
MEMORY_SERVICE_USER_ID=your-user-id \
DOUBAO_BRIDGE_AUTO_SYNC=true \
npm start
```

The default polling cadence is:

- stable memory: every 12 hours
- mobile briefing: every 4 hours
- reminder sync: every 15 minutes

## Signing and Notarization

Use this when you want the released `.pkg` to install cleanly on other Macs without Gatekeeper warnings.

1. Run:

```bash
npm run macos:signing-info
```

2. Import a `Developer ID Installer` certificate into Keychain Access.
3. Copy the exact certificate name into `APPLE_INSTALLER_SIGNING_IDENTITY` in `doubao-bridge/.env`.
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

## Autostart

### macOS launchd

Create a launch agent plist that runs `node dist/index.js` from this directory.

Example outline:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.personalai.doubao-bridge</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>node</string>
      <string>/Users/Esone/git/personal-ai/doubao-bridge/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/Esone/git/personal-ai/doubao-bridge</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
      <key>DOUBAO_BRIDGE_PORT</key>
      <string>46321</string>
    </dict>
  </dict>
</plist>
```

Load it with `launchctl bootstrap gui/$UID ...` or `launchctl load` depending on your macOS version.

### Windows Task Scheduler

Create a scheduled task that runs at login:

```text
Program:  node
Arguments: C:\Users\<you>\git\personal-ai\doubao-bridge\dist\index.js
Start in: C:\Users\<you>\git\personal-ai\doubao-bridge
```

Use `At log on` trigger and `Run whether user is logged on or not` if you want it to keep running in the background.

## Smoke Check

1. Start the service.
2. Open `http://127.0.0.1:46321/health`.
3. Call `POST /pair`.
4. Open Doubao login via `POST /auth/open-login`.
5. Bind a mobile conversation thread and verify `GET /threads`.
