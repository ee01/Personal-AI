# Doubao Bridge

Local bridge service for Personal AI. It runs on your machine and does three things:

1. Keeps a persistent Playwright browser profile for Doubao login state.
2. Receives stable memory/context payloads from the server and sends them into the correct Doubao conversation.
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
```

## Run

```bash
npm run dev
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

