/**
 * Local diagnostic trail for click_element terminal silent rejections.
 *
 * This intentionally writes to a separate file from audit.jsonl because it is
 * post-response diagnostic material, not the outgoing request audit trail.
 * The content script is responsible for privacy: it redacts every text preview
 * with redactSecrets() and suppresses text/selectors entirely for sensitive
 * fields/actions before this logger ever sees the entry. This file deliberately
 * does not perform a second sanitize pass, so future editors should not route
 * raw page text, outerHTML, or unredacted response payloads here.
 *
 * Diagnostic entries are bounded: oversized JSON lines are replaced with a
 * small truncation marker, and appends stop once the log is already 5MB.
 */
import { appendFileSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CLICK_FAILURE_LOG_PATH = join(homedir(), ".claude", "chromeboost", "click-failures.jsonl");
const MAX_CLICK_FAILURE_LINE_CHARS = 8000;
const MAX_CLICK_FAILURE_LOG_BYTES = 5_000_000;

let dirEnsured = false;

/** Append one click-failure diagnostic line. Never throws — a diagnostic log is
 *  never worth failing a tool call over. */
export function recordClickFailure(entry: Record<string, unknown>): void {
  try {
    if (!dirEnsured) {
      mkdirSync(dirname(CLICK_FAILURE_LOG_PATH), { recursive: true });
      dirEnsured = true;
    }
    let currentSize = 0;
    try {
      currentSize = statSync(CLICK_FAILURE_LOG_PATH).size;
    } catch {
      currentSize = 0;
    }
    if (currentSize >= MAX_CLICK_FAILURE_LOG_BYTES) return;

    const ts = new Date().toISOString();
    let line = JSON.stringify({ ts, ...entry });
    if (line.length > MAX_CLICK_FAILURE_LINE_CHARS) {
      line = JSON.stringify({
        ts,
        tool: entry.tool,
        target: entry.target,
        url: entry.url,
        truncated: true,
      });
    }
    appendFileSync(CLICK_FAILURE_LOG_PATH, line + "\n", "utf-8");
  } catch {
    // Never throw — see doc comment above.
  }
}
