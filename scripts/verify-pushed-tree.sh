#!/usr/bin/env bash
# Build EXACTLY what was pushed, not what is on your disk.
#
# WHY THIS EXISTS
#
# A deployment failed with "Can't resolve '@/lib/listing-intake'" while every
# local check was green: tsc clean, 2347 tests passing, next build succeeding.
# All three were reading the WORKING TREE. Two library files existed on disk,
# were imported by six committed files, and had never been committed — every
# `git add` since naming paths explicitly had silently skipped them.
#
# A local build cannot detect a missing commit. Only a build from a clean
# checkout can, which is what this does.
#
#   ./scripts/verify-pushed-tree.sh          # verify HEAD
#   ./scripts/verify-pushed-tree.sh origin/main
set -euo pipefail

REF="${1:-HEAD}"
DIR="$(mktemp -d)"
trap 'git worktree remove "$DIR" --force >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

echo "▸ checking out $REF into a clean tree"
git worktree add --detach "$DIR" "$REF" >/dev/null

# Symlinked rather than reinstalled: this checks for MISSING FILES, not for a
# dependency drift that package-lock already governs.
ln -s "$(pwd)/node_modules" "$DIR/node_modules"
[ -f .env.local ] && cp .env.local "$DIR/.env.local"

echo "▸ building"
if (cd "$DIR" && npx next build >/tmp/pushed-build.log 2>&1); then
  echo "✅ $REF builds clean — safe to deploy"
else
  echo "❌ $REF FAILS TO BUILD. This is what the deploy will do:"
  grep -E "Module not found|Can't resolve|Failed to compile|Type error" /tmp/pushed-build.log | head -20
  exit 1
fi
