#!/usr/bin/env python3
"""TD-03 normalised comparison re-check (recovery run, 2026-09-21).

Normalises exactly the three token classes recorded by the authoring run and
compares capture pairs on the stored captures:
  1. /_next/static/<...> asset paths -> /_next/static/X
  2. the RSC build id  (backslash) "b":(backslash) "..." -> X
  3. fetchedAt timestamps -> X

Usage: cd <captures dir> && python3 td03-normalize-recheck.py
"""
import os
import re
import sys


def norm(s):
    s = re.sub(r'/_next/static/[^"\\\s]+', '/_next/static/X', s)
    s = re.sub(r'\\"b\\":\\"[A-Za-z0-9_\-]{6,}\\"', lambda m: '\\"b\\":\\"X\\"', s)
    s = re.sub(r'"b":"[A-Za-z0-9_\-]{6,}"', lambda m: '"b":"X"', s)
    s = re.sub(r'fetchedAt\\":\\"[^\\"]*\\"', lambda m: 'fetchedAt\\":\\"X\\"', s)
    s = re.sub(r'fetchedAt":"[^"]*"', lambda m: 'fetchedAt":"X"', s)
    return s


def compare(da, db, label):
    files = [f for f in sorted(os.listdir(da)) if os.path.isfile(os.path.join(da, f))]
    raw_d = []
    nd = []
    for f in files:
        A = open(os.path.join(da, f), encoding='utf-8', errors='replace').read()
        B = open(os.path.join(db, f), encoding='utf-8', errors='replace').read()
        if A != B:
            raw_d.append(f)
        if norm(A) != norm(B):
            nd.append(f)
    print('%s: files=%d raw_differ=%d normalised_differ=%d %s' % (label, len(files), len(raw_d), len(nd), nd[:8]))
    return nd


if __name__ == '__main__':
    print('td03 normalise-recheck (3 recorded token classes), run 2026-09-21')
    d1 = compare('td03-before', 'td03-after', 'BASE vs TD-03')
    d2 = compare('td03-after', 'td03-after2', 'control/TD-03 twice')
    d3 = compare('td03-norm-before', 'td03-norm-after', 'normdirs BASE vs TD-03')
    print('VERDICT:', 'all pairs identical after normalisation' if (not d1 and not d2 and not d3) else 'RESIDUAL DIFFS')
    sys.exit(0 if (not d1 and not d2) else 1)
