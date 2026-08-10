/**
 * Local audit trail of every tool call chromeboost sends to the extension.
 *
 * usage.ts counts calls for the support-nag hook; this logs WHAT was asked
 * for, so a session can be reviewed after the fact without relying on the
 * agent's own transcript being intact. Logs the outgoing request only (never
 * the response) — responses carry page content, which is exactly what
 * redact.ts exists to keep out of the agent's context, so this must not
 * become a second, unredacted copy of that same content on disk.
 *
 * Fields that commonly carry literal values a human typed, a secret, or a
 * full script body are stripped before logging, not just truncated — a
 * truncated secret is still a partial secret on disk.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const AUDIT_LOG_PATH = join(homedir(), ".claude", "chromeboost", "audit.jsonl");

const SENSITIVE_KEYS = new Set([
  "value", "text", "code", "content", "body", "html", "key", "envPath",
]);

function sanitize(message: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(message)) {
    if (k === "requestId") continue;
    if (SENSITIVE_KEYS.has(k) && typeof v === "string") {
      out[k] = `<${v.length} chars omitted>`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

let dirEnsured = false;

/** Append one audit line for an outgoing tool-call request. Never throws — an
 *  audit log is never worth failing a tool call over. */
export function recordAuditEntry(message: Record<string, unknown>): void {
  try {
    if (!dirEnsured) {
      mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
      dirEnsured = true;
    }
    const line = JSON.stringify({ ts: new Date().toISOString(), ...sanitize(message) });
    appendFileSync(AUDIT_LOG_PATH, line + "\n", "utf-8");
  } catch {
    // Never throw — see doc comment above.
  }
}
