#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTPUT_PATH="${1:-../Inventory-App-clean.zip}"
PREFIX="${IMS_ARCHIVE_PREFIX:-Inventory-App/}"

if [[ -n "$(git status --porcelain)" && "${IMS_ALLOW_DIRTY_ARCHIVE:-}" != "1" ]]; then
  echo "ERROR: working tree belum bersih." >&2
  echo "ZIP bersih dibuat dari commit HEAD, jadi perubahan yang belum di-commit tidak akan ikut." >&2
  echo "" >&2
  git status --short >&2
  echo "" >&2
  echo "Selesaikan dulu:" >&2
  echo "  git add ." >&2
  echo "  git commit -m \"pesan perubahan\"" >&2
  echo "  git push origin $(git branch --show-current)" >&2
  echo "" >&2
  echo "Atau pakai shortcut aman:" >&2
  echo "  npm run git:push -- \"pesan perubahan\"" >&2
  echo "" >&2
  echo "Override sadar risiko: IMS_ALLOW_DIRTY_ARCHIVE=1 bash scripts/create-clean-zip.sh" >&2
  exit 1
fi

git archive --format=zip --prefix="$PREFIX" --output="$OUTPUT_PATH" HEAD

echo "ZIP bersih dibuat: $OUTPUT_PATH"
echo "Sumber: git archive HEAD"
echo "Runtime database lokal, backup, node_modules, dan dist tidak ikut. .gitattributes juga menjaga artifact backup/data yang ter-track tidak masuk git archive."
