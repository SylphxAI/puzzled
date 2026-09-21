# TD-22 progress checkpoint

Branch: debt/td22-casts (worktree $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-22), base origin/main fd9f061.

## Done (this checkpoint)
- Before-map written: notes/td22-before.md (6 code sites measured; register's "12" not reproducible).
- Registry boundary re-typed: `RegisteredGameConfig = GameConfig<unknown, unknown, unknown, unknown>`;
  `validateGuess`/`validateAndScore` converted to (bivariant) method syntax; `getGameConfig`/`getAllGames`/`GameRegistry` use the alias;
  call site `config.validateAndScore(solution, puzzleData, submission)` - casts gone. Runtime behaviour unchanged.
- Four owner sites de-casted: use-sound.ts (Window augmentation), lib/redis.ts (parse into `unknown`, single `as T`), lib/i18n/request.ts (cast removed), auth-fields.tsx (annotated assignment).
- Extra casts seen: registry.ts had two `as any` on the one line; all removed.
- Typecheck green (`turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui`, tsc 5.9.3): both packages pass (12.9s).
- Biome green on the six edited files.

## Next (exact next action)
1. Full unit suite: `cd apps/puzzled && env -u NODE_ENV NODE_ENV=test DATABASE_URL='postgresql://test:test@localhost:5432/test' SKIP_ENV_VALIDATION=true bun run test:unit` -> log `$HOME/work/td22-unit.log`.
2. Repo-wide biome: `bun run lint` (apps/puzzled).
3. Production build: `SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build` in apps/puzzled -> `$HOME/work/td22-build.log`; then `node scripts/assert-document-route.mjs`.
4. Mutation proof in scratch copy (never the worktree): wrong submission type at the boundary -> typecheck RED; `result.solution` consumed as `string` -> RED at head, and the same consumer against origin/main types/registry -> GREEN (old `any` erased it). Raw output to notes.
5. PR body + open PR (#, head sha). Do not merge/enqueue.
