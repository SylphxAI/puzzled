# TD-24 before-state: resolved duplicate baseline (tree of be3f6dc2 + baseline commit)

Measurement surface: `scripts/i18n-resolved-catalogue.ts` resolution — what the runtime serves (`resolveLocale`), `games` namespace excluded; every leaf value counts, including one/two-character tokens. A duplicate group = one value authored at two or more keys of one locale.

Counts (measured 2026-09-22, after merging origin/main be3f6dc2):

| locale | duplicate groups | same, with the audit's >2-char floor |
|--------|------------------|----------------------------------------|
| en-US  | 237              | 235                                    |
| en-GB  | 237              | 235                                    |
| zh-HK  | 230              | 170                                    |
| zh-TW  | 231              | 170                                    |
| zh-CN  | 234              | 172                                    |
| total  | 1169             | 982                                    |

Register cross-check (TD-24 row: "en-GB: 232 values under >=2 keys; zh-HK: 168"): those were pre-TD-01 raw-file numbers.
en-GB is a delta-only overlay now — its own files carry 28 flattened values and 0 duplicated ones; its duplicates exist only on the resolved surface (237; 235 with the floor, close to the register 232).
zh-HK still carries its full file set raw: 170 duplicated values with the floor (register 168; drift from merges after the register snapshot). The guard uses the resolved surface — the surface that serves users.

Pre-edit evidence (raw):
- `bun run scripts/i18n-report-duplicate-values.ts --check` -> `DUP-BASELINE-OK: 1169 recorded duplicate groups match the resolved catalogues` (rc=0)
- `bun run scripts/i18n-resolved-catalogue.ts dump --out $HOME/.td24-dumps/before-f`; 2724 leaves / 2686 strings / 32 namespaces per locale; sha256:
  - en-US 456503377f602a568c3bacbde5047c15306dc9106cfb2581423b551d5744c050
  - en-GB a52daf6a3c754a2a162f6b98d8ec47bfb17f89c85df18ee89995af8d61ef1f50
  - zh-HK baf3273e714fbf6e5559e53c841de04f40b2914365e7b29031272debd39d3d9d
  - zh-TW cd5614ef8d21204c3d133c55680ef4b18e75a12dd89241cfab9e39e47ee59612
  - zh-CN bb67a06ae919a5ab87ca58c3297516fc7111bf1a076ca07e003485592222971d
- `compare --before $HOME/.td24-dumps/before --after $HOME/.td24-dumps/before-f` -> `ZERO-DIFF: all 5 locales identical` (byte-stable across runs/hosts).
