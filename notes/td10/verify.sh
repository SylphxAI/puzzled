#!/usr/bin/env bash
# TD-10 verify v2: per-name liveness on merged tree (post-#169). Resume-safe.
set -u
WT=/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td-10
NS=/data/sylphx/home/work/pz-program/notes
cd "$WT" || exit 1
OUT="$NS/td10-verify-v2.tsv"
DET="$NS/td10-verify-v2-details.txt"
SGL="$NS/td10-single-occ-v2.tsv"
LOG="$NS/td10-verify-v2.log"
EX="$NS/td10-verify-v2-extras.tsv"
echo "START $(date -u +%H:%M:%S)" >> "$LOG"
i=0
while IFS= read -r name; do
  [ -z "$name" ] && continue
  i=$((i+1))
  if grep -qF "$(printf '%s\t' "$name")" "$OUT" 2>/dev/null; then continue; fi
  cw=0
  for try in 1 2 3; do
    rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$name" . > /tmp/v2w.txt 2>/dev/null
    cw=$(wc -l < /tmp/v2w.txt)
    if [ "$cw" != "0" ]; then break; fi
    echo "retry $name try=$try cw=0" >> "$LOG"
    sleep 4
  done
  if [ "$cw" = "0" ]; then echo "!! ZERO $name" >> "$LOG"; fi
  bare="${name#_}"
  rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$bare" . > /tmp/v2b.txt 2>/dev/null
  cb=$(wc -l < /tmp/v2b.txt)
  printf '%s\t%s\t%s\n' "$name" "$cw" "$cb" >> "$OUT"
  if [ "$cw" = "1" ]; then head -1 /tmp/v2w.txt >> "$SGL"; fi
  if [ "$cw" != "1" ] || [ "$cb" != "0" ]; then
    { echo "### $name (cw=$cw cb=$cb)"; echo '--with--'; head -14 /tmp/v2w.txt; echo '--bare--'; head -14 /tmp/v2b.txt; echo; } >> "$DET"
  fi
  if [ $((i % 20)) -eq 0 ]; then echo "progress $i $(date -u +%H:%M:%S)" >> "$LOG"; fi
done < "$NS/td10-names-v2.txt"
echo "VERIFY2_DONE names=$i $(date -u +%H:%M:%S)" >> "$LOG"
for name in _adminSecretLimiter _totalWinsToday _locale _aiClient _dictionary _wordCounts _redis _rateLimiter _pool _db; do
  if grep -qF "$(printf '%s\t' "$name")" "$EX" 2>/dev/null; then continue; fi
  rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$name" . > /tmp/v2w.txt 2>/dev/null; cw=$(wc -l < /tmp/v2w.txt)
  bare="${name#_}"
  rg -n -w --no-heading -g '!node_modules/**' -g '!notes/**' -g '!.next/**' -e "$bare" . > /tmp/v2b.txt 2>/dev/null; cb=$(wc -l < /tmp/v2b.txt)
  printf '%s\t%s\t%s\n' "$name" "$cw" "$cb" >> "$EX"
done
echo "EXTRAS_DONE $(date -u +%H:%M:%S)" >> "$LOG"