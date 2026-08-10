/**
 * URL allow/deny policy for chromeboost tools.
 *
 * Hard-coded refusal for github.com (and all subdomains, including
 * githubusercontent.com) and any OAuth `/authorize`-style endpoint. This
 * honors a commitment to GitHub Support during an account-flag review
 * (2026-05-14): "chromeboost has been updated so it cannot navigate to any
 * github.com URL or any OAuth /authorize endpoint."
 *
 * Mirrored in `packages/extension/src/background.ts` as defence in depth —
 * direct WS callers see the same refusal.
 *
 * On top of that fixed list, CHROMEBOOST_EXTRA_BLOCKED_DOMAINS (comma
 * separated hostnames, e.g. "chase.com,admin.someclient.com") is read at
 * call time so a user can block their own high-stakes domains — banking,
 * a client's production admin panel — without editing this file. Blank/unset
 * is a no-op; subdomains of a listed domain are blocked too.
 */

export type BlockResult =
  | { blocked: false }
  | { blocked: true; reason: string };

function extraBlockedDomains(): string[] {
  return (process.env.CHROMEBOOST_EXTRA_BLOCKED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isBlockedUrl(rawUrl: string): BlockResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { blocked: false };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "github.com" ||
    host.endsWith(".github.com") ||
    host === "githubusercontent.com" ||
    host.endsWith(".githubusercontent.com")
  ) {
    return {
      blocked: true,
      reason:
        "chromeboost refuses to drive the browser at github.com. This is hard-coded per a commitment to GitHub Support during an account-restoration review (2026-05-14). Interact with GitHub manually in a normal browser tab.",
    };
  }

  const pathLower = parsed.pathname.toLowerCase();
  if (pathLower.includes("oauth") && pathLower.includes("authorize")) {
    return {
      blocked: true,
      reason:
        "chromeboost refuses to drive the browser through OAuth /authorize endpoints. This is hard-coded per the same GitHub Support commitment. Complete OAuth manually in a normal browser tab.",
    };
  }

  for (const domain of extraBlockedDomains()) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return {
        blocked: true,
        reason: `chromeboost refuses to drive the browser at ${host} — it's in CHROMEBOOST_EXTRA_BLOCKED_DOMAINS. Interact with this site manually.`,
      };
    }
  }

  return { blocked: false };
}
