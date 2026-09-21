# TD-16 - messages registry guard: progress log

Recovery-tolerant worker: state after every step lands here and in
`notes/td16-mutations.txt`; commit into the branch and push (explicit refspec,
read the ref back with ls-remote).

## State @ 2026-09-21 ~05:25 BST
- Worktree: `$HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-16`;
  branch `debt/td16-messages-guard`, based on origin/main `b1990079` (TD-01 #170).
- Guard extended, test-only; request.ts untouched.

## Existence check (rigorous)
TD-01 (#170) already shipped a guard: `src/lib/i18n/message-catalogue.test.ts`,
three invariants - (1) request.ts import specifiers vs files on disk, (2) overlay
files delta-only via the collapse tool, (3) resolved leaf-structure parity vs
en-US. All three pass at base and are kept.

Gap found, reproduced before touching the test (raw: notes/td16-mutations.txt,
G1/G2): nothing checked that the imports are wired into `LOCALE_MESSAGES`, the
map the runtime actually reads. A dropped entry or a swapped wiring keeps all
three invariants green (G2 is also lint- and typecheck-clean), so a message file
on disk could still silently miss - or mis-serve - the catalogue. TD-16 closes
exactly that.

## Done
- New helpers `requestImports()` (binding + specifier) and `registryEntries()`
  (LOCALE_MESSAGES rows); two new tests: every import wired exactly once at its
  own locale + namespace-key (and no stray rows / no unwired rows), plus the map
  holds exactly the files on disk per locale.
  At base: 5 pass / 0 fail, 19 expect() calls; biome clean (0 errors).
- Mutation battery M1..M6: each red on the extended guard, green after restore;
  worktree clean afterwards (`git status --porcelain`: only the test file).
- Full suite: `env -u NODE_ENV bun test src` -> 1143 pass / 6 skip / 0 fail; 34674 expect() calls; 1149 tests / 116 files in 105.26s (rc=0). TD-01 was 1141/6/0 over 1147 tests; the +2 are the new wiring tests.
- typecheck: `turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui` -> 2/2 successful (puzzled: tsc --noEmit + e2e tsconfig; ui: cache hit), 12.8s, rc=0 | biome (bun run lint): rc=0, 23 pre-existing infos, 0 errors
- PR: #172 https://github.com/SylphxAI/puzzled/pull/172 (head a5fe751 at open)
- CI run 35559188280 (head a5fe751): 9/9 jobs pass - Lint & Type Check 45s, Security Scan 24s, Migration Integrity 11s, Unit Tests 1m48s, Rust API 1m52s, Build 2m32s, SEO Contract 1m22s, Accessibility 3m58s, Lighthouse Budgets 7m32s; watch-rc=0.

## Next actions
1. Independent review (author cannot self-review) per company procedure.
2. After review: land via the merge queue; clean up this worktree once merged.