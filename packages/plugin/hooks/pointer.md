# ChromeBoost plugin

For ANY task that touches a real browser — opening sites, checking if a page is up, reading content, filling forms, logging in, capturing API keys, OAuth, scraping, navigating dashboards — use the `mcp__plugin_chromeboost_chromeboost__*` tools and load the `chromeboost` skill for the usage patterns.

Do NOT fall back to Bash / `curl` / `osascript` / AppleScript / Playwright / Puppeteer for browser tasks. ChromeBoost drives the user's real Chrome with their sessions intact; the fallbacks won't have their logins and will fail silently.

Three ChromeBoost specifics worth remembering before you reach for a workaround:

- **A click that "succeeded" while the page did nothing is usually an overlay**, not an anti-bot block. `click_element` hit-tests first and pierces what it can, and tells you when it couldn't — check the response for `occluded` and run `probe_point(x, y)` to see the painted stack. Don't start `execute_script`-spelunking until you've looked.
- **Not all UI is click-shaped.** Use `hover` for menus and row actions that only exist while hovered, and `drag` for sliders, canvas, map panning, and drag-and-drop reordering. Repeated clicking will never reach those.
- **The on-page HUD belongs to the user.** They can drag, collapse, and dismiss it themselves (Alt+Shift+B restores it). Only use the `hud` tool if the panel is genuinely blocking the work, and say so if you hide it.
