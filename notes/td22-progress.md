# TD-22 progress checkpoint

Branch: debt/td22-casts; head 1decd97; rebased onto origin/main d1fae28 after #175/#176/#177 merged (base of record fd9f061).
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-22.

## State (complete)
- Registry boundary re-typed to the opaque view; two `as any` at the call site gone; runtime unchanged (see notes/td22-before.md for the design + per-site map).
- Four owner sites de-casted: use-sound, redis, i18n request, auth-fields (commit 4877d54, rebased as da3e763).
- Gates green on 1decd97: unit suite 1176 pass / 0 fail; typecheck 2/2; lint exit 0; build + route assert exit 0 (notes/td22-proof.md).
- Mutation proof: M1 wrong submission -> TS2322; M2 consumer misuse -> TS2322 at head, green against old any boundary (notes/td22-mutation.md).
- Cast counts (non-test): `as any` 3 -> 1 (the remaining match is a comment's prose), `as unknown as` 5 -> 1 (skipped site).

## If resumed
- Next action: open the PR from debt/td22-casts (body draft: $HOME/work/td22-pr-body.md), or drain review comments if already open.
- Do not merge/enqueue; no force-push after the PR exists; keep the worktree until the queue lands it.

PR opened: https://github.com/SylphxAI/puzzled/pull/178 (head 7c8e5d7; CI will run on the final head)
