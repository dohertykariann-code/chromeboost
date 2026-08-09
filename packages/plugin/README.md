# chromeboost (Claude Code / Codex plugin)

The plugin half of [ChromeBoost](../../README.md) — lets an agent drive your real Chrome,
with occlusion-aware cursor control and a HUD you can move.

## What it bundles

- **MCP server binary** (`server/chromeboost.mjs`) — a single-file ESM bundle of the
  ChromeBoost MCP server: 35 tools plus the WebSocket bridge to the Chrome extension.
  Spawned by `.mcp.json` directly via `node`. No npm dependency at runtime.
- **Permission allowlist** (`settings.json`) — 35 tool names pre-approved, so you aren't
  prompted on every call. Includes the new `hover`, `drag`, `probe_point`, and `hud`.
- **Skill** (`skills/chromeboost/SKILL.md`) — usage guidance the agent pulls in when it
  detects a browser task. Loaded on demand, not jammed into every conversation's context.
  `skills-codex/` is the Codex-flavoured copy.
- **SessionStart hook** (`hooks/hooks.json`) — injects a short "use ChromeBoost tools,
  don't fall back to curl / AppleScript / Playwright" pointer into each session.

## Install

Once the repo is public on GitHub:

```
/plugin marketplace add lordamdal/chromeboost
/plugin install chromeboost@chromeboost
```

Or from a local clone, before publishing:

```
/plugin marketplace add /absolute/path/to/ChromeBoost
/plugin install chromeboost
```

The plugin is only half of ChromeBoost. You also need the Chrome extension loaded
unpacked from `packages/extension/dist` — see the
[root README](../../README.md#install) for the full four-step setup.

Restart Claude Code after installing so the MCP server starts.

## Ports

The MCP server binds the first free port in **7970–7980** and the extension scans that
same range, so several agent sessions can run side by side without fighting over a socket.

## Build

Both halves build from the repo root:

```bash
npm run build
```

Or individually:

```bash
packages/plugin/scripts/build-server.sh   # bundle MCP server → server/chromeboost.mjs
packages/plugin/scripts/sync-skill.sh     # derive the Codex skill from the Claude one
```

`skills/chromeboost/SKILL.md` is the canonical, hand-maintained agent guide.
Never edit `skills-codex/` directly — it is generated.

## Related

- [Root README](../../README.md) — install, tool surface, what it can do
- [`CLAUDE.md`](../../CLAUDE.md) — repo-developer guide
