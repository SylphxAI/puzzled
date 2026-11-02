# Today overview latency

`POST /puzzled.v1.StatsService/GetTodayOverview` reads the current
server-computed `Asia/Hong_Kong` product day. It must remain fresh on every
request: no TTL, stale-while-revalidate, cross-day response reuse, or auth
bypass is part of this optimization.

## Read path

`TODAY_OVERVIEW_SQL` computes distinct qualifying completers and sorted
per-game finish counts in one PostgreSQL statement, using grouping sets.
The NULL-slug grouping is the global count, including zero on an empty day;
stored game slugs are non-null. Both counts use the existing ritual predicate:
`day_key`, `is_ritual`, `module_class = 'puzzle_ritual'`, and terminal `won` or
`lost` status. One player completing two games still counts once globally.

This replaces two serial pool acquisitions and two aggregate statements.
Writer validation on acquisition remains enabled. Both aggregates now share
one statement snapshot; the original separate READ COMMITTED statements could
observe different committed populations. Errors still fail the RPC, rather
than inventing an empty day. The protobuf response and auth middleware are
unchanged.

`today_overview_tests.rs` exercises the migrated scratch database, the pure
ritual oracle, one pool acquisition, empty days, terminal losses, duplicate
players across games, excluded rows, adjacent product days, immediate freshness
following a commit, and a failed database. `scripts/verify-today-overview.sh`
starts its own Unix-socket-only scratch PostgreSQL, runs the focused test,
formatting, Clippy and the complete affected Rust suites, then stops it.

PostgreSQL 18 documents the empty grouping-set row and NULL grouping values
in [section 7.2.4](https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-GROUPING-SETS),
read 2026-11-02 at 23:21 UTC. The migrated-database test verifies those
semantics against the deployed SQL shape.

## Instrumentation

Two structured events contain only phase timings and enumerated outcomes:

- `puzzled.stats.today_overview.db`: `phase` (`ok`, `acquire_failed`, or
  `query_failed`), `acquire_ms`, and, after acquisition, `query_ms`. Acquisition
  includes the pool's existing writer-validation round trip.
- `puzzled.stats.today_overview.request`: `status`, `elapsed_ms`, `release`.
  The outer request observer includes auth and guest admission, even when
  admission refuses a request. It does not log headers, body, query string,
  user id or day counts.

These are server phases, not browser timings. Envoy's all-status route latency
remains the acceptance instrument. A client-disconnected request may have no
completed request event; never discard its ingress record to obtain a better
tail. Cold activation, pool waiting, SQL execution and auth are competing
latency hypotheses until the relevant event provides evidence.

## Fixed-cohort baseline and follow-up

Read from VictoriaLogs `/select/logsql/query` on 2026-11-02 at
22:49:50–22:49:55 UTC. Requested baseline:
`2026-10-26T22:18:00Z` through `2026-11-02T22:18:00Z`. The first 1h42 lacks
Contour logs despite positive controls in other namespaces, so this is **not a
complete seven-day census**; observed coverage is at most 166.3 hours.

Exact route and method, authority `api.puzzled-prod.svc.cluster.local`, all
statuses:

| Cohort | n | P50 / P95 / P99 (ms) | HTTP 4xx / 5xx / status 0 |
| --- | ---: | ---: | ---: |
| All Mozilla-shaped UAs | 5,278 | 88 / 418 / 968 | 0 / 0 / 63 |
| Browser-shaped, no explicit bot markers | 3,860 | 85 / 404 / 952 | 0 / 0 / 39 |

The fixed narrower UA predicate is:

```logsql
agent:~"^Mozilla/" AND agent:~"(Chrome|Firefox|Safari|CriOS|FxiOS|Edg)/" AND NOT agent:~"(?i)(bot|crawl|spider|headless|scan|checker|assetnote|externalagent|monitor)"
```

Neither cohort proves human use: browser automation can send an ordinary UA.
Keep the broad sensitivity alongside the narrower cohort, not as a replacement
chosen after seeing the result. Percentiles include status 0 (no HTTP response)
and all HTTP statuses. Do not average per-status percentiles. In the narrower
baseline, status 0 includes 24 `DC` and 15 `DR` Envoy flags. Successful responses
alone have n=3,821, P95=368ms and upstream P95=365ms. An exact successful ingress
event at `2026-11-02T10:00:56.121684298Z` took 1,104ms, upstream 1,103ms; that
places its delay upstream of ingress but does not identify the application
phase. No request trace establishes the original root cause.

After verified rollout, use the same route, authority, method, cohort and
all-status aggregation over the next complete 24 hours. The target is narrower
cohort P95 ≤202ms (half the baseline), or measured evidence of an irreducible
floor. Report n, P50/P95/P99, HTTP 4xx, HTTP 5xx, status 0 and flags, and changes
in client/time mixture. Use output limits above the full result cardinality and
an independent count/coverage control. With n=0, report no eligible demand,
not a latency pass. Synthetic reads and local tests are separate evidence;
shipping a one-query read does not itself prove the production target.
