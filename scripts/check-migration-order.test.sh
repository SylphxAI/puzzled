#!/usr/bin/env bash
# Tests for check-migration-order.sh, run in throwaway git repositories: bash scripts/check-migration-order.test.sh
set -uo pipefail
S=$(cd "$(dirname "$0")" && pwd)/check-migration-order.sh
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
expect() { # name want-rc grep-pattern(optional) -- command output captured in $out
  local name=$1 want=$2 pat=${3:-}
  [ "$rc" = "$want" ] || { bad "$name (rc $rc, want $want): $out"; return; }
  if [ -n "$pat" ] && ! grep -q -- "$pat" <<<"$out"; then bad "$name (missing '$pat'): $out"; return; fi
  ok "$name"
}
g() { git -C "$R" -c user.email=t@t -c user.name=t "$@"; }
mk() { R=$T/$1; mkdir -p "$R/m"; git -C "$R" init -q -b main; touch "$R/m/20260101000000_a.sql" "$R/m/20260102000000_b.sql"; g add -A; g commit -qm base; g branch -q origin/main 2>/dev/null; g checkout -q -b topic; }
run() { out=$(cd "$R" && MIGRATION_BASE=main "$@" 2>&1); rc=$?; }

# Guard the workflow binding as well as the script: no mutable remote ref or authenticated fetch.
workflow="$(dirname "$S")/../.github/workflows/ci.yml"
grep -Fq 'PR_BASE: ${{ github.event.pull_request.base.sha }}' "$workflow" && ok "workflow binds event base" || bad "workflow binds event base"
grep -Fq 'export MIGRATION_BASE="$PR_BASE"' "$workflow" && ok "workflow uses immutable base" || bad "workflow uses immutable base"

mk newer; touch "$R/m/20260103000000_c.sql"; g add -A; g commit -qm c
run "$S" m; expect "newer version passes" 0 "migration order ok"

mk older; touch "$R/m/20260101120000_c.sql"; g add -A; g commit -qm c
run "$S" m; expect "version below main's newest fails" 1 "OUT OF ORDER"
grep -q "rename to m/" <<<"$out" && ok "names the next free version" || bad "names the next free version: $out"

mk dup; touch "$R/m/20260105000000_c.sql" "$R/m/20260105000000_d.sql"; g add -A; g commit -qm c
run "$S" m; expect "two files with one version fail" 1 "DUPLICATE VERSION"

mk none; touch "$R/other.txt"; g add -A; g commit -qm c
run "$S" m; expect "no added migrations passes" 0 "no added migrations"

# main moves on after the branch was cut: the branch's version is now below main's newest
mk moved; touch "$R/m/20260103000000_c.sql"; g add -A; g commit -qm c
g checkout -q main; touch "$R/m/20260104000000_x.sql"; g add -A; g commit -qm x; g checkout -q topic
run "$S" m; expect "main moving past the branch fails" 1 "OUT OF ORDER"

# CI uses immutable event SHAs, even without origin/main or persisted credentials.
mk immutable; base_sha=$(g rev-parse main); g branch -D origin/main >/dev/null
 touch "$R/m/20260103000000_c.sql"; g add -A; g commit -qm c
run env MIGRATION_BASE="$base_sha" "$S" m; expect "immutable event base without remote ref passes" 0 "migration order ok"
run env MIGRATION_BASE=missing-event-base "$S" m; expect "missing event base fails closed" 2 "no ref"

# open pull request collision, with a stub gh
mk coll; touch "$R/m/20260106000000_c.sql"; g add -A; g commit -qm c
mkdir -p "$T/bin"; cat > "$T/bin/gh" <<'G'
#!/usr/bin/env bash
case "$2" in
  repos/o/r/pulls\?*) echo 7 ;;
  repos/o/r/pulls/7/files*) echo "m/20260106000000_other.sql" ;;
  *) exit 1 ;;
esac
G
chmod +x "$T/bin/gh"
run env PATH="$T/bin:$PATH" PR_NUMBER=5 GH_REPO=o/r BASE_REF=main "$S" m; expect "version another open PR adds fails" 1 "COLLISION"
cat > "$T/bin/gh" <<'G'
#!/usr/bin/env bash
exit 1
G
run env PATH="$T/bin:$PATH" PR_NUMBER=5 GH_REPO=o/r BASE_REF=main "$S" m; expect "unreachable API warns and passes" 0 "warning"

[ $fails -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
