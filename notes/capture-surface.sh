#!/bin/sh
# Capture the served surface for the TD-03 byte-identical proof.
# usage: capture-surface.sh <base-url> <out-dir>
set -e
BASE=$1
OUT=$2
mkdir -p "$OUT"
CAP() {
  name=$1; path=$2
  code=$(curl -sS --max-time 30 -H 'Accept-Encoding: identity' -H 'User-Agent: td03-capture/1.0' -o "$OUT/$name.html" -w '%{http_code}' "$BASE$path")
  printf '%s %s\n' "$code" "$path"
}
CAP home /
CAP home_enGB /en-GB
CAP home_zhHK /zh-HK
CAP home_zhCN /zh-CN
CAP games /games
CAP games_zhCN /zh-CN/games
CAP games_enGB /en-GB/games
CAP game_blockslide /games/block-slide
CAP game_crossword /games/crossword
CAP game_wordguess /games/word-guess
CAP game_nonogram /games/nonogram
CAP game_crossword_zhHK /zh-HK/games/crossword
CAP sitemap /sitemap.xml
CAP robots /robots.txt
CAP stats /stats
CAP archive /archive
CAP leaderboard /leaderboard
CAP pricing /pricing

