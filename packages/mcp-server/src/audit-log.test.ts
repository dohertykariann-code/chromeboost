import assert from "node:assert/strict";
import test from "node:test";

import { sanitize } from "./audit-log.js";

test("redacts credential-bearing query values while preserving a magic-link host and path", () => {
  const secret = "fake-magic-link-token";
  const result = sanitize({ href: `https://members.example.test/auth/magic-link/verify?token=${secret}` });
  const output = result.href as string;

  assert.equal(output, "https://members.example.test/auth/magic-link/verify?token=<redacted>");
  assert.doesNotMatch(output, new RegExp(secret));
});

test("leaves ordinary URL query parameters unchanged", () => {
  const url = "https://members.example.test/directory?page=2&sort=name";

  assert.deepEqual(sanitize({ target: url }), { target: url });
});

test("matches sensitive query parameter names case-insensitively", () => {
  const secret = "fake-mixed-case-token";
  const output = sanitize({ href: `https://members.example.test/callback?ToKeN=${secret}` }).href as string;

  assert.equal(output, "https://members.example.test/callback?ToKeN=<redacted>");
  assert.doesNotMatch(output, new RegExp(secret));
});

test("redacts credential-bearing fragment values", () => {
  const secret = "fake-fragment-token";
  const output = sanitize({ target: `https://members.example.test/callback#access_token=${secret}&state=keep` }).target as string;

  assert.equal(output, "https://members.example.test/callback#access_token=<redacted>&state=keep");
  assert.doesNotMatch(output, new RegExp(secret));
});

test("redacts URL userinfo credentials", () => {
  const secret = "fake-userinfo-password";
  const output = sanitize({ src: `https://person:${secret}@members.example.test/photo` }).src as string;

  assert.equal(output, "https://redacted:redacted@members.example.test/photo");
  assert.doesNotMatch(output, new RegExp(secret));
});

test("leaves non-URL string fields untouched", () => {
  const value = "a plain status message";

  assert.deepEqual(sanitize({ label: value }), { label: value });
});

test("omits malformed http(s)-looking URLs without throwing", () => {
  const malformed = "https://[not-a-valid-host?token=fake-malformed-token";

  assert.doesNotThrow(() => sanitize({ href: malformed }));
  const output = sanitize({ href: malformed }).href as string;
  assert.equal(output, "<malformed URL omitted>");
  assert.doesNotMatch(output, /fake-malformed-token/);
});
