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


## Recovery run 2 (2026-09-21 ~23:58 BST, worker 2)

- Verified remote: origin/debt/td24-i18n-dupes = 6bbaba7 (pushed); origin/main = be3f6dc2.
- Worktree moved to $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td24f on debt/td24-i18n-dupes @ 6bbaba7
  (old td-24 worktree detached then removed; its node_modules/.turbo transplanted, so no reinstall needed).
- Plan: (1) re-run script modes + test in td24f to confirm state; (2) normalisation slice (share.copied,
  settings.security.signOutHere) with before/after resolved-catalogue dumps; (3) mutation proof (synthetic
  dupe -> RED naming group; remove -> green) + suite-wiring evidence; (4) full gates; (5) rebase onto
  be3f6dc2; push; open PR.
- Resume: read this file first; the pushed branch is the handover.

## Recovery run 2 - onto post-#178/#179 main (2026-09-22 ~00:35 BST)

- Merged origin/main (be3f6dc2) into debt/td24-i18n-dupes as 21e7f9d "chore(notes): keep the pre-#178/#179
  notes ref as a parent (no force-push; makes the remote update a fast-forward)" - the td10/td01 technique;
  conflict-free (#178/#179 touch no TD-24 file).
- Remote update was a fast-forward 2a8641c..21e7f9d; read back 21e7f9d7374fc087e4747129c8386779f360fd5c.
- Next: before-dump + --check on the merged tree; normalisation; mutation proof; gates; PR.
