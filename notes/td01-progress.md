# TD-01 - message-catalogue overlays: progress log

Worker is recovery-tolerant: state after every step lands here and in `notes/td01-proof.md`;
commit into the branch and push (explicit refspec, read back via ls-remote).

## State @ 2026-09-21 ~04:10 BST
- Worktree: `$HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td01`; branch `debt/td01-message-overlays`.
- Base: origin/main `d6a5f56` (post-#169). HEAD: `a27b0fe` (conversion commit) + uncommitted: 2 feature-test
  adaptations, resolver warning fix, evidence notes (about to commit).
- PR #169 (`debt/td06-admin-audit`) landed while this job started; branch was rebased onto it before any
  work (no stale base), per company law.

## Done
- RECON: request.ts/config.ts; fallback chain en-US(null) | en-GB->en-US | zh-HK(null) | zh-TW->zh-HK |
  zh-CN(null). Overlays = en-GB, zh-TW only; zh-CN is a base (register row's zh-CN-over-zh-HK idea would
  change behaviour; out of scope).
- Tools shipped: `scripts/i18n-resolved-catalogue.ts` (dump/compare/parity, mechanical replication of
  loadMessages), `scripts/i18n-collapse-overlays.ts` (collapse + self-proof + request.ts sync),
  `scripts/i18n-report-duplicate-values.ts` (register definition).
- BEFORE dump at 26ddd42: 2723 leaves x 32 namespaces each locale; hashes in `notes/td01-proof.md`.
- Conversion applied: 155 -> 118 files (37 deleted, 25 collapsed); request.ts pruned 74 lines;
  LOCALE_MESSAGES = Partial; en-GB kept 7 files, zh-TW kept 18.
- ZERO-DIFF proof: all 5 locales byte-identical (compare prints EQUAL x5, ZERO-DIFF); after-hashes equal
  before-hashes.
- Tests: 4 catalogue readers resolved (difficulty-copy, share-card-copy, notification-preferences.a11y) +
  2 fs readers missed by the first grep, found by the failing suite and adapted (home-faq.test.ts,
  catalog-messages.test.ts - both under src/features but test-only). Guard added:
  `src/lib/i18n/message-catalogue.test.ts` (imports-vs-disk, delta-only overlays, structure parity).
- Mutation proofs (raw in `notes/td01-mutations.txt`): redundant overlay value -> guard fail naming
  en-GB/settings.json; extra key -> fail naming zh-TW/nav; dead import -> fail naming admin-panel.json;
  each restored -> 3 pass / 0 fail, `git status --porcelain` clean.
- Full suite: 1141 pass / 6 skip / 0 fail (1147 tests, 116 files, 114.65s) - `notes/td01-tests-full2.txt`.
- typecheck RC=0 (both tsconfigs); lint RC=0 (23 pre-existing infos, 0 errors).
- Duplicates report: `notes/td01-duplicates.txt` (235/235/170/170/172 vs register 232/168 at e590b5c).

## PR
- **#170** https://github.com/SylphxAI/puzzled/pull/170 - head `845b4b8`, 78 files, +1240/-5771, base main.

## Next actions
1. Watch CI on #170 (`notes/td01-ci-watch.txt`). If red, root-cause from the run log and fix in place.
2. Independent review (author cannot self-review); orchestrator lane per company procedure.
3. Build RC=0; document-route RC=0 (`notes/td01-document-route.txt`).
