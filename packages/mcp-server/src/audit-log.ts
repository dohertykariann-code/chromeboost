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

const SENSITIVE_URL_PARAMETERS = new Set([
  "token", "access_token", "refresh_token", "id_token", "code", "key", "api_key",
  "apikey", "secret", "client_secret", "password", "passwd", "pwd", "sig", "signature",
  "auth", "session", "jwt",
]);

const REDACTED_URL_VALUE = "<redacted>";
const MALFORMED_URL_VALUE = "<malformed URL omitted>";

function redactUrlValue(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return value;

    for (const name of [...url.searchParams.keys()]) {
      if (SENSITIVE_URL_PARAMETERS.has(name.toLowerCase())) {
        url.searchParams.set(name, REDACTED_URL_VALUE);
      }
    }

    const fragment = url.hash.slice(1);
    if (fragment) {
      const fragmentParams = new URLSearchParams(fragment);
      let redactedFragment = false;
      for (const name of [...fragmentParams.keys()]) {
        if (SENSITIVE_URL_PARAMETERS.has(name.toLowerCase())) {
          fragmentParams.set(name, REDACTED_URL_VALUE);
          redactedFragment = true;
        }
      }
      if (redactedFragment) url.hash = fragmentParams.toString();
    }

    if (url.username || url.password) {
      url.username = "redacted";
      url.password = "redacted";
    }

    return url.toString().replaceAll(encodeURIComponent(REDACTED_URL_VALUE), REDACTED_URL_VALUE);
  } catch {
    // A malformed URL may still contain a credential. Omit it rather than risk logging it.
    return MALFORMED_URL_VALUE;
  }
}

export function sanitize(message: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(message)) {
    if (k === "requestId") continue;
    if (SENSITIVE_KEYS.has(k) && typeof v === "string") {
      out[k] = `<${v.length} chars omitted>`;
    } else if (typeof v === "string") {
      out[k] = redactUrlValue(v);
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
