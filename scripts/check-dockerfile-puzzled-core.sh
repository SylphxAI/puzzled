#!/usr/bin/env bash
# Regression: api image must COPY puzzled-core (S2 grid/submit depend on it).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DF="$ROOT/crates/puzzled-server/Dockerfile"
grep -q 'COPY crates/puzzled-core' "$DF"
grep -q 'puzzled-core/src' "$DF"
echo "PASS: Dockerfile copies puzzled-core sources"
