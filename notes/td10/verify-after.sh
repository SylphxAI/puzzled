#!/usr/bin/env bash
set -u
W=/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td-10
N=/data/sylphx/home/work/pz-program/notes
cd "$W" || exit 1
OUT="$N/td10-verify-after.tsv"; LOG="$N/td10-verify-after.log"
echo START $(date -u +%H:%M:%S) > "$LOG"
: > "$OUT"
i=0
while IFS= read -r name; do
  [ -z "$name" ] && continue
  i=$((i+1))
  rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$name" . > /tmp/vaw.txt 2>/dev/null; cw=$(wc -l < /tmp/vaw.txt)
  bare="${name#_}"
  rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$bare" . > /tmp/vab.txt 2>/dev/null; cb=$(wc -l < /tmp/vab.txt)
  printf '%s\t%s\t%s\n' "$name" "$cw" "$cb" >> "$OUT"
done < "$N/td10-names-v2.txt"
echo VERIFY_AFTER_DONE names=$i $(date -u +%H:%M:%S) >> "$LOG"