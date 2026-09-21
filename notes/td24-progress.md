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

## Recovery run 2 - normalisation + proofs done (2026-09-22 ~01:15 BST)

- Slice: "Copied to clipboard!" (share.copied -> common.copied; 4 sites + 3 bindings dropped) and "Sign out of this device" (settings.security.signOutHere -> settings.account.signOut; 1 site); keys deleted from en-US/zh-CN/zh-HK (en-GB/zh-TW inherit).
- Proof: resolved dumps differ by EXACTLY the 10 removed keys (2 x 5 locales; none added/changed; 2724 -> 2722 leaves per locale). Baseline 1169 -> 1159 via --update-baseline; staleness RED captured in between; check green after.
- Mutation proof: duplicate key added -> --check RED naming the group + suite 2 fail; reverted -> green + suite 6 pass.
- Fixed the byte-equality baseline test (0a34aae): biome pre-commit re-formats the JSON (short arrays inline), so it now compares parsed content (would otherwise fail CI).
- Commits pushed: 45660c7, d753378, 0a34aae. Evidence notes: td24-before.md, td24-proof.md, td24-mutation.md.
- Next: full gates (suite running; then typecheck/lint/build), then PR.

## Recovery run 2 - gates green (2026-09-22 ~00:05 BST)

- Gates on 2f88742: suite 1194 pass / 6 skip / 1 fail (schema-parity; no dev postgres - environmental, CI has the DB), lint rc=0 (875 files, 23 pre-existing infos), typecheck rc=0 forced-uncached (2 packages, 9.5s), build rc=0 (next build).
- Evidence: notes/td24-gates.md. PR next (drafted); will not enqueue.
