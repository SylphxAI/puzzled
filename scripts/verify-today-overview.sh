#!/usr/bin/env bash
# Isolated migrated Postgres plus the Rust checks used for overview changes.
# Runs on an existing build machine; never uses an external database or TCP port.
set -euo pipefail
mkdir -p verification/today-overview
exec > >(tee verification/today-overview/checks.log) 2>&1
printf 'started_at='; date -u +%Y-%m-%dT%H:%M:%SZ
pg_bin=${PG_BIN:-/usr/lib/postgresql/18/bin}
test -x "$pg_bin/initdb"
pgdata=$(mktemp -d "$PWD/.overview-pg.XXXXXX")
pg_run=()
if test "$(id -u)" = 0; then
  chown postgres "$pgdata"
  pg_run=(runuser -u postgres --)
fi
"${pg_run[@]}" "$pg_bin/initdb" -D "$pgdata/data" -U postgres --auth=trust --locale=C --encoding=UTF8 > "$pgdata/init.log"
"${pg_run[@]}" "$pg_bin/pg_ctl" -D "$pgdata/data" -o "-p 55487 -k $pgdata -h '' -c fsync=off -c synchronous_commit=off -c full_page_writes=off" -l "$pgdata/postgres.log" -w start
cleanup() {
  "${pg_run[@]}" "$pg_bin/pg_ctl" -D "$pgdata/data" -m fast -w stop
  rm -rf "$pgdata"
}
trap cleanup EXIT
export PUZZLED_TEST_DATABASE_URL="postgresql://postgres@localhost:55487/postgres?host=$pgdata&sslmode=disable"
export PUZZLED_REQUIRE_DB_TESTS=1
cargo fmt --all --check
cargo test -p puzzled-server overview --lib -- --nocapture
cargo clippy -p puzzled-core -p puzzled-server -- -D warnings -A clippy::double_parens -A clippy::too_many_arguments
cargo test -p puzzled-core -p puzzled-server
printf 'completed_at='; date -u +%Y-%m-%dT%H:%M:%SZ
