/**
 * Usage counter for the support prompt.
 *
 * The Stop hook needs to know whether ChromeBoost actually did anything before
 * it asks the user for a GitHub star or a coffee. Asking in a session where the
 * plugin sat idle is how a support prompt becomes spam, and spam is how a
 * plugin gets uninstalled.
 *
 * So we count real tool calls here and let the hook read the total. Writes are
 * debounced to at most one every 30s and never awaited, so a busy `type_text`
 * loop doesn't turn into filesystem churn on the request path.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const USAGE_PATH = join(homedir(), ".claude", "chromeboost", "usage.json");

const FLUSH_INTERVAL_MS = 30_000;

type Usage = { toolCalls: number; lastUsed: number };

let cached: Usage | null = null;
let lastFlush = 0;
let dirty = false;

function load(): Usage {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(USAGE_PATH, "utf8")) as Partial<Usage>;
    cached = {
      toolCalls: Number.isFinite(raw.toolCalls) ? Number(raw.toolCalls) : 0,
      lastUsed: Number.isFinite(raw.lastUsed) ? Number(raw.lastUsed) : 0,
    };
  } catch {
    cached = { toolCalls: 0, lastUsed: 0 };
  }
  return cached;
}

function flush(): void {
  if (!cached) return;
  try {
    mkdirSync(dirname(USAGE_PATH), { recursive: true });
    writeFileSync(USAGE_PATH, JSON.stringify(cached), "utf8");
    dirty = false;
    lastFlush = Date.now();
  } catch {
    /* a counter is never worth failing a tool call over */
  }
}

/** Record one successful tool round-trip. Cheap and non-blocking. */
export function recordToolCall(now = Date.now()): void {
  const u = load();
  u.toolCalls += 1;
  u.lastUsed = now;
  dirty = true;
  if (now - lastFlush >= FLUSH_INTERVAL_MS) flush();
}

/** Persist any pending count. Called on exit so short sessions still count. */
export function flushUsage(): void {
  if (dirty) flush();
}
