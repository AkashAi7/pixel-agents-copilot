# Architecture

This document describes the technical architecture of Pixel Agents — how the extension is structured, how its parts communicate, and how agent state is tracked.

## Overview

Pixel Agents is a VS Code extension with three main layers:

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)                          │
│  src/  —  agentManager, fileWatcher, assetLoader, etc.     │
│                          │  postMessage / onDidReceiveMessage│
│  ┌────────────────────────▼────────────────────────────┐    │
│  │  Webview (React + Canvas)                           │    │
│  │  webview-ui/src/  —  game loop, renderer, editor    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  server/  —  Standalone HTTP server (hook events)          │
└─────────────────────────────────────────────────────────────┘
              │ reads JSONL files
              ▼
   ~/.claude/projects/<hash>/<session-id>.jsonl
```

### Extension host (`src/`)

Runs in the VS Code extension host process (Node.js). It has access to the full VS Code API and the file system.

| File                         | Responsibility                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `extension.ts`               | Entry point — `activate()` / `deactivate()`                                                  |
| `PixelAgentsViewProvider.ts` | `WebviewViewProvider`: holds the webview, dispatches messages, starts the server             |
| `agentManager.ts`            | Terminal lifecycle — create, restore, remove agents; `workspaceState` persistence            |
| `fileWatcher.ts`             | Polls JSONL files every 500 ms; partial-line buffering; `/clear` detection                   |
| `transcriptParser.ts`        | Parses JSONL records (tool_use / tool_result / turn_duration); emits webview messages        |
| `timerManager.ts`            | Heuristic idle/permission timers for agents that don't emit hook events                      |
| `assetLoader.ts`             | Reads PNGs and `furniture-catalog.json`; builds the in-memory sprite catalog                 |
| `layoutPersistence.ts`       | Reads/writes `~/.pixel-agents/layout.json`; atomic writes; cross-window `fs.watch` + polling |
| `configPersistence.ts`       | Reads/writes `~/.pixel-agents/config.json`; stores external asset directory paths            |
| `constants.ts`               | Extension-only magic numbers and strings                                                     |
| `types.ts`                   | Shared interfaces (`AgentState`, `PersistedAgent`)                                           |

### Standalone server (`server/src/`)

A lightweight HTTP server that runs as a child process. It receives hook events from Claude Code via `~/.pixel-agents/hooks/claude-hook.js` and forwards them to the extension host via an in-process callback.

The server starts regardless of whether hooks are enabled. Hook **installation** is gated by the user's setting.

| File                                    | Responsibility                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `server.ts`                             | HTTP server — `/hook` endpoint + health check; writes `~/.pixel-agents/server.json` |
| `hookEventHandler.ts`                   | Routes hook events to agents; buffers pre-registration events                       |
| `providers/file/claudeHookInstaller.ts` | Installs / uninstalls entries in `~/.claude/settings.json`                          |
| `providers/file/hooks/claude-hook.ts`   | Hook script — reads stdin, POSTs to the server (bundled to CJS by esbuild)          |

### Webview (`webview-ui/src/`)

A React + Canvas application that renders the pixel art office and handles user interaction. It communicates with the extension host exclusively via `postMessage`.

| File / Directory     | Responsibility                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`            | Composition root — wires hooks, components, and `EditActionBar`                                                      |
| `hooks/`             | `useExtensionMessages` (agent/tool state), `useEditorActions` (editor state), `useEditorKeyboard`                    |
| `office/engine/`     | Game loop (`gameLoop.ts`), renderer (`renderer.ts`), character FSM (`characters.ts`), world state (`officeState.ts`) |
| `office/layout/`     | `layoutSerializer.ts`, `tileMap.ts`, `furnitureCatalog.ts`                                                           |
| `office/editor/`     | `editorActions.ts` (pure layout ops), `editorState.ts` (imperative state), `EditorToolbar.tsx`                       |
| `office/sprites/`    | `spriteData.ts` (pixel data), `spriteCache.ts` (offscreen canvas cache)                                              |
| `office/colorize.ts` | Dual-mode colorization: Photoshop-style (floors) and HSL-shift (furniture/characters)                                |
| `constants.ts`       | All webview magic numbers and strings                                                                                |

---

## Agent Lifecycle

```
User clicks "+ Agent"
        │
        ▼
agentManager.launchAgent()
  → opens VS Code terminal running `claude --session-id <uuid>`
  → sends `agentCreated` to webview (character spawns)
  → polls 1 s for <uuid>.jsonl to appear
        │
        ▼ file found
fileWatcher starts polling every 500 ms
        │
        ▼ new JSONL lines
transcriptParser.parseLine()
  → tool_use  → `agentToolStart` to webview
  → tool_result → `agentToolDone` to webview (300 ms delay)
  → turn_duration → `agentStatus: 'idle'` to webview
        │
        ▼ terminal closed
agentManager.removeAgent()
  → sends `agentClosed` to webview (character despawns)
```

### Project-hash → JSONL path

Claude Code stores transcripts at:

```
~/.claude/projects/<project-hash>/<session-id>.jsonl
```

where `<project-hash>` is the workspace path with `:`, `\`, and `/` replaced by `-`.

---

## Extension ↔ Webview Message Protocol

All messages are plain JSON objects passed via `webview.postMessage()` (extension→webview) and `vscode.postMessage()` (webview→extension). The `type` field distinguishes messages.

### Extension → Webview

| `type`                            | Payload                                                         | Description                                       |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `agentCreated`                    | `{ id, terminalName, palette, hueShift, seatId? }`              | New agent spawned                                 |
| `agentClosed`                     | `{ id }`                                                        | Agent terminal closed                             |
| `existingAgents`                  | `{ agents: AgentState[] }`                                      | Sent on webview ready — restores persisted agents |
| `focusAgent`                      | `{ id }`                                                        | Terminal focused in VS Code                       |
| `agentToolStart`                  | `{ agentId, toolId, toolName, isSubagent, parentId? }`          | Tool call started                                 |
| `agentToolDone`                   | `{ agentId, toolId }`                                           | Tool call finished                                |
| `agentToolClear`                  | `{ agentId }`                                                   | All tool state cleared (e.g. on `/clear`)         |
| `agentStatus`                     | `{ agentId, status: 'idle'\|'waiting'\|'thinking' }`            | Agent status changed                              |
| `layoutLoaded`                    | `{ layout: OfficeLayout }`                                      | Office layout data                                |
| `furnitureAssetsLoaded`           | `{ catalog, sprites }`                                          | Furniture catalog + sprite data                   |
| `floorTilesLoaded`                | `{ tiles }`                                                     | Floor tile sprites                                |
| `wallTilesLoaded`                 | `{ tiles }`                                                     | Wall tile sprites                                 |
| `characterSpritesLoaded`          | `{ sprites }`                                                   | 6 pre-colored character sprite sets               |
| `settingsLoaded`                  | `{ soundEnabled, externalAssetDirectories, alwaysShowOverlay }` | User preferences                                  |
| `externalAssetDirectoriesUpdated` | `{ dirs: string[] }`                                            | After directory add/remove                        |

### Webview → Extension

| `type`                         | Payload                             | Description                      |
| ------------------------------ | ----------------------------------- | -------------------------------- |
| `openClaude`                   | `{ skipPermissions?: boolean }`     | User clicked "+ Agent"           |
| `focusTerminal`                | `{ id }`                            | User clicked a character         |
| `saveLayout`                   | `{ layout: OfficeLayout }`          | Layout editor saved              |
| `saveAgentSeats`               | `{ seats: Record<number, string> }` | Agent seat assignments updated   |
| `exportLayout`                 | `{ layout: OfficeLayout }`          | User clicked Export in Settings  |
| `importLayout`                 | —                                   | User clicked Import in Settings  |
| `setSoundEnabled`              | `{ enabled: boolean }`              | Sound toggle changed             |
| `addExternalAssetDirectory`    | —                                   | User clicked Add Asset Directory |
| `removeExternalAssetDirectory` | `{ path: string }`                  | User removed a directory         |

---

## Status & Idle Detection

Claude Code's JSONL format does not have a definitive "agent idle" event. Pixel Agents uses two complementary signals:

1. **`turn_duration` record** — emitted by Claude Code at the end of most tool-using turns (~98% reliable). On receipt, all tool state is cleared and status is set to `idle`.

2. **Text-idle timer** (`TEXT_IDLE_DELAY_MS = 5 s`) — for text-only turns where `turn_duration` is never emitted. The timer starts only when `hadToolsInTurn` is `false`. Any new JSONL data cancels the timer.

3. **Hook events** — `Stop` (turn complete), `PermissionRequest` (waiting), `Notification` (idle prompt). When `agent.hookDelivered = true`, these take priority over heuristics.

### Permission detection

When an agent (or its sub-agent) calls a non-exempt tool and no new data arrives within 5 s, a permission bubble appears. Sub-agent permission state propagates to the parent agent.

---

## Persistence

| Data                                       | Location                                      | Scope                                 |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------- |
| Agent list (id, palette, hueShift, seatId) | `workspaceState` key `pixel-agents.agents`    | Per VS Code workspace                 |
| Office layout                              | `~/.pixel-agents/layout.json`                 | User-level, shared across all windows |
| Config (external asset dirs)               | `~/.pixel-agents/config.json`                 | User-level, shared across all windows |
| Sound enabled                              | `globalState` key `pixel-agents.soundEnabled` | User-level                            |

Layout writes are atomic: written to a `.tmp` file first, then renamed. A hybrid `fs.watch` + 2 s polling watcher detects cross-window changes and pushes `layoutLoaded` to the webview — skipped if the editor has unsaved changes.

---

## Asset Load Order

Assets are loaded sequentially on webview ready:

```
characterSpritesLoaded
    → floorTilesLoaded
        → wallTilesLoaded
            → furnitureAssetsLoaded   (catalog built synchronously)
                → layoutLoaded
```

The layout is loaded last because it references furniture IDs that must already be in the catalog.

---

## Build Pipeline

```
npm run build
  ├─ tsc --noEmit          (type check extension + server)
  ├─ eslint                 (lint extension + server + webview)
  ├─ node esbuild.js        (bundle extension to dist/extension.js)
  │    └─ buildHooks()          (bundle claude-hook.ts → dist/hooks/claude-hook.js)
  └─ cd webview-ui && vite build
       └─ copies assets/ → dist/assets/
```

Press **F5** in VS Code to launch the Extension Development Host with the built output.
