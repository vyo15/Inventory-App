#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTPUT_PATH="${1:-../Inventory-App-clean.zip}"
PREFIX="${IMS_ARCHIVE_PREFIX:-Inventory-App/}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Warning: working tree belum bersih. ZIP akan dibuat dari commit HEAD, bukan perubahan yang belum di-commit." >&2
fi

git archive --format=zip --prefix="$PREFIX" --output="$OUTPUT_PATH" HEAD

echo "ZIP bersih dibuat: $OUTPUT_PATH"
echo "Sumber: git archive HEAD"
echo "Runtime SQLite, backup, node_modules, dan dist tidak ikut selama tidak tracked di Git."
