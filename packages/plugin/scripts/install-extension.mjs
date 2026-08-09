#!/usr/bin/env node
/**
 * Copy the bundled Chrome extension somewhere the user can actually reach.
 *
 * The plugin lives under `~/.claude/plugins/cache/<marketplace>/<version>/`,
 * which is a terrible thing to ask someone to navigate to in Chrome's "Load
 * unpacked" folder picker: it's several levels deep, the path changes on every
 * plugin update, and on macOS `~/.claude` is hidden in the Finder dialog
 * unless you know the Cmd+Shift+. trick.
 *
 * So we copy it to ~/Downloads/ChromeBoost-Extension — one click in any file
 * picker's sidebar.
 *
 * IMPORTANT: Chrome loads unpacked extensions *by path* and re-reads that path
 * on every launch. The copy is therefore permanent, not a staging step, which
 * is why it goes somewhere stable and gets a README explaining not to bin it.
 *
 * Re-running overwrites the destination, so this doubles as the upgrade path
 * after `/plugin update chromeboost` (followed by a reload in chrome://extensions).
 *
 * Usage: node install-extension.mjs [sourceDir]
 *        Defaults to `<plugin root>/extension`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || resolve(here, "..");

const source = resolve(process.argv[2] || join(pluginRoot, "extension"));
const FOLDER_NAME = "ChromeBoost-Extension";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!existsSync(join(source, "manifest.json"))) {
  fail(
    `No extension found at ${source}\n` +
    `  The plugin may have installed without its extension payload.\n` +
    `  Try /plugin update chromeboost, or build from source:\n` +
    `  https://github.com/lordamdal/chromeboost#install`
  );
}

let version = "unknown";
try {
  version = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8")).version ?? "unknown";
} catch {
  /* manifest unreadable — not fatal, the copy is what matters */
}

// Prefer ~/Downloads; fall back to the home directory if it doesn't exist
// (some Linux setups, or a container without XDG dirs).
const home = homedir();
const downloads = join(home, "Downloads");
const parent = existsSync(downloads) ? downloads : home;
const dest = join(parent, FOLDER_NAME);

try {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(parent, { recursive: true });
  cpSync(source, dest, { recursive: true });
} catch (err) {
  fail(`Could not copy the extension to ${dest}\n  ${err.message}`);
}

// Chrome reads this folder on every launch. Leave a note so it doesn't get
// swept up in a Downloads cleanout six months from now.
try {
  writeFileSync(
    join(dest, "DO-NOT-DELETE.txt"),
    [
      "ChromeBoost — Chrome extension",
      `Version ${version}`,
      "",
      "Chrome loads this extension directly from this folder, every time it starts.",
      "If you delete or move it, ChromeBoost will stop working and Chrome will show",
      "the extension as corrupted.",
      "",
      "To reinstall or update it, run /chromeboost-setup in Claude Code.",
      "",
      "https://github.com/lordamdal/chromeboost",
      "",
    ].join("\n"),
    "utf8"
  );
} catch {
  /* best-effort */
}

console.log(
  [
    `✓ ChromeBoost extension v${version} copied to your ${parent === downloads ? "Downloads" : "home"} folder.`,
    "",
    "  Load it in Chrome:",
    "    1. Open  chrome://extensions",
    "    2. Turn on  Developer mode  (top right)",
    "    3. Click  Load unpacked",
    `    4. Select this folder:`,
    "",
    `       ${dest}`,
    "",
    "  Keep the folder where it is — Chrome reads it on every launch.",
  ].join("\n")
);

// Machine-readable tail so the calling agent can reveal the folder without
// re-deriving the path.
console.log(`\nCHROMEBOOST_EXTENSION_PATH=${dest}`);
