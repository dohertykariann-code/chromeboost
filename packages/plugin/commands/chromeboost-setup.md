---
description: Finish ChromeBoost setup — locate the bundled Chrome extension and walk through loading it.
allowed-tools: Bash(ls:*), Bash(echo:*), Bash(cat:*), Bash(open:*), Bash(pwd:*)
---

# Finish ChromeBoost setup

The MCP server half of ChromeBoost is already installed (that's this plugin).
What's left is loading the Chrome extension — the half that actually touches
the browser. **The extension ships inside this plugin**, so there is nothing to
clone, install, or build.

Do this now, without asking the user whether to proceed:

## 1. Locate the bundled extension

Run:

```bash
ls "${CLAUDE_PLUGIN_ROOT}/extension"
```

You should see `manifest.json`, `background.js`, `content.js`, `popup.html`,
and an `icons/` folder. If that path doesn't exist, the plugin was installed
without its extension payload — tell the user to run `/plugin update chromeboost`,
and if that fails, point them at https://github.com/lordamdal/chromeboost#install
for the clone-and-build fallback.

## 2. Give the user the exact path

Print the **absolute** path to `${CLAUDE_PLUGIN_ROOT}/extension` on its own
line, in a code block, so they can copy it. Resolve the variable to a real
path — do not print the literal `${CLAUDE_PLUGIN_ROOT}`.

On macOS, offer to reveal it in Finder so they can drag it straight into
Chrome (this is the fastest path — Chrome accepts a dropped folder on the
extensions page):

```bash
open -R "${CLAUDE_PLUGIN_ROOT}/extension"
```

## 3. Walk them through loading it

Give these steps verbatim:

1. Open `chrome://extensions` (paste it in the address bar — links to
   `chrome://` URLs can't be clicked from a page).
2. Turn on **Developer mode** — the toggle is at the top right.
3. Click **Load unpacked**, then select the folder from step 2.
   (Or just drag the folder from Finder onto the page.)
4. Pin ChromeBoost to the toolbar so the popup is one click away.

Explain that Chrome will show "Loaded unpacked extension" and may warn about
developer-mode extensions — that's expected and harmless; ChromeBoost isn't on
the Chrome Web Store, it runs from local files the user can read.

## 4. Connect a window

Tell them to click the ChromeBoost toolbar icon. This session should appear
with a green dot on a port in the 7970–7980 range. They click **Use this
window** next to it to bind the Chrome window they want driven.

## 5. Verify it actually works

Once they say it's loaded, confirm the link yourself rather than taking it on
trust — call `list_tabs`. If it returns their open tabs, setup is done; say so
plainly and suggest a first prompt, e.g. *"open news.ycombinator.com and give
me the top 5 stories"*.

If `list_tabs` errors or times out, the extension is loaded but not connected.
Have them reload it at `chrome://extensions` (the circular arrow on the
ChromeBoost card) — it reconnects on a backoff timer and a reload forces it
immediately. Then try `list_tabs` again.

## Tone

Keep it short and sequential. This is a 60-second task; don't pad it with
explanation the user didn't ask for. Do not skip step 5 — an install that
looks finished but isn't connected is the single most common failure here.
