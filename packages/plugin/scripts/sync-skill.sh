#!/usr/bin/env bash
# Derive the Codex skill from the canonical Claude skill.
#
# skills/chromeboost/SKILL.md is hand-maintained — it is the user-facing
# agent guide. skills-codex/chromeboost/ is the same content with the host
# name rewritten, so it must never be edited directly; edit the Claude one
# and re-run this script.
#
# (An earlier version of this script generated both skills from the root
# CLAUDE.md. That file is the repo-developer guide, not agent guidance —
# running it would have replaced the skill with build instructions.)
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SKILL_DIR="$PLUGIN_DIR/skills/chromeboost"
CODEX_SKILL_DIR="$PLUGIN_DIR/skills-codex/chromeboost"
SOURCE="$CLAUDE_SKILL_DIR/SKILL.md"

if [[ ! -f "$SOURCE" ]]; then
  echo "error: $SOURCE not found" >&2
  exit 1
fi

mkdir -p "$CODEX_SKILL_DIR/references"

# "Claude Code" -> "Codex"; bare "Claude" -> "Codex". Order matters so the
# compound rewrite runs before the bare one. Tool names are identical across
# hosts and need no rewriting.
sed \
  -e 's/Claude Code/Codex/g' \
  -e 's/ChromeBoost — Claude Instructions/ChromeBoost — Codex Instructions/g' \
  -e 's/Claude/Codex/g' \
  "$SOURCE" > "$CODEX_SKILL_DIR/SKILL.md"

echo "✓ Synced $CODEX_SKILL_DIR/SKILL.md from $SOURCE"

# References are shared verbatim between hosts.
count=0
for ref in "$CLAUDE_SKILL_DIR/references/"*.md; do
  [[ -e "$ref" ]] || continue
  cp "$ref" "$CODEX_SKILL_DIR/references/$(basename "$ref")"
  count=$((count + 1))
done

echo "✓ Copied $count reference file(s) to $CODEX_SKILL_DIR/references/"
