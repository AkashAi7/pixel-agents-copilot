# Development Guide

Everything you need to build, run, test, and contribute to Pixel Agents.

## Prerequisites

| Tool            | Version  | Notes                            |
| --------------- | -------- | -------------------------------- |
| Node.js         | v22+     | Check with `node -v`             |
| npm             | v10+     | Bundled with Node 22             |
| VS Code         | 1.105.0+ | Or any compatible fork           |
| Claude Code CLI | latest   | Required for integration testing |

---

## Setup

```bash
git clone https://github.com/pablodelucca/pixel-agents.git
cd pixel-agents

# Install all dependencies
npm install
cd webview-ui && npm install && cd ..
cd server && npm install && cd ..

# Build everything
npm run build
```

Press **F5** in VS Code to open the **Extension Development Host** — a separate VS Code window with the extension loaded from `dist/`.

---

## Project Structure

```
pixel-agents/
├── src/                   Extension backend (Node.js, VS Code API)
├── server/                Standalone HTTP server + hook installer
│   ├── src/
│   └── __tests__/
├── shared/                Code shared between extension + server
│   └── assets/            Asset loading utilities (loader, PNG decoder, etc.)
├── webview-ui/            React + TypeScript frontend (separate Vite project)
│   ├── src/
│   └── public/assets/     Sprites, furniture manifests, default layout
├── scripts/               Asset extraction and generation tools
├── e2e/                   Playwright end-to-end test suite
├── eslint-rules/          Custom ESLint rules enforced project-wide
├── esbuild.js             Extension + hook bundler configuration
└── docs/                  This documentation
```

---

## Development Workflow

### Option 1: Full watch mode

```bash
npm run watch
```

Starts parallel watchers for esbuild (extension bundling) and TypeScript type-checking. Changes to `src/` are reflected immediately.

> **Note:** The webview (Vite) is **not** included in `watch`. After changing `webview-ui/src/`, run `npm run build:webview` to rebuild, then reload the Extension Development Host window.

### Option 2: Webview dev server (browser preview)

```bash
cd webview-ui && npm run dev
```

Opens the webview at `http://localhost:5173` in a browser with mock agent data. No VS Code instance needed — useful for rapid UI iteration.

You can also start this from the command palette: **Tasks: Run Task → Mocked Pixel Agent Dev Server**.

---

## Build Scripts

| Command                 | What it does                                               |
| ----------------------- | ---------------------------------------------------------- |
| `npm run build`         | Full production build (type-check + lint + esbuild + vite) |
| `npm run build:webview` | Vite build for webview only                                |
| `npm run watch`         | Watch mode for extension (esbuild + tsc, not webview)      |
| `npm run check-types`   | TypeScript type-check without emitting                     |
| `npm run lint`          | ESLint across all packages                                 |
| `npm run lint:fix`      | ESLint with auto-fix                                       |
| `npm run format`        | Prettier format all source files                           |
| `npm run format:check`  | Prettier check (no writes)                                 |

---

## Testing

### Unit and integration tests

```bash
# All tests (webview + server)
npm test

# Server tests only (Vitest)
npm run test:server

# Webview tests only
npm run test:webview
```

**Server tests** cover:

- `server.test.ts` — HTTP server lifecycle, auth, hook endpoint, `server.json` discovery
- `hookEventHandler.test.ts` — event routing, pre-registration buffering, timer cancellation
- `claudeHookInstaller.test.ts` — hook install/uninstall in `~/.claude/settings.json`
- `claude-hook.test.ts` — integration: spawns the real compiled hook script

> The hook integration test requires a built `dist/hooks/claude-hook.js`. Run `npm run build` before running tests for the first time.

**Webview tests** cover asset loading and integration checks in `webview-ui/test/`.

### End-to-end tests (Playwright)

```bash
# Build first — e2e loads compiled output
npm run build

# Run all e2e tests
npm run e2e

# Step-by-step debug mode
npm run e2e:debug
```

On the first run, `@vscode/test-electron` downloads a stable VS Code release into `.vscode-test/` (~200 MB). Subsequent runs use the cache.

#### Mock Claude

E2E tests never invoke the real `claude` CLI. A mock script at `e2e/fixtures/mock-claude` is copied into a temp `bin/` directory and prepended to `PATH`. The mock writes a minimal JSONL session file so the extension can detect and track a session.

#### Artifacts

| Path                              | Contents                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| `test-results/e2e/videos/<test>/` | `.webm` screen recording per test                                |
| `playwright-report/e2e/`          | HTML report (`npx playwright show-report playwright-report/e2e`) |
| `test-results/e2e/*.png`          | Screenshots saved on failure                                     |

---

## Code Guidelines

### No inline constants

All magic numbers and strings must be centralized:

| Location                           | What goes there                                               |
| ---------------------------------- | ------------------------------------------------------------- |
| `src/constants.ts`                 | Extension backend timing, asset parsing, VS Code identifiers  |
| `webview-ui/src/constants.ts`      | Grid sizes, animation speeds, rendering offsets, camera, zoom |
| `webview-ui/src/index.css` `:root` | `--pixel-*` CSS custom properties for UI colors and spacing   |

### TypeScript constraints

- **No `enum`** (`erasableSyntaxOnly` is enabled) — use `as const` objects instead
- **`import type`** for type-only imports (`verbatimModuleSyntax` is enabled)
- **`noUnusedLocals` / `noUnusedParameters`** — no dead code allowed

### UI styling

Pixel Agents uses a strict pixel art aesthetic. All UI components must follow these rules, enforced by custom ESLint rules in `eslint-rules/pixel-agents-rules.mjs`:

| Rule               | Scope               | What it checks                                              |
| ------------------ | ------------------- | ----------------------------------------------------------- |
| `no-inline-colors` | Extension + Webview | No hex/rgb/hsl literals outside `constants.ts`              |
| `pixel-shadow`     | Webview             | Box shadows must use `var(--pixel-shadow)` or `2px 2px 0px` |
| `pixel-font`       | Webview             | Font family must reference FS Pixel Sans                    |

Design rules:

- Sharp corners — `border-radius: 0`
- Solid backgrounds with `2px solid` borders
- Hard drop shadow: `2px 2px 0px #0a0a14` (no blur)
- Use `var(--pixel-bg)`, `var(--pixel-border)`, `var(--pixel-accent)`, etc.

---

## Architecture Quick Reference

- **Extension ↔ Webview**: `postMessage` — see [architecture.md](architecture.md#extension--webview-message-protocol)
- **Agent status tracking**: JSONL polling + `turn_duration` events + optional hook IPC — see [architecture.md](architecture.md#status--idle-detection)
- **Asset loading order**: characters → floors → walls → furniture → layout — see [architecture.md](architecture.md#asset-load-order)
- **Layout persistence**: `~/.pixel-agents/layout.json` shared across VS Code windows

---

## Adding a New Command

1. Register the command in `package.json` under `contributes.commands`
2. Add the handler in `extension.ts` `activate()` using `vscode.commands.registerCommand`
3. Add any new constant IDs to `src/constants.ts`

## Adding a Webview Message Type

1. Add the handler in `PixelAgentsViewProvider.ts` `_view.webview.onDidReceiveMessage`
2. Handle the incoming message in `webview-ui/src/hooks/useExtensionMessages.ts`
3. For extension-to-webview messages: call `this._view.webview.postMessage(...)` in the provider and add a handler in the webview's message listener

---

## Releasing

The publish workflow (`.github/workflows/publish.yml`) automates releases to both the VS Code Marketplace and Open VSX. Trigger it by creating a GitHub release tag (e.g. `v1.3.0`).

To update the bundled default layout:

1. Design the layout in the Extension Development Host
2. Run **Pixel Agents: Export Layout as Default** from the command palette
3. Rebuild: `npm run build`
