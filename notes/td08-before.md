# TD-08 before-map (base be3f6dc, origin/main after #178/#179)

Measured on the fetched base:

```
$ git rev-parse HEAD
be3f6dc2b4f486f07ef45752fb12b07669a3815f
```

(be3f6dc refactor(billing) TD-18 (#179); 08d737c refactor(types) TD-22 (#178).)
Paths relative to `apps/puzzled/`. Suite lane on this base: see `notes/td08-proof.md`.

## Two hand-written query surfaces for the same Connect reads

- `lib/api/server.ts` (361 lines) — one `cache()`d async accessor per endpoint for
  server components; each builds the per-request cookie-forwarding Connect
  transport (`getServerTransport`) and hand-maps the generated response.
- `lib/api/hooks.ts` (1,028 lines) — client react-query hooks; the same reads
  arrive through `lib/connect/*` admission clients (`admitGetDailyViaConnect`,
  `stats-client.getUserStats`) with a second hand-written mapping.

Overlap on this base:

| RPC read | server accessor | client surface | second surface? |
| --- | --- | --- | --- |
| PuzzleService.GetDaily -> DailyStatus | `getServerDailyStatus` server.ts:146 | `useDailyStatus` hooks.ts:109 | yes |
| PuzzleService.GetDaily -> TodaysPuzzle | `getServerTodaysPuzzle` server.ts:178 | `useTodaysPuzzle` hooks.ts:153 | yes |
| GamificationService.GetStreakInfo | `getServerStreakInfo` server.ts:198 | - no client surface | no |
| StatsService.GetHistory | `getServerHistory` server.ts:283 | stats-client.ts:147 `getHistory` - 0 callers | dead client copy |
| StatsService.GetUserStats | `getServerUserStats` server.ts:306 | `useUserStats` hooks.ts:303 | yes (3rd mapper between) |
| StatsService.GetTodayOverview | `getServerTodayOverview` server.ts:338 | - | no |

## Divergences found (the bug class)

**D1 - DailyStatus.completedSession: the client fabricates a completion.**
- authority (server.ts:127-139, used :161): real `completed_session` -
  `{status: 'won'|'lost', score, attempts, completedAt}`; null when absent.
- copy (hooks.ts:122): `completedSession: r.hasCompleted ? { status: 'won', stub: true } : null`
  - always `won`, drops score/attempts/completedAt.
- The field's own contract (gen/connect/puzzled/v1/puzzle_pb.ts:224-229):
  "Present only when the request identity has an accepted finish. Details are
  read from the same Rust-owned game_sessions row as the completion guard; the
  client never reconstructs a result." - hooks.ts:122 reconstructs one.

**D2 - DailyStatus.mode: literal vs pass-through.**
server.ts:63 (type) + :173 (value) `mode: 'daily'`; hooks.ts:139
`mode: r.mode || 'daily'` - a second, looser rule.

**D3 - TodaysPuzzle.puzzleNumber: coercion on one side only.**
server.ts:190 `Number(res.puzzleNumber)`; hooks.ts:166 `r.puzzleNumber`.
(Equal today - uint32; the copy silently drops the coercion contract.)

**D4 - adapter wrapper fields on the client only (by design).**
hooks.ts:140-141 / :178-180 add `slice`, `stub`, `authority`. Domain values
equal; recorded so convergence keeps them.

**D5 - UserStats is hand-mapped three times.**
server.ts:306-323 (proto -> shape) vs hooks.ts:303-330 over
stats-client.getUserStats (stats-client.ts:120-146 - a third mapper that strips
`totalPlayed`/`totalWon`). Values agree today; the type drifts
(`guessDistribution: unknown` server.ts:82 vs `Record<string, number> | null`
hooks.ts:297).

**D6 - History: the client copy is dead code.**
stats-client.getHistory :147 has 0 callers; the live read is server-only
(stats/page.tsx:99).

## Dead export

server.ts:361 `export const createServerApi = null as never` - 0 importers:

```
$ git grep -n createServerApi HEAD
HEAD:apps/puzzled/src/lib/api/server.ts:361:export const createServerApi = null as never

$ rg -n 'createServerApi' . --hidden -g '!**/node_modules/**' -g '!.git/**'
./apps/puzzled/src/lib/api/server.ts:361:export const createServerApi = null as never
```

(both = the definition itself; nothing else in the repo.)

## Consumers (what can observe behaviour)

Server accessors - server components only: home page.tsx:28-29,103-104;
(main)/layout.tsx:5,52; profile/page.tsx:7-8,71-72; pricing/page.tsx:12,66;
auth/_components/auth-shell.tsx:4,34; stats/page.tsx:22,25,98-100;
games/[slug]/game-play-area.tsx:10-11,94-96,142,158.

Client surfaces:
- `useDailyStatus`, `useTodaysPuzzle`: **0 call sites** anywhere (git grep
  below); exported, unconsumed.
- `useUserStats`: features/gamification/components/achievement-checker.tsx:4,38
  (reads perfectGames / streak counts / wins - values unchanged by a mapper
  consolidation).

```
$ git grep -n -e useDailyStatus -e useTodaysPuzzle HEAD -- apps
HEAD:apps/puzzled/src/lib/api/hooks.ts:109:export function useDailyStatus(
HEAD:apps/puzzled/src/lib/api/hooks.ts:153:export function useTodaysPuzzle(

$ rg -n 'useUserStats' apps/puzzled/src
apps/puzzled/src/lib/api/hooks.ts:303:export function useUserStats(
apps/puzzled/src/features/gamification/components/achievement-checker.tsx:4:import { useUserStats } from '@/lib/api'
apps/puzzled/src/features/gamification/components/achievement-checker.tsx:38:	const { data: userStats } = useUserStats({
```

## Convergence plan (this PR)

- New `lib/api/domain/daily.ts`: the single mapping for PuzzleService.GetDaily -
  `mapDailyStatus(res, difficulty)` + `mapTodaysPuzzle(res, difficulty)` and the
  `DailyStatus`/`TodaysPuzzle` types; `parsePuzzleData`/`parseCompletedSession`
  move in (unchanged logic).
- server.ts: both accessors become `cache()` adapters over the mappers; type
  re-exports keep all existing import paths; dead `createServerApi` deleted.
- hooks.ts (minimal, TD-11-aware): the two queryFns call exported thin helpers
  (`fetchDailyStatusForClient` / `fetchTodaysPuzzleForClient`) that run the same
  mapper and keep the existing `slice`/`stub`/`authority` wrappers and the
  `ApiError` fail-closed surface.
- Value contracts: server path pinned against a Connect fixture (new tests).
  Client path: identical mapping for every shared field; the only differences
  are D1/D2 being corrected to the authority's projection on surfaces with 0
  consumers. Cache keys untouched (`queryKeys.*` unchanged; React `cache()`
  wrappers unchanged).
- Left as follow-ups: UserStats (D5 - needs the stats-client seam, outside this
  PR's touch set); History (D6 - no live client surface yet); StreakInfo /
  TodayOverview (no second surface); remaining accessors stay hand-mapped until
  a second surface exists.

## Proof harness

- Unit lane (CI test:unit): `env -u NODE_ENV DATABASE_URL=... SKIP_ENV_VALIDATION=true bun run test:unit` in apps/puzzled.
- New: `src/lib/api/domain/daily.test.ts` (mapper pins) plus adapter tests
  pinning `getServerDailyStatus` against a Connect response fixture and
  `fetchDailyStatusForClient`/`fetchTodaysPuzzleForClient` against the same
  fixture (mocked admission; bun mocking rules as in the TD-18 test comment).
- Mutation check: mapper drops a field -> the pinning test goes red; restore ->
  green (raw output in notes/td08-proof.md).
