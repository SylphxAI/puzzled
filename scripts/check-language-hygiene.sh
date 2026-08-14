#!/usr/bin/env bash
# Deep-scan live teaching of banned house slang. Enforced by default.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [[ "${LANGUAGE_HYGIENE_ENFORCE:-1}" != "1" ]]; then
  echo "OK: language hygiene skipped (LANGUAGE_HYGIENE_ENFORCE=0)"
  exit 0
fi
here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/scan_deep.py" --self-test
exec python3 "$here/scan_deep.py" "$root" --name "$(basename "$root")"
