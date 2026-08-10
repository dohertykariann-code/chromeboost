/**
 * Best-effort detection of form fields and buttons that should require a
 * real human gesture rather than a programmatic fill/click — passwords,
 * payment details, one-time codes, SSNs, and the buttons that submit
 * payments or destructive actions.
 *
 * This is pattern-matching against common attribute/text conventions, not a
 * guarantee. A custom widget with no matching signal (a payment field
 * rendered inside a canvas, a submit button whose only label is an icon)
 * will not be caught. It closes the common, detectable cases; it is a
 * backstop, not a proof of safety.
 */

export type SensitiveKind = "password" | "payment" | "otp" | "ssn" | "sensitive-action";

export type SensitiveCheck =
  | { sensitive: false }
  | { sensitive: true; kind: SensitiveKind; reason: string };

const PAYMENT_AUTOCOMPLETE = new Set([
  "cc-number", "cc-csc", "cc-exp", "cc-exp-month", "cc-exp-year", "cc-name", "cc-type",
  "cc-given-name", "cc-additional-name", "cc-family-name",
]);

const PAYMENT_PATTERN = /card[\s-]?(?:number|no)\b|cc[\s-]?num(?:ber)?|credit[\s-]?card|\bcvv2?\b|\bcvc2?\b|security[\s-]?code|routing[\s-]?number|account[\s-]?(?:number|no)\b|acct[\s-]?number|\biban\b|\bswift\b|sort[\s-]?code|bank[\s-]?account|aba[\s-]?routing|expir\w*|exp[\s-]?date/i;
const OTP_PATTERN = /one[\s-]?time[\s-]?(?:code|password)|\botp\b|\b2fa\b|\bmfa\b|verification[\s-]?code|auth(?:entication)?[\s-]?code/i;
const SSN_PATTERN = /\bssn\b|social[\s-]?security/i;

/**
 * name/id/aria-label/placeholder attributes commonly use underscores as
 * separators ("card_number", "mfa_code"); the patterns above use
 * `[\s-]?` and `\b`, neither of which treats `_` as a boundary (it's a
 * word character in regex). Normalizing underscores to spaces here means
 * one separator style to match against instead of three.
 */
function fieldSignal(el: Element): string {
  return [
    el.getAttribute("name") ?? "",
    el.getAttribute("id") ?? "",
    el.getAttribute("aria-label") ?? "",
    el.getAttribute("placeholder") ?? "",
  ].join(" ").toLowerCase().replace(/_/g, " ");
}

/** Check a resolved form field (input/textarea/select/contenteditable). */
export function checkSensitiveField(el: Element | null | undefined): SensitiveCheck {
  if (!el) return { sensitive: false };

  if (el instanceof HTMLInputElement && el.type === "password") {
    return { sensitive: true, kind: "password", reason: 'input type="password"' };
  }

  const autocomplete = (el.getAttribute("autocomplete") ?? "").toLowerCase();
  if (PAYMENT_AUTOCOMPLETE.has(autocomplete)) {
    return { sensitive: true, kind: "payment", reason: `autocomplete="${autocomplete}"` };
  }

  const signal = fieldSignal(el);
  if (OTP_PATTERN.test(signal)) {
    return { sensitive: true, kind: "otp", reason: "field name/label/placeholder matches a one-time-code pattern" };
  }
  if (PAYMENT_PATTERN.test(signal)) {
    return { sensitive: true, kind: "payment", reason: "field name/label/placeholder matches a payment-detail pattern" };
  }
  if (SSN_PATTERN.test(signal)) {
    return { sensitive: true, kind: "ssn", reason: "field name/label/placeholder matches an SSN pattern" };
  }

  return { sensitive: false };
}

// Deliberately multi-word / qualified phrases only — a bare "Delete",
// "Remove", "Pay", or "Subscribe" is far too common in ordinary, harmless
// UI (removing a filter chip, deleting a draft comment, paying down a
// loan balance display) to block without false-positiving constantly.
// Catching a bare "Delete" safely needs surrounding context (a dialog
// titled "Delete account", a nearby cart total) that checkSensitiveAction
// doesn't have today — noted as a real gap, not solved here.
const ACTION_PATTERN = /\b(pay now|pay\s*\$\d|place order|complete purchase|complete order|confirm purchase|confirm payment|buy now|submit payment|submit order|proceed to checkout|checkout now|start trial|confirm delete|yes,? delete|delete account|delete permanently|permanently delete|deactivate account|close account|cancel subscription|revoke access)\b/i;

/** Check a resolved click target's visible label (button/link text). */
export function checkSensitiveAction(label: string | undefined | null): SensitiveCheck {
  if (!label) return { sensitive: false };
  if (ACTION_PATTERN.test(label)) {
    return { sensitive: true, kind: "sensitive-action", reason: `button/link text matches "${label.trim()}"` };
  }
  return { sensitive: false };
}
