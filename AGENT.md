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
