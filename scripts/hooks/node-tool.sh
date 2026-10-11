#!/usr/bin/env bash
# lefthook's runner for JS tools: run the repo-pinned binary from ./node_modules/.bin, or skip.
#
# A fresh worktree has no node_modules (and an install per worktree is too heavy for the desk), so
# the pinned tool is missing. Falling back to `bun x <tool>` is worse than skipping: it fetches an
# unpinned latest (turbo 2.11+ rewrites the tracked AGENTS.md on every run when it detects an AI
# agent; the repo pins turbo 2.9.14). Skipping is safe because CI runs the same checks.
# Symlink or install node_modules to run the checks locally.
#
# Usage: node-tool.sh <bin> [args...]
# Exit 0 with a warning when the binary is absent; otherwise the tool's own exit code.
set -euo pipefail

tool="${1:?usage: node-tool.sh <bin> [args...]}"
shift
bin="./node_modules/.bin/${tool}"

if [ ! -x "$bin" ]; then
  echo "ℹ️  node_modules/.bin/${tool} not found (no node_modules in this worktree) — skipping ${tool} (CI enforces). Run 'bun install --frozen-lockfile' or symlink node_modules to run it locally." >&2
  exit 0
fi
exec "$bin" "$@"
