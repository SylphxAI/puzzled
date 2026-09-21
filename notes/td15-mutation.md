# TD-15 mutation proof - the numeric mapping test bites

Recipe (throwaway copy under /data/sylphx/home/work/pz-program/td15/mut-copy -
a real copy with symlinked node_modules, so the worktree gate kept reading the
unmutated tree):

  tar -C <worktree>/apps/puzzled -cf - src scripts package.json tsconfig.json tsconfig.e2e.json | tar -C <copy>/apps/puzzled -xf -
  ln -s <worktree>/node_modules <copy>/node_modules
  ln -s <worktree>/apps/puzzled/node_modules <copy>/apps/puzzled/node_modules

Mutation: swap one level in the helper's enum -
  ['easy', 'medium', 'hard', 'tricky'] -> ['medium', 'easy', 'hard', 'tricky']

Raw:
  baseline (copy, unmutated): 5 pass / 0 fail, 739 expect() calls [171ms], exit 0
  mutated:                    4 pass / 1 fail, 679 expect() calls [204ms], exit 1
    (fail) difficulty copy: every declared key resolves in every locale > the numeric legend index maps onto the shared vocabulary [10.97ms]
  restored:                   5 pass / 0 fail, 739 expect() calls [184ms], exit 0

The failing test is the one that pins the numeric legend index -> common.difficulty.*
mapping and the enum order. Restore verified on disk:
  DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'tricky']
