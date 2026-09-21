# TD-18 mutation proof - the client-authority tests bite

Recipe (throwaway copy at /data/sylphx/home/work/pz-program/td18/mut-copy: a real
copy of apps/puzzled with node_modules symlinked to the worktree, so the worktree
gate never reads a mutated tree):

  tar -C <worktree>/apps/puzzled -cf - src tests package.json tsconfig.json tsconfig.e2e.json bunfig.toml | tar -C <copy>/apps/puzzled -xf -
  ln -s <worktree>/apps/puzzled/node_modules <copy>/apps/puzzled/node_modules
  cp <worktree>/apps/puzzled/src/lib/identity/react.tsx <copy>/.../react.tsx.fixed-backup

Mutation: flip the client authority back - useBilling resolves its own copy again
(useState store + fetch('/api/identity/billing') on mount) instead of reading the
server-threaded snapshot from BillingContext. This is the removed TD-18 shape,
restored verbatim.

Raw (cd <copy>/apps/puzzled; env -u NODE_ENV SKIP_ENV_VALIDATION=true bun test
src/lib/identity/react.test.ts src/features/monitoring/components/session-replay-provider.billing.test.ts src/lib/billing/server.test.ts):

  mutated:   7 pass / 6 fail, exit 1 (MUT-EXIT=1)
    (fail) billing chrome reads the server-resolved entitlement > renders Premium and the plan from the server snapshot
    (fail) billing chrome reads the server-resolved entitlement > renders Free Plan from a free snapshot and when no snapshot was threaded
    (fail) billing chrome reads the server-resolved entitlement > the snapshot is the only source: a premium claim from anywhere else cannot flip free
    (fail) billing chrome reads the server-resolved entitlement > the hook exposes the snapshot as data on entitled renders too
    (fail) the pricing gate reads the server-resolved entitlement > an entitled viewer keeps the current-plan state
    (fail) replay sampling follows the server-resolved entitlement > a server-entitled viewer is sampled at the premium rate
  restored:  13 pass / 0 fail, 26 expect() calls, exit 0 (GREEN-EXIT=0)

Restore was by copying react.tsx.fixed-backup over the mutated file (not git
checkout), so no uncommitted work could be dropped. The worktree stayed untouched
throughout: its git status --porcelain lists only this change's 8 modified files
and 4 new ones; the mutation lived in the copy.

Why the six go red: with the client store restored, the first paint renders
'Loading billing...' / free (the store's initial state), the pricing gate loses
the current-plan state, and the replay sampling decision falls back to the
default rate - exactly the mismatch where the chrome no longer states the
server's verdict. The server-side test file stays green: the mutation only
flips the client authority, which is the point.
