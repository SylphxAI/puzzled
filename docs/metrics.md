# Metrics

The one number that says whether Puzzled works, the few supporting numbers
that explain it, and the signals that mean stop and fix. Direction is in
[vision.md](vision.md).

## North Star: daily puzzle completers

Public field `daily_puzzle_completers`. For a product day D (in
`Asia/Hong_Kong`), the number of distinct players with at least one qualifying
finish. Several finishes or several games by the same player on D count once.

Why this unit: for a daily-puzzle product the cultural and economic unit is "I
did today's puzzle". Raw daily users include bounces, puzzles completed rewards
grinding, share count is gameable, paid users lag and warp early product toward
walls, catalog size is vanity, and time in app can reward dark patterns.
Catalog breadth multiplies reasons to come back; it must not redefine the unit.
Do not invent an acronym for it ([ADR-171](adr/ADR-171-north-star-english-metric-names.md)).

### What qualifies

A finish counts when all of these hold:

1. The api produced it after successful server-side validation; the client never asserts completion.
2. It is for the product day's puzzle (`day_key = D`) or D's featured free rotation.
3. The game's class is `puzzle_ritual`, not `entertainment_oracle`.
4. It is a terminal result the game treats as "today's attempt resolved" (a win, or an exhausted loss where the game has one daily attempt).
5. It is not a dry run, admin injection or load-test marker.
6. It is the daily mode, not archive and not practice (`qualifies_as_ritual` in core).

One finish counts per `(user, game, day_key)`: replaying is review, and the
api rejects a second finish as already played. Guests count when their identity
is stable for the day; report the total and the signed-in split.

Entertainment games (fun, random outcomes allowed) are reported separately as
`daily_entertainment_completers` so they cannot inflate the brain-play number.

### Recomputing it

`game_sessions` rows written by `PuzzleService.SubmitGuess` are the source:

```sql
SELECT COUNT(DISTINCT user_id)::bigint AS daily_puzzle_completers
FROM game_sessions
WHERE day_key = $1          -- YYYY-MM-DD in Asia/Hong_Kong
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost');
```

The pure form is `puzzled_core::puzzle_play::ritual_completion::compute_drc`.
A dashboard number should match this within late-event lag (15 minutes).

## Supporting metrics

| Group | Metric | Definition |
| --- | --- | --- |
| Habit | D1 / D7 / D28 retention | Of players whose first completer day is day 0, the share who complete again on day N (completing, not opening the app) |
| Habit | Weekly regulars (`weekly_ritualists`) | Distinct players with completer days on at least 4 of the trailing 7 days; code `compute_hrc`, SQL `HRC_RECOMPUTE_SQL` |
| Habit | Streak distribution | Share of completers with streak of 3 or more, 7 or more |
| Habit | Time to first finish | For new players, p50 and p90 |
| Depth | Games per completer per day | p50 in 1 to 3 is healthy; a heavy p90 may signal pressure |
| Growth | Share rate, landing rate, landing-to-first-finish rate | shares per finish; landings per share; new completers per landing |
| Reliability | Serve error rate, submit error rate, finish latency p50/p95 | The free daily path is the product |
| Revenue | Free-to-Plus conversion by completion-day density, paid churn, archive-gate conversion | Lagging; revenue never replaces the North Star |

Prefer server-emitted events over client analytics for finish counts. Client
analytics may enrich funnels (time to first finish, rage clicks). Aggregate by
default and keep raw events per the privacy policy.

## Stage targets

Directional, not calendar commitments; recalibrate with live baselines and
build our own cohort curves rather than copying casual-game medians.

| Stage | Exit criterion |
| --- | --- |
| Instrument | Completers recomputable from production data for 7 consecutive days |
| One habit | D7 retention of new completers is measurable |
| Suite | Three or more games, each on the protocol, with games-per-completer in a healthy band |
| Paid habit | Conversion tracked for players with 7 or more completer days in the prior 14; the free daily finish is never removed |

## Stop-the-line signals

Each needs an alert; thresholds live in the ops dashboards.

| Signal | Why |
| --- | --- |
| Completers fall day over day with no deploy or content explanation | Habit regression |
| Free daily finish error spike | Reliability incident |
| Share rate collapses after a card change | Growth regression |
| Paid players' completion is far below free players' | Monetization is hurting play |
| Entertainment completers far above puzzle completers while we claim brain training | Positioning drift |
| Completers flat while the catalog grows | Protocol or UX is broken; stop adding games |
| Shares produce no landings | Card or deep link is broken |

Do not report as success: catalog count alone, session length as a goal, push
volume, or raw play counts without unique players. Do not count unfinished
starts, move the day boundary per player, gate the only free daily finish
behind payment, or optimise share bots.

## Review rhythm

Daily: completers and free-finish errors. Weekly: retention, share funnel and
game mix. Monthly: subscription cohorts and what each game costs to run.
