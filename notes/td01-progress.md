# TD-01 - message-catalogue overlays: progress log

Worker is recovery-tolerant: update this file after every step; committed copies live at
`notes/td01-progress.md` on branch `debt/td01-message-overlays` (push each step).

## State @ 2026-09-21 ~03:55 BST
- Worktree: `$HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td01`
- Branch: `debt/td01-message-overlays`, based on origin/main `976210e` (fetched 2026-09-21 03:37 BST); no prior td01 branch existed (ls-remote empty).
- Host notes: `$HOME/work/pz-program/notes/td01-progress.md`. Host env: NODE_ENV=production exported; tests as `env -u NODE_ENV bun test ...`; git/gh prefixed `env -u GH_TOKEN -u GITHUB_TOKEN`.

## WAITING ON (before conversion starts)
- PR #169 `debt/td06-admin-audit` edits `apps/puzzled/src/messages/*/admin.json` (all 5 locales; +2 -1 each) and is in the merge queue (orchestrator note 03:35: AWAITING_CHECKS pos 1). Company law: branch off the post-#169 main, never stack on a moving base.
- Background watcher polls `gh pr view 169 --json state,mergedAt` every 60s (bounded 90 min).

## Done
- RECON: request.ts (446 lines) + config.ts (189 lines) read. Fallback chain from LOCALE_REGISTRY: en-US(null) | en-GB->en-US | zh-HK(null) | zh-TW->zh-HK | zh-CN(null).
  => Overlay locales per the ACTUAL chain: ONLY en-GB (over en-US) and zh-TW (over zh-HK). zh-CN is a base (fallback null) - its files must stay complete; the register row's 'zh-CN overlay over zh-HK' would need a fallback change = behaviour change, out of scope.
- loadMessages = deepMerge({...fallbackMessages}, localeMessages); games namespace added via resolveGameMessages (untouched).
- Consumers of messages/**: request.ts explicit imports; `player-facing-identity.test.ts` (scans whole src/messages tree; asserts >=1 entry per locale dir); `share-card-copy.test.ts`, `difficulty-copy.test.ts` (shallow spread - must become deep merge), `notification-preferences.a11y.test.ts` (raw catalogues - must become resolved). No existing messages key-parity guard found.
- Proof-tool feasibility: bun CAN import `src/lib/i18n/game-messages.ts` (21 keys for en-GB) => the dump can include the games namespace = exactly loadMessages.
- Duplicate-value probe (leaf strings, raw files, value at >=2 paths): en-GB 237, zh-HK 230, zh-TW 231, zh-CN 234, en-US 237. Register (e590b5c) said 232/168 with unknown definition - ours will be defined precisely in the script.
- Preflight: only other open PR = #153 (s2/quality-gates; no messages files).

## Next actions (in order)
1. (when #169 merges) fetch origin main; rebase branch onto new origin/main (no commits yet).
2. Write scripts: `apps/puzzled/scripts/i18n-resolved-catalogue.ts` (dump/compare), `apps/puzzled/scripts/i18n-report-duplicate-values.ts`, `apps/puzzled/scripts/i18n-collapse-overlays.ts` (conversion + self-verify).
3. BEFORE dump -> `$HOME/work/pz-program/notes/td01-before/<locale>.json` + sha256 per locale; commit scripts + proof note.
4. Convert overlays; delete empty files; update request.ts imports + partial type.
5. AFTER dump + comparator: expect zero diffs (prints first differing path on failure); quote counts.
6. Adapt 3 tests to resolved catalogues; add guard `src/lib/i18n/message-catalogue.test.ts` (import-list vs disk; resolved structure parity per namespace vs en-US; encode exceptions w/ comments if base shows divergences).
7. Guard mutation proof: break one overlay key -> red; restore -> green.
8. Duplicates report output into notes.
9. Gates: `env -u NODE_ENV bun test src`; typecheck; biome; `SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build`.
10. Push each step (explicit refspec heads, read back via ls-remote). PR: before/after counts, zero-diff proof, guard+mutation evidence.
