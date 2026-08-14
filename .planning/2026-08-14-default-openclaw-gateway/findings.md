# Findings

## Requirements
- All new users default to Mac mini Openclaw Gateway at http://claw.xmnup.com/
- Controllable via .env
- Out of the box, no Options setup

## Current gap
- `OPENCLAW_BASE_URL` / `OPENCLAW_API_KEY` already fall back from env
- Empty `agentExecutors` synthesizes `type=openclaw-responses`, not `openclaw-gateway`
- GET /config import only looks at persisted openClaw* fields, so a brand-new user does not get an env-based executor row

## Do not commit
Gateway token belongs only in `memory-service/.env` (gitignored) and the live server copy.
