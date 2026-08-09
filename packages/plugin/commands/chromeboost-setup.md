---
description: Finish ChromeBoost setup — copy the Chrome extension somewhere easy to find and walk through loading it.
allowed-tools: Bash(node:*), Bash(open:*), Bash(explorer:*), Bash(xdg-open:*), Bash(ls:*)
---

# Finish ChromeBoost setup

The MCP server half of ChromeBoost is already installed (that's this plugin).
What's left is loading the Chrome extension — the half that touches the browser.
**The extension ships inside this plugin**, so there is nothing to clone or build.

Work through this now, without asking the user whether to proceed.

## 1. Copy the extension somewhere reachable

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install-extension.mjs"
```

This copies the extension to **`~/Downloads/ChromeBoost-Extension`** and prints
the full path. It goes to Downloads on purpose: the plugin's own directory is
buried under `~/.claude/plugins/cache/...`, which is painful to reach in
Chrome's folder picker and changes on every plugin update. Downloads is one
click in any file picker's sidebar.

The script's last line is `CHROMEBOOST_EXTENSION_PATH=<path>` — use that value
verbatim below rather than reconstructing the path yourself.

If it fails because no extension was found, the plugin installed without its
payload: tell the user to run `/plugin update chromeboost`, and if that doesn't
help, point them at
https://github.com/lordamdal/chromeboost#install to build from source.

## 2. Open the folder for them

Reveal it in the file manager so they can drag it straight onto Chrome's
extensions page — that's faster than navigating the picker:

- macOS: `open -R "<path>"`
- Windows: `explorer "<path>"`
- Linux: `xdg-open "<path>"`

Pick the one matching the user's platform. If the command isn't available, skip
it — it's a convenience, not a requirement.

## 3. Walk them through loading it

Give these steps, with the real path substituted in:

1. Open `chrome://extensions` — paste it into the address bar; `chrome://`
   links can't be clicked from a page.
2. Turn on **Developer mode** (toggle, top right).
3. Click **Load unpacked**.
4. Select the `ChromeBoost-Extension` folder (or drag it onto the page).
5. Pin ChromeBoost to the toolbar so the popup is one click away.

Mention once, briefly, that Chrome flags developer-mode extensions — that's
expected here, since ChromeBoost isn't on the Web Store and runs from local
files. Also tell them **not to delete the folder**: Chrome reads it on every
launch, and removing it breaks the extension. (There's a `DO-NOT-DELETE.txt`
inside saying the same.)

## 4. Connect a window

Tell them to click the ChromeBoost toolbar icon. This session should appear
with a green dot on a port in the 7970–7980 range. They click **Use this
window** next to it to bind the Chrome window they want driven.

## 5. Verify it actually works

Once they say it's loaded, confirm the link yourself instead of taking it on
trust — call `list_tabs`. If it returns their open tabs, setup is done: say so
plainly and suggest a first prompt, e.g. *"open news.ycombinator.com and give
me the top 5 stories"*.

If `list_tabs` errors or times out, the extension is loaded but not connected.
Have them reload it at `chrome://extensions` (the circular arrow on the
ChromeBoost card) — it reconnects on a backoff timer and a reload forces it
immediately. Then try `list_tabs` again.

## Tone

Short and sequential — this is a 60-second task, so don't pad it. Do not skip
step 5: an install that looks finished but isn't connected is the most common
failure here, and the user has no way to tell from the Chrome side.

## Updating later

After `/plugin update chromeboost`, re-run this command. The script overwrites
`~/Downloads/ChromeBoost-Extension` in place, so the user only needs to hit
reload on the ChromeBoost card in `chrome://extensions` — no re-picking the
folder.
