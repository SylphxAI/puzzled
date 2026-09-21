# TD-24 progress (i18n duplicate authoring)

Status: 2026-09-21 ~11:40 BST. Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-24, branch debt/td24-i18n-dupes off origin/main d1fae285.

## Done
- Extended `apps/puzzled/scripts/i18n-report-duplicate-values.ts` with resolved-catalogue duplicate groups (games namespace excluded), a baseline file `scripts/i18n-dupe-baseline.json` (1169 groups), `--check` / `--update-baseline` / `--resolved --tsv` modes, and a t() reference classifier.
- New test `src/lib/i18n/duplicate-values.test.ts` (baseline + diff mechanics + classifier) - 6 pass.
- Baseline generated: en-US/en-GB 237 groups, zh-HK 230, zh-TW 231, zh-CN 234 (messages scope; counts incl. short tokens).

## Next action
- Normalisation slice: (1) `share.copied` -> repoint 4 game sites to `tCommon('copied')`, delete share.json root `copied` from en-US/zh-CN/zh-HK; (2) `settings.security.signOutHere` -> repoint security-client.tsx:138 to `settings.account.signOut`, delete the key from en-US/zh-CN/zh-HK settings.json. Then regenerate baseline, dump before/after resolved catalogues (sha256 + leaf diff), mutation proof, suite/typecheck/biome/build, PR.

## Environment notes
- Full unit suite on this host: 1181 pass / 6 skip / 1 fail - the fail is `schema/migration parity` needing a dev postgres (docker daemon down, sudo blocked); reproduced identically at base d1fae28 (worktree td24-base). CI provides the DB.

