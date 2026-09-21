# TD-01 proof: resolved-catalogue dumps (before/after)

Base revision: `26ddd42` (branch `debt/td01-message-overlays`, rebased on `d6a5f56` =
origin/main after #169). All commands run from `apps/puzzled`.

## Tool

`scripts/i18n-resolved-catalogue.ts` resolves every locale exactly like
`loadMessages` in `src/lib/i18n/request.ts` (which it does not import: Next-only
deps): the fallback from `LOCALE_REGISTRY`, the same `deepMerge`, the namespace
files on disk, then `resolveGameMessages(locale)` for the `games` namespace.

    bun run scripts/i18n-resolved-catalogue.ts dump --out <DIR>
    bun run scripts/i18n-resolved-catalogue.ts compare --before <DIR> --after <DIR>
    bun run scripts/i18n-resolved-catalogue.ts parity

## BEFORE dump (at `26ddd42`)

Destination: `$HOME/work/pz-program/notes/td01-before/`. Each locale dump is the
canonical (key-sorted) JSON of the resolved catalogue, so its sha256 is directly
comparable after the change. Counts are identical for all five locales:
2723 leaves (2685 strings, 38 arrays) in 32 namespaces.

| locale | sha256 |
| --- | --- |
| en-US | `8562c8c2ddbe6b23056ceb5cc67f10cb99e8a5c166804b12d0ce5df84fa5f400` |
| en-GB | `9372c36664890ce0b72366fdbd48e725ce2f38129a7bc8d54a98c867532a8c67` |
| zh-HK | `83f78a51f482defec159c56e8b364b6409a4de59c9784362e2a90eebd5edd7d8` |
| zh-TW | `93db995c59b2cfb694b1914cfbc1dc484c48e71655b2d207e13833db0bb71820` |
| zh-CN | `983e7797ea12acc27c7d7be95d68d47992bb059542f04952e47a2b32660f1ce4` |

Independent check: `sha256sum *.json` in the dump directory reproduces every hash
(and additionally hashes `manifest.json`).

## Collapse plan at the same revision (dry run, nothing written)

    bun run scripts/i18n-collapse-overlays.ts

Overlay locales are those with a declared fallback in `LOCALE_REGISTRY`: **en-GB**
(-> en-US) and **zh-TW** (-> zh-HK). zh-CN declares no fallback, so it is a base
locale and its files stay complete; giving it one would change runtime behaviour and
is out of scope for this PR. Full plan: `notes/td01-collapse-plan.txt`.

- en-GB: 31 files -> 7; the dropped keys sum to exactly the 28-key delta the
  register row measured (admin 2, auth 1, catalog 3, legal 4, pricing 2, settings
  12, support 4).
- zh-TW: 31 files -> 18.
- Whole catalogue: 155 files -> 118 files.

## Duplicate values re-measured (report only)

    bun run scripts/i18n-report-duplicate-values.ts --top 3

Definition is the register's own (`notes/td-audit/i18n-analyze.mjs`): flattened
`ns.path` values, strings of 2 chars or fewer ignored, arrays compared by JSON.

| locale | duplicated values | redundant occurrences |
| --- | --- | --- |
| en-US | 235 | 379 |
| en-GB | 235 | 379 |
| zh-HK | 170 | 222 |
| zh-TW | 170 | 222 |
| zh-CN | 172 | 225 |

The register row (measured at `e590b5c`) quotes 232 (en-GB) and 168 (zh-HK); the
delta is catalogue content added between that revision and this base in all five
locales (`admin.json` #169, `home.json`, `share.json`), not a definition change.

## Structure parity across locales (at `26ddd42`)

    bun run scripts/i18n-resolved-catalogue.ts parity

`PARITY-ZERO: every locale matches the en-US leaf structure` - so the permanent
guard can assert full parity for every locale and namespace, no exceptions to encode.
