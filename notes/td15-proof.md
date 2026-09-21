# TD-15 proof (base b199007999789d862ac236b94ba010b1c3ff18e1)

Tree: debt/td15-difficulty-vocab, worktree td15. Commands from apps/puzzled.
The proofs below ran on the working tree that is commit a3c5057 (code) plus notes.

## 1. Resolved message catalogue - before vs after (TD-01 tool)

Tool: scripts/i18n-resolved-catalogue.ts (dump / compare).
BEFORE: /data/sylphx/home/work/pz-program/td15/resolved-before (scratch, not committed)
AFTER:  /data/sylphx/home/work/pz-program/td15/resolved-after

sha256 per locale (before -> after):
- en-US 8562c8c2ddbe6b23056ceb5cc67f10cb99e8a5c166804b12d0ce5df84fa5f400 -> 456503377f602a568c3bacbde5047c15306dc9106cfb2581423b551d5744c050
- en-GB 9372c36664890ce0b72366fdbd48e725ce2f38129a7bc8d54a98c867532a8c67 -> a52daf6a3c754a2a162f6b98d8ec47bfb17f89c85df18ee89995af8d61ef1f50
- zh-HK 83f78a51f482defec159c56e8b364b6409a4de59c9784362e2a90eebd5edd7d8 -> baf3273e714fbf6e5559e53c841de04f40b2914365e7b29031272debd39d3d9d
- zh-TW 93db995c59b2cfb694b1914cfbc1dc484c48e71655b2d207e13833db0bb71820 -> cd5614ef8d21204c3d133c55680ef4b18e75a12dd89241cfab9e39e47ee59612
- zh-CN 983e7797ea12acc27c7d7be95d68d47992bb059542f04952e47a2b32660f1ce4 -> bb67a06ae919a5ab87ca58c3297516fc7111bf1a076ca07e003485592222971d

compare (first-difference gate, one diff reported per locale by design):
  DIFF en-US.common.difficulty.tricky
  DIFF en-GB.common.difficulty.tricky
  DIFF zh-HK.common.difficulty.easy
  DIFF zh-TW.common.difficulty.easy
  DIFF zh-CN.common.difficulty.easy
  DIFF-TOTAL: 5 of 5 locales differ

FULL delta (jq flat diff of the two dumps): 14 path-changes, nothing else in
2,723 -> 2,724 leaves x 5 locales:
  en-US: + common.difficulty.tricky = Tricky
  en-GB: + common.difficulty.tricky = Tricky   (inherited from en-US)
  zh-HK: + tricky=棘手 ; easy Easy->簡單 ; medium Medium->中等 ; hard Hard->困難
  zh-TW: the same four changes (inherited from zh-HK; zh-TW stays delta-free)
  zh-CN: + tricky=棘手 ; easy Easy->简单 ; medium Medium->中等 ; hard Hard->困难

String-level reading (card bar - identical values, or for dedup the same
user-visible string):
- +tricky en/en-GB: "Tricky" already resolved for this level (legend); it now
  resolves from the shared catalogue. Same string.
- zh label values: the same strings (簡單/中等/困難, 简单/中等/困难, 棘手) were
  already the concept's translated copy on the game layer (hero chips, legend);
  the shared catalogue now carries them so every surface reads one source.
  zh pickers adopt the translated strings (they showed the untranslated English
  placeholders before) - the one intentional user-visible change; called out in
  the PR; revert = the 3 values in zh-HK/zh-CN common.json.

## 2. Local gate (raw)

- Suite: env -u NODE_ENV bun run test -> 1149 pass / 6 skip / 0 fail,
  34,822 expect() calls, Ran 1155 tests across 117 files [110.14s], exit 0.
  (Host exports NODE_ENV=production; without the unset 4 getBaseUrl
  environment tests fail. CI runs the same lane with NODE_ENV=test.)
- Typecheck: bun run typecheck (tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json)
  exit 0.
- Lint: bun run lint (biome check .) -> "Checked 863 files in 477ms. No fixes
  applied." exit 0.
- Build: env NEXT_PUBLIC_APP_URL=https://puzzled.gg SKIP_ENV_VALIDATION=true
  bun run build -> exit 0. First attempt failed with TurbopackInternalError
  "Symlink [project]/apps/puzzled/node_modules is invalid, it points out of the
  filesystem root" (symlinked node_modules); after a real bun install (554
  packages, 2.87s) the identical command built green.

## 3. Mutation

notes/td15-mutation.md: swapping easy<->medium in DIFFICULTY_LEVELS reds exactly
the mapping test (4 pass / 1 fail, exit 1); restore -> 5 pass / 0 fail.

## 4. Merge order

git merge-tree --write-tree HEAD origin/debt/td10-dead-private-defs -> exit 0
(no conflicts; td10 deletes _ConnectionsHowToPlayTitle at lines 64-69 while this
change edits lines 1-62 of the same file). td16 (#172) touches
message-catalogue.test.ts only; td17 (#173) package.json only - no overlap.
