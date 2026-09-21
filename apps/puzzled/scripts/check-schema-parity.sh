#!/usr/bin/env bash
# check-schema-parity.sh -- TD-04 gate: src/lib/db/schema.ts (Drizzle) and
# atlas/migrations (Atlas) are two hand-kept copies of one PostgreSQL DDL.
# Nothing compared them, so a column added to only one side compiles, typechecks
# and passes unit tests, then fails in production on the first query.
#
# Mechanism:
#   1. drizzle-kit export renders schema.ts to plain SQL.
#   2. atlas migrate diff replays atlas/migrations on a disposable dev Postgres
#      and writes a migration file for every difference to that exported schema.
#   3. A new .sql file in the copied directory means the two copies drifted:
#      print it and exit 1. No new file means synced: exit 0.
#
# Atlas needs a dev database because it computes a migration directory state by
# replaying it. Resolution order:
#   SCHEMA_PARITY_DEV_URL  explicit URL (local development), e.g.
#      postgresql://user@127.0.0.1:5432/scratch?search_path=public
#   docker                 repo dev URL: docker://pgvector/pgvector/pg18/dev
#   host postgres          throwaway role+database via sudo -u postgres
#                          (the sibling-product runner pattern)
# Exit 2 means the gate could not run (no Atlas, no dev database): it is NOT a pass.
#
# Environment overrides: SCHEMA_PARITY_ATLAS (atlas binary), SCHEMA_PARITY_DEV_URL.
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/schema-parity.XXXXXX")
CLEANUP=auto
PG_ROLE=
PG_DB=
PG_PORT=

cleanup() {
  rc=$?
  if [ "$CLEANUP" = host ] && [ -n "$PG_DB" ]; then
    sudo -n -u postgres dropdb --if-exists --force -p "$PG_PORT" "$PG_DB" >/dev/null 2>&1 || true
    sudo -n -u postgres dropuser --if-exists -p "$PG_PORT" "$PG_ROLE" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT

say() { echo "schema-parity: $*"; }
die2() { echo "schema-parity: $*" >&2; exit 2; }

command -v bun >/dev/null 2>&1 || die2 "bun is required to run drizzle-kit"

# ---- 1. render the Drizzle schema to SQL -------------------------------------
[ -x node_modules/.bin/drizzle-kit ] || die2 "drizzle-kit is not installed; run bun install first"
say "rendering src/lib/db/schema.ts with drizzle-kit export"
DOTENV_CONFIG_QUIET=true node_modules/.bin/drizzle-kit export > "$WORK/schema.sql" 2>"$WORK/drizzle-kit.stderr" || { echo "schema-parity: drizzle-kit export failed:" >&2; cat "$WORK/drizzle-kit.stderr" >&2; exit 2; }
grep -q 'CREATE TABLE' "$WORK/schema.sql" || die2 "drizzle-kit export produced no CREATE TABLE statements; export looks broken"

# ---- 2. locate the atlas binary: override, PATH, then pinned download --------
ATLAS=${SCHEMA_PARITY_ATLAS:-}
if [ -z "$ATLAS" ] && command -v atlas >/dev/null 2>&1; then
  ATLAS=$(command -v atlas)
fi
if [ -z "$ATLAS" ]; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|amd64) : ;;
    *) die2 "no pinned atlas build for $ARCH; install atlas and set SCHEMA_PARITY_ATLAS" ;;
  esac
  ATLAS_VERSION=v1.3.0
  ATLAS_SHA256=cfc773e5b4e845bc01d680390c174648938a7f88bf30e5a2c83ae85217c21587
  CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/puzzled-atlas"
  ATLAS="$CACHE_DIR/atlas-$ATLAS_VERSION"
  if [ ! -x "$ATLAS" ] || ! echo "$ATLAS_SHA256  $ATLAS" | sha256sum -c - >/dev/null 2>&1; then
    say "downloading pinned atlas $ATLAS_VERSION (sha256-verified)"
    mkdir -p "$CACHE_DIR"
    curl -fsSL --retry 3 --retry-all-errors -o "$ATLAS.tmp" "https://release.ariga.io/atlas/atlas-linux-amd64-$ATLAS_VERSION" || die2 "atlas download failed; network required, or set SCHEMA_PARITY_ATLAS"
    echo "$ATLAS_SHA256  $ATLAS.tmp" | sha256sum -c - >/dev/null 2>&1 || die2 "atlas checksum mismatch; refusing the download"
    chmod +x "$ATLAS.tmp"
    mv "$ATLAS.tmp" "$ATLAS"
  fi
fi
"$ATLAS" version >/dev/null 2>&1 || die2 "atlas at $ATLAS is not runnable"

# ---- 3. resolve a disposable dev database ------------------------------------
DEV_URL=${SCHEMA_PARITY_DEV_URL:-}
if [ -z "$DEV_URL" ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    DEV_URL="docker://pgvector/pgvector/pg18/dev?search_path=public"
    say "dev database: docker (repo dev URL pgvector/pgvector:pg18)"
  elif command -v psql >/dev/null 2>&1 && sudo -n -u postgres psql -Atc 'select 1' >/dev/null 2>&1; then
    PG_PORT=$(sudo -n -u postgres psql -Atc 'SHOW port' | tr -d '[:space:]')
    [ -n "$PG_PORT" ] || die2 "host postgres did not report a port"
    PG_ROLE="pzparity_$$_$(date +%s)"
    PG_DB="$PG_ROLE"
    CLEANUP=host
    sudo -n -u postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -q -c "CREATE ROLE \"$PG_ROLE\" LOGIN PASSWORD 'pz_parity_only'" >/dev/null || die2 "could not create throwaway role on host postgres"
    sudo -n -u postgres createdb -p "$PG_PORT" -O "$PG_ROLE" "$PG_DB" || die2 "could not create throwaway database on host postgres"
    DEV_URL="postgresql://$PG_ROLE:pz_parity_only@127.0.0.1:$PG_PORT/$PG_DB?search_path=public"
    say "dev database: host postgres on port $PG_PORT (throwaway db $PG_DB)"
  else
    die2 "no dev database available; set SCHEMA_PARITY_DEV_URL=postgresql://... or provide docker/host postgres"
  fi
fi

# ---- 4. replay the migration directory on the dev db and diff vs the export ---
# The committed atlas/migrations is never touched: the diff works on a copy and
# its sum is recomputed there (the checksum gate is the migrations job, not this).
MIG_DIR="$WORK/migrations"
cp -r atlas/migrations "$MIG_DIR"
"$ATLAS" migrate hash --dir "file://$MIG_DIR" >/dev/null 2>&1 || true
BEFORE=$(cd "$MIG_DIR" && ls -1 *.sql | sort)
MIG_COUNT=$(echo "$BEFORE" | wc -l | tr -d ' ')
say "diffing $MIG_COUNT migration files against the exported schema"
set +e
DIFF_OUT=$("$ATLAS" migrate diff --dir "file://$MIG_DIR" --dev-url "$DEV_URL" --to "file://$WORK/schema.sql" parity-check 2>&1)
DIFF_RC=$?
set -e
if [ "$DIFF_RC" -ne 0 ]; then
  say "atlas migrate diff could not compute the diff (exit $DIFF_RC):"
  echo "$DIFF_OUT" >&2
  exit 1
fi
AFTER=$(cd "$MIG_DIR" && ls -1 *.sql | sort)
NEW_FILES=$(comm -13 <(echo "$BEFORE") <(echo "$AFTER"))
if [ -z "$NEW_FILES" ]; then
  say "OK: src/lib/db/schema.ts and atlas/migrations describe the same DDL"
  [ -n "$DIFF_OUT" ] && echo "$DIFF_OUT"
  exit 0
fi
say "DRIFT: src/lib/db/schema.ts and atlas/migrations disagree; atlas would emit:"
for f in $NEW_FILES; do
  echo "----- $f"
  cat "$MIG_DIR/$f"
done
exit 1
