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

The reliability row is emitted and alertable, not a dashboard only: the api
writes `event="puzzled.user.write.ok"` or `.write.failed` once per finished
user-mutating write (the shared `product-journey-success` SLO in
`SylphxAI/infra`, 99%),
`event="puzzled.issue.turn_failed.<route>"` on any 5xx (one work item per
fingerprint), and each backend error also reaches Sylphx Observability as a
group ([observability.md](observability.md#quality-signals-owner-standardsquality-signalsmd)).
| Revenue | Free-to-Plus conversion by completion-day density, paid churn, archive-gate conversion | Lagging; revenue never replaces the North Star |

Prefer server-emitted events over client analytics for finish counts. Client
analytics may enrich funnels (time to first finish, rage clicks). Aggregate by
default and keep raw events per the privacy policy.

## Stage targets

Directional, not calendar commitments; recalibrate with live baselines and
build our own cohort curves rather than copying casual-game medians.
Numeric retention, conversion and revenue targets, the competitors they are
set against and the cohort size each is judged on are in
[north-star/MARKET-AND-TARGETS.md](north-star/MARKET-AND-TARGETS.md).

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

## Scheduled operator report

The admin Analytics page (`/admin/analytics`) reads **persisted aggregates**, not live SQL, through
`AdminService.GetMetricsReport` (the api checks the exact product `admin` scope).
It shows the last 35 Hong Kong product days, refresh time, provisional/closed
status, the signed-in split, D7 numerator/denominator, weekly regulars, share
landings and new completers, and every triggered stop-the-line signal. An empty
cohort is **not** 0% retention. Missing or >30-minute-old reports show a warning.

Compute calls the signed `/internal/compute/product-metrics` callback at minutes
2, 17, 32 and 47 of every hour. It recomputes the trailing 35 days from the same
qualifying `game_sessions` predicate as the core oracles, in a repeatable-read
transaction. Today stays provisional; a day closes after a 15-minute late-event
allowance. D7 for completed day D compares first completers on D−7 with those
who completed again on D. It does not treat merely opening the site as returning.
A lock and upserts make overlapping/retried ticks safe. Failed ticks return 503
for Compute to retry and emit `puzzled.issue.tool_failed.metrics_rollup`.

Anonymous share-landing visits are counted only by the visible browser page, not by the public
result read used by crawlers/metadata. Linking a landing to a first finish requires explicit analytics consent (also required in the RPC); declined or absent consent records no linked receipt. The api admits the existing signed-in or
server-issued guest credential, requires same origin, verifies the share, excludes
self-landings and deduplicates `(player, share, product day)`. A new completer
counts on their **first completer day** only if their first qualifying finish
follows a landing in the preceding seven product days (D−6 through D). Guest
attribution follows the proven guest-to-account adoption transaction. A landing
never inserts or validates a finish. The anonymous funnel counter stays anonymous
and separate. Identity-bound landing receipts and observed audiences are erased
with the account. Landing receipts are retained for at most 41 product days (35 report days plus the six-day attribution lookback); audience receipts for 35 product days; reports/counters carry
no player ids. Existing finishes are not rewritten or backfilled.

New share-tap, landing and free-finish counters begin at deployment; historical
zeros in those columns mean **not collected**, not evidence of a broken funnel.
Catalog size/release are observed from deployment onward, never invented for
historical days. Free-finish outcomes are counted without any Money read and do
not block the response. The Plus/free comparison is completion per **observed
signed-in subscription viewer** that day, not all subscribers or all guests;
reverse trials belong to the free audience, unanswerable Money reads are excluded.
Plus includes Money grants/family seats; it is an access-segment proxy, not a
revenue measure. Raw landings/audiences are not exposed through the report.

### Initial stop-the-line thresholds

These policy defaults are versioned in the core and visible here. Closed-day
violations are persisted in a durable alert outbox and emitted through the
existing platform issue intake as
`puzzled.issue.metric_regression.<signal>` (`severity=info`). The fingerprint has
no date, player id, URL or personal row. Acknowledgement follows logging, so a
crash can repeat an occurrence but cannot silently lose the alert. Ordinary
retries do not re-emit an acknowledged day/signal; the dashboard shows all current
signals even if the delivery was already acknowledged. After missed ticks, the
next rollup queues violations for every closed day in its 35-day window, not
only yesterday. Sparse cohorts do not page.

| Signal | Default threshold |
| --- | --- |
| `completers_drop` | D <80% of D−1, with at least 20 completers on D−1, unless the admin setting `metrics_explained_days` (JSON array of product-day strings) records an investigated deploy/content explanation |
| `free_finish_errors` | At least 5 free-daily submission server failures and >1% of free-daily submission outcomes; client rejections are not server failures |
| `share_rate_collapse` | Shares/completer <50% of D−1, with at least 20 shares on D−1 and nonzero completers on both days |
| `paid_completion_gap` | Observed Plus completion rate <50% of observed free rate, at least 20 audience observations in each segment |
| `entertainment_drift` | At least 20 entertainment completers and >3× puzzle completers |
| `catalog_without_habit` | Catalog larger than D−7 but completers no larger, with at least 20 on D−7 and an observed historical catalog size |
| `shares_without_landings` | At least 20 share taps and zero anonymous landing visits on the closed day |

A deploy alone is not an explanation: investigate the drop before adding its day
to the setting. Thresholds may be changed by reviewed core-policy changes after
live baselines exist. Reliability's existing write-journey SLO remains active
between closed-day reports. Compute monitors failed/missed deliveries; a failed
metrics job is not a healthy zero-user day.

After rollout: verify the serving SHA; read this report as an admin; confirm its
`generated_at` advances at the next scheduled tick; and read the platform's issue
intake for any triggered fingerprint. Use only isolated test fixtures to induce
metric regressions; never manufacture finishes or change a real player's data to
prove an alert. The database tests assert the report against both canonical SQL
oracles, cohort timing, all seven threshold policies, deduplication, adoption,
erasure and durable alert retries.
