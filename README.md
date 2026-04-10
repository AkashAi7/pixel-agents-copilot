<h1 align="center">
    <img src="webview-ui/public/banner.png" alt="Pixel Agents">
</h1>

<h2 align="center" style="padding-bottom: 20px;">
  The game interface where AI agents build real things — now with GitHub Copilot support
</h2>

<div align="center" style="margin-top: 25px;">

[![stars](https://img.shields.io/github/stars/AkashAi7/pixel-agents-copilot?logo=github&color=0183ff&style=flat)](https://github.com/AkashAi7/pixel-agents-copilot/stargazers)
[![license](https://img.shields.io/github/license/AkashAi7/pixel-agents-copilot?color=0183ff&style=flat)](https://github.com/AkashAi7/pixel-agents-copilot/blob/main/LICENSE)

</div>

<div align="center">
<a href="https://github.com/AkashAi7/pixel-agents-copilot/issues">🐛 Issues</a> • <a href="CONTRIBUTING.md">🤝 Contributing</a> • <a href="CHANGELOG.md">📋 Changelog</a>
</div>

> **Fork of [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)** — all credit for the original pixel art office concept, architecture, character sprites, and Claude Code adapter belongs to [@pablodelucca](https://github.com/pablodelucca) and contributors. This fork adds a **GitHub Copilot Chat adapter** so the same animated office works with GHCP agent sessions.

<br/>

Pixel Agents turns multi-agent AI systems into something you can actually see and manage. Each agent becomes a character in a pixel art office. They walk around, sit at their desk, and visually reflect what they are doing — typing when writing code, reading when searching files, waiting when it needs your attention.

This fork extends the original to support **both Claude Code and GitHub Copilot Chat (Agent mode)**.

![Pixel Agents screenshot](webview-ui/public/Screenshot.jpg)

## What's New in This Fork — GitHub Copilot Support

The original extension only works with Claude Code. This fork adds a complete **Copilot Chat adapter** (`src/copilotTranscriptParser.ts` + `src/copilotFileWatcher.ts`) that watches GitHub Copilot Chat JSONL session files and drives the same character animations.

| Feature                           | Claude Code | GitHub Copilot Chat |
| --------------------------------- | ----------- | ------------------- |
| Spawn character automatically     | ✅          | ✅                  |
| Animate per tool call             | ✅          | ✅                  |
| Show tool status in speech bubble | ✅          | ✅                  |
| Waiting / idle state              | ✅          | ✅                  |
| Dismiss character with ×          | ✅          | ✅                  |

**How the Copilot adapter works:** VS Code Copilot Chat writes JSONL delta-patch session logs to `%APPDATA%\Code\User\workspaceStorage\<hash>\chatSessions\<id>.jsonl`. The adapter scans these files every 3 s, polls active ones every 500 ms, and parses `toolInvocationSerialized` records (kind 2) to fire animation events — the exact same `AgentState` machine that the Claude Code adapter uses.

Supported Copilot tool IDs include: `copilot_readFile`, `copilot_semanticSearch`, `copilot_grepSearch`, `copilot_replaceString`, `copilot_createFile`, `copilot_runInTerminal`, `copilot_getErrors`, `copilot_runTests`, and 15+ more.

### Demo script

```powershell
# Simulates two concurrent Copilot sessions with realistic tool sequences
.\scripts\demo-copilot-session.ps1
```

Then open the Pixel Agents panel in the Extension Development Host to watch two characters animate live.

## Features

- **One agent, one character** — every Claude Code terminal or active Copilot Chat session gets its own animated character
- **Live activity tracking** — characters animate based on what the agent is actually doing (writing, reading, running commands)
- **GitHub Copilot Chat support** — Copilot agent sessions auto-detected and visualized, no configuration needed
- **Office layout editor** — design your office with floors, walls, and furniture using a built-in editor
- **Speech bubbles** — visual indicators when an agent is waiting for input or needs permission
- **Sound notifications** — optional chime when an agent finishes its turn
- **Sub-agent visualization** — Task tool sub-agents spawn as separate characters linked to their parent
- **Persistent layouts** — your office design is saved and shared across VS Code windows
- **External asset directories** — load custom or third-party furniture packs from any folder on your machine
- **Diverse characters** — 6 diverse characters. These are based on the amazing work of [JIK-A-4, Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).

<p align="center">
  <img src="webview-ui/public/characters.png" alt="Pixel Agents characters" width="320" height="72" style="image-rendering: pixelated;">
</p>

## Requirements

- VS Code 1.105.0 or later
- For **Claude Code** agents: [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and configured
- For **GitHub Copilot** agents: [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension installed and signed in; use Agent mode so tool calls fire
- **Platform**: Windows, Linux, and macOS are supported

## Getting Started

### Install from source

```bash
git clone https://github.com/AkashAi7/pixel-agents-copilot.git
cd pixel-agents-copilot
npm install
cd webview-ui && npm install && cd ..
npm run build
```

Then press **F5** in VS Code to launch the Extension Development Host.

### Usage

1. Open the **Pixel Agents** panel (it appears in the bottom panel area alongside your terminal)
2. **For Claude Code** — click **+ Agent** to spawn a new Claude Code terminal and its character
3. **For GitHub Copilot** — just start a Copilot Chat conversation in Agent mode; the extension auto-detects active sessions within ~3 seconds and spawns characters automatically
4. Watch characters react to tool calls in real time
5. Click a character to select it, then click a seat to reassign it
6. Click **Layout** to open the office editor and customize your space

## Layout Editor

The built-in editor lets you design your office:

- **Floor** — Full HSB color control
- **Walls** — Auto-tiling walls with color customization
- **Tools** — Select, paint, erase, place, eyedropper, pick
- **Undo/Redo** — 50 levels with Ctrl+Z / Ctrl+Y
- **Export/Import** — Share layouts as JSON files via the Settings modal

The grid is expandable up to 64×64 tiles. Click the ghost border outside the current grid to grow it.

### Office Assets

All office assets (furniture, floors, walls) are now **fully open-source** and included in this repository under `webview-ui/public/assets/`. No external purchases or imports are needed — everything works out of the box.

Each furniture item lives in its own folder under `assets/furniture/` with a `manifest.json` that declares its sprites, rotation groups, state groups (on/off), and animation frames. Floor tiles are individual PNGs in `assets/floors/`, and wall tile sets are in `assets/walls/`. This modular structure makes it easy to add, remove, or modify assets without touching any code.

To add a new furniture item, create a folder in `webview-ui/public/assets/furniture/` with your PNG sprite(s) and a `manifest.json`, then rebuild. The asset manager (`scripts/asset-manager.html`) provides a visual editor for creating and editing manifests.

To use furniture from an external directory, open Settings → **Add Asset Directory**. See [docs/external-assets.md](docs/external-assets.md) for the full manifest format and how to use third-party asset packs.

Characters are based on the amazing work of [JIK-A-4, Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).

## How It Works

### Claude Code adapter (original)

Pixel Agents watches Claude Code's JSONL transcript files to track what each agent is doing. When an agent uses a tool (like writing a file or running a command), the extension detects it and updates the character's animation accordingly. No modifications to Claude Code are needed.

### GitHub Copilot adapter (this fork)

VS Code Copilot Chat writes JSONL delta-patch session logs to `workspaceStorage/<hash>/chatSessions/<id>.jsonl`. The Copilot adapter (`src/copilotFileWatcher.ts` + `src/copilotTranscriptParser.ts`) scans these files, parses `toolInvocationSerialized` records, and drives the same `AgentState` machine — so Copilot agents animate identically to Claude agents.

The webview runs a lightweight game loop with canvas rendering, BFS pathfinding, and a character state machine (idle → walk → type/read). Everything is pixel-perfect at integer zoom levels.

## Tech Stack

- **Extension**: TypeScript, VS Code Webview API, esbuild
- **Webview**: React 19, TypeScript, Vite, Canvas 2D

## Known Limitations

- **Agent-terminal sync** — the way agents are connected to Claude Code terminal instances is not super robust and sometimes desyncs, especially when terminals are rapidly opened/closed or restored across sessions.
- **Heuristic-based status detection** — Claude Code's JSONL transcript format does not provide clear signals for when an agent is waiting for user input or when it has finished its turn. The current detection is based on heuristics (idle timers, turn-duration events) and often misfires — agents may briefly show the wrong status or miss transitions.
- **Linux/macOS tip** — if you launch VS Code without a folder open (e.g. bare `code` command), agents will start in your home directory. This is fully supported; just be aware your Claude sessions will be tracked under `~/.claude/projects/` using your home directory as the project root.

## Troubleshooting

If your agent appears stuck on idle or doesn't spawn:

1. **Debug View** — In the Pixel Agents panel, click the gear icon (Settings), then toggle **Debug View**. This shows connection diagnostics per agent: JSONL file status, lines parsed, last data timestamp, and file path. If you see "JSONL not found", the extension can't locate the session file.
2. **Debug Console** — If you're running from source (Extension Development Host via F5), open VS Code's **View > Debug Console**. Search for `[Pixel Agents]` to see detailed logs: project directory resolution, JSONL polling status, path encoding mismatches, and unrecognized JSONL record types.

## Where This Is Going

The long-term vision is an interface where managing AI agents feels like playing the Sims, but the results are real things built.

- **Agents as characters** you can see, assign, monitor, and redirect, each with visible roles (designer, coder, writer, reviewer), stats, context usage, and tools.
- **Desks as directories** — drag an agent to a desk to assign it to a project or working directory.
- **An office as a project** — with a Kanban board on the wall where idle agents can pick up tasks autonomously.
- **Deep inspection** — click any agent to see its model, branch, system prompt, and full work history. Interrupt it, chat with it, or redirect it.
- **Token health bars** — rate limits and context windows visualized as in-game stats.
- **Fully customizable** — upload your own character sprites, themes, and office assets. Eventually maybe even move beyond pixel art into 3D or VR.

For this to work, the architecture needs to be modular at every level:

- **Platform-agnostic**: VS Code extension today, Electron app, web app, or any other host environment tomorrow.
- **Agent-agnostic**: Claude Code today, but built to support Codex, OpenCode, Gemini, Cursor, Copilot, and others through composable adapters.
- **Theme-agnostic**: community-created assets, skins, and themes from any contributor.

We're actively working on the core module and adapter architecture that makes this possible. If you're interested to talk about this further, please visit our [Discussions Section](https://github.com/pablodelucca/pixel-agents/discussions).

## Community & Contributing

Use **[Issues](https://github.com/AkashAi7/pixel-agents-copilot/issues)** to report bugs or request features.

See [CONTRIBUTING.md](CONTRIBUTING.md) for instructions on how to contribute.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Credits & Attribution

This project is a fork of **[pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)** by [@pablodelucca](https://github.com/pablodelucca).

All original work — the pixel art office concept, Claude Code adapter, webview rendering engine, office layout editor, furniture catalog, character sprites, and the full VS Code extension infrastructure — belongs to the original author and contributors.

This fork adds the GitHub Copilot Chat adapter (`src/copilotFileWatcher.ts`, `src/copilotTranscriptParser.ts`) and the demo simulation script (`scripts/demo-copilot-session.ps1`).

Character sprites are based on the amazing work of [JIK-A-4, Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).

## License

This project is licensed under the [MIT License](LICENSE). Original work copyright © pablodelucca and contributors.
