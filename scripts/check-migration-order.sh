#!/usr/bin/env bash
# Migration version guard: a migration this change ADDS must sort above every version already on the base branch
# in the same directory (Atlas applies linearly and refuses an older file at deploy), must not share a version
# with another file in the directory, and must not take a version another open pull request already adds.
# Every error names the next free version, so the fix is one rename.
#
#   scripts/check-migration-order.sh <migrations-dir>...
#
# Environment:
#   MIGRATION_BASE  base ref or sha to compare with (default origin/main). On a pull request CI passes the fetched
#                   origin/<base branch>; in a merge group, the queue's base sha.
#   PR_NUMBER, GH_REPO, GH_TOKEN  when all are set (and gh is installed) a version added by another open, non-draft
#                   pull request into the same base is a collision. An unreachable API warns and skips only this check.
# Exit: 0 clean, 1 a migration breaks a rule, 2 usage / unknown base.
set -uo pipefail

[ $# -ge 1 ] || { echo "usage: check-migration-order.sh <migrations-dir>..."; exit 2; }
base=${MIGRATION_BASE:-origin/main}
git rev-parse --verify -q "${base}^{commit}" >/dev/null || { echo "check-migration-order: no ref $base"; exit 2; }
mb=$(git merge-base "$base" HEAD) || { echo "check-migration-order: no merge base with $base (shallow clone?)"; exit 2; }

ver() { basename "$1" | grep -oE '^[0-9]+' || true; }
vers_at() { git ls-tree --name-only "$1" -- "$2/" 2>/dev/null | while read -r f; do case "$f" in *.sql) ver "$f" ;; esac; done; }
max_of() { local m=0 v; for v in "$@"; do [ -n "$v" ] && [ $((10#$v)) -gt $((10#$m)) ] && m=$v; done; echo "$m"; }
# next free version above $1; a timestamp store takes the clock when it is ahead, a counter store takes +1 (width kept)
next_free() {
  local top=$1 w=${#1} now
  if [ "$w" -ge 12 ]; then now=$(date -u +%Y%m%d%H%M%S); [ $((10#$now)) -gt $((10#$top)) ] && { echo "$now"; return; }; fi
  printf "%0${w}d\n" $((10#$top + 1))
}

others=()  # "pr<TAB>path" lines of files other open pull requests add
if [ -n "${PR_NUMBER:-}" ] && [ -n "${GH_REPO:-}" ] && command -v gh >/dev/null 2>&1; then
  if prs=$(gh api "repos/$GH_REPO/pulls?state=open&per_page=100" --jq ".[] | select(.draft|not) | select(.number != $PR_NUMBER) | select(.base.ref == \"${BASE_REF:-main}\") | .number" 2>/dev/null); then
    for n in $prs; do
      if files=$(gh api "repos/$GH_REPO/pulls/$n/files?per_page=100" --jq '.[] | select(.status == "added") | .filename' 2>/dev/null); then
        while IFS= read -r f; do [ -n "$f" ] && others+=("$n	$f"); done <<<"$files"
      else echo "warning: could not list files of PR #$n; its migrations are not compared"; fi
    done
  else echo "warning: GitHub API unreachable; the open pull request collision check is skipped"; fi
fi

rc=0
for dir in "$@"; do
  dir=${dir%/}
  added=$(git diff --name-only --diff-filter=A "$mb" HEAD -- "$dir/" | grep -E '\.sql$' | grep -E "^$dir/[^/]+$" || true)
  [ -n "$added" ] || { echo "$dir: no added migrations"; continue; }
  base_vers=$(vers_at "$base" "$dir"); newest=$(max_of $base_vers)
  claimed=$(printf '%s\n' "${others[@]:-}" | awk -F'\t' -v d="$dir/" 'index($2, d) == 1 {n=$2; sub(".*/","",n); if (match(n,/^[0-9]+/)) print substr(n,RSTART,RLENGTH)}')
  top=$(max_of $newest $claimed $(for f in $added; do ver "$f"; done))
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    v=$(ver "$f"); slug=$(basename "$f" | sed -E 's/^[0-9]+_?//')
    if [ -z "$v" ]; then echo "BAD NAME: $f has no leading version digits"; rc=1; continue; fi
    nf=$(next_free "$top")
    if [ $((10#$v)) -le $((10#$newest)) ]; then
      echo "OUT OF ORDER: $f (version $v) is not above $base's newest $newest in $dir: rename to $dir/${nf}_${slug}"; rc=1
    fi
    twins=$(git ls-tree --name-only HEAD -- "$dir/" | while read -r t; do [ "$t" != "$f" ] && [ "$(ver "$t")" = "$v" ] && echo "$t"; done)
    if [ -n "$twins" ]; then echo "DUPLICATE VERSION: $f shares version $v with $(echo $twins): rename to $dir/${nf}_${slug}"; rc=1; fi
    hit=$(printf '%s\n' "${others[@]:-}" | awk -F'\t' -v d="$dir/" -v v="$v" 'index($2, d) == 1 {n=$2; sub(".*/","",n); if (match(n,/^[0-9]+/) && substr(n,RSTART,RLENGTH)+0 == v+0) print "#" $1}' | sort -u | tr '\n' ' ')
    if [ -n "$hit" ]; then echo "COLLISION: $f (version $v) is also added by open pull request $hit: the second to merge fails at deploy; rename to $dir/${nf}_${slug}"; rc=1; fi
  done <<<"$added"
done
[ $rc -eq 0 ] && echo "migration order ok vs $base"
exit $rc
