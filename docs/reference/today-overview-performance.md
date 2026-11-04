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

The corrected baseline was read from VictoriaLogs `/select/logsql/query` on
2026-11-03 at 00:10–00:11 UTC and independently reproduced at 00:17 UTC. It
supersedes the original 2026-11-02 mixed-hop measurement. Requested window:
`2026-10-26T22:18:00Z` through `2026-11-02T22:18:00Z`. The first 1h42 lacks
Contour logs despite positive controls in other namespaces, so this is **not a
complete seven-day census**; observed coverage is at most 166.3 hours.

### Count the selected ingress boundary once

Puzzled traverses the same Envoy twice: the outer record sends upstream to
Contour's Envoy Service on port 80, and the inner record sends to a revision
queue-proxy on port 8012. Exact duplicate log messages also occur. The original
5,278/3,860 counts included these mixed-hop log rows; calling them unique
requests was wrong. The same failure affected Spiron, but not the other
observed single-hop authorities.

Before parsing, deduplicate exact `_msg` bytes on the server:

```logsql
| stats by(_msg) min(_time) as _time
```

After the existing Envoy method/path/status/latency/agent/authority parser,
exclude upstream port 8012 **only for the observed hairpin authorities**.
These are pipeline stages, not a complete query. The boundary is infrastructure,
not a route-specific latency filter:

```logsql
| extract_regexp `"(?P<upstream>[^"]*)"$` from _msg
| filter NOT ((authority:="api.spiron-platform.svc.cluster.local" OR authority:="api.puzzled-prod.svc.cluster.local") AND upstream:~":8012$")
```

Keep missing/no-upstream records and all response statuses. Do not deduplicate
by taking maximum latency per request id: ids can be reused. No raw message,
request id or user-agent value needs to leave the log server. The resulting n
is **distinct selected-edge access records**, not a proven logical-call or
human-action census. Re-read the authority/upstream-port population before
comparing a later window; changed topology invalidates a silent comparison.

For exact `POST /puzzled.v1.StatsService/GetTodayOverview`, authority
`api.puzzled-prod.svc.cluster.local`, all statuses:

| Cohort | Distinct selected-edge n | P50 / P95 / P99 (ms) | HTTP 4xx / 5xx / status 0 |
| --- | ---: | ---: | ---: |
| All Mozilla-shaped UAs | 2,637 | 91 / 428 / 974 | 0 / 0 / 38 |
| Browser-shaped, no explicit bot markers | 1,930 | 88 / 416 / 970 | 0 / 0 / 24 |

The fixed narrower UA predicate is:

```logsql
agent:~"^Mozilla/" AND agent:~"(Chrome|Firefox|Safari|CriOS|FxiOS|Edg)/" AND NOT agent:~"(?i)(bot|crawl|spider|headless|scan|checker|assetnote|externalagent|monitor)"
```

Neither cohort proves human use: browser automation can send an ordinary UA.
Keep the broad sensitivity alongside the narrower cohort, not as a replacement
chosen after seeing the result. Percentiles include status 0 (no HTTP response)
and all HTTP statuses. Do not average per-status percentiles. The previous
mixed-hop status/flag breakdown and successful-response percentiles are not
valid selected-edge baselines. No request trace establishes the original
application-phase root cause.

### Verified rollout and observation window

PR [#518](https://github.com/SylphxAI/puzzled/pull/518) merged as
`06ed26dbb96f02a73179543cc84de4ee570f44c3`. The production API revision became
Ready at 2026-11-02 23:53:37 UTC. At 2026-11-03 00:12 UTC, the public health
response and 100% serving revision both matched that commit; post-merge
[Verify](https://github.com/SylphxAI/puzzled/actions/runs/41547270452) passed.

The read-only live harness observed that SHA, PostgreSQL readiness, today's
`word-groups` free puzzle for Hong Kong day `2026-11-03`, no answer/solution
keys, paid-module and archive refusals, and future-date rejection. Its overall
exit was **1**, not a full pass: seven checks passed, the share signature check
was indeterminate because the harness cannot solve `word-groups`, and the
finish loop was intentionally not attempted. No guest finish was written.
The remote package-script invocation could not observe the target because its
fetch sockets closed; the documented direct-file invocation obtained these
live receipts. That first failed instrument is not a product-failure diagnosis.

The fixed follow-up is `2026-11-03T00:15:09Z` through
`2026-11-04T00:15:09Z`, after serving-revision and free-path verification.
Use the same deduplication, boundary, route, authority, method, cohort and
all-status aggregation for the complete 24 hours. Half the corrected narrower
baseline is 208ms (broad: 214ms); the existing stricter 202ms goal is retained.
Report n, P50/P95/P99, HTTP 4xx, HTTP 5xx, status 0 and flags, and changes in
client/time mixture. Require an independent count, full output cardinality,
logging coverage and topology controls. With n=0, report no eligible demand,
not a latency pass. Synthetic reads and local tests are separate evidence;
shipping a one-query read does not itself prove the production target.

## Full 24-hour result: raw target met, stable-mixture outcome not established

The frozen follow-up above was read on **2026-11-04 at 00:17:32–00:17:41
UTC**, without moving its start/end or dropping errors. The aggregate receipt,
query hashes, client/hour strata, source lineage and functional checks are in
[`today-overview-2026-11-04.json`](today-overview-2026-11-04.json). The broad
executable predicate is `agent:~"Mozilla"` (contains Mozilla); only the narrower
predicate is anchored to `^Mozilla/`.

| Cohort | Distinct selected-edge n | P50 / P95 / P99 (ms) | HTTP 4xx / 5xx / status 0 |
| --- | ---: | ---: | ---: |
| Broad follow-up | 195 | 25 / 147 / 511 | 0 / 0 / 1 |
| Narrower follow-up | 156 | 24 / 147 / 511 | 0 / 0 / 1 |

Raw P95 is 64.7% below the narrower 416ms baseline and 65.7% below the broad
428ms baseline. Thus the observed raw metric meets the corrected half-baseline
thresholds, **208ms narrower / 214ms broad**, and the separately retained,
stricter 202ms goal. These figures are not a composition-controlled or causal
estimate of the optimization's benefit.

Both populations retain the same one status-0 `DC` access record: **984ms** at
2026-11-03 02:06:34.871670105 UTC. The other records are HTTP 200 with flag `-`
(narrower 155, broad 194). It is not removed or replaced by a successful-only
percentile. P99 is particularly sparse: 156 observations leave roughly two
records in the upper 1%; this does not establish a stable population P99.

### Measurement controls

- Separate count-only queries agree at 195 and 156. They share the selection
  pipeline, so this is internal denominator consistency, not independent source
  validation. No result reaches the 500-row output limit; the largest main-query
  output is 25 rows and the five-minute control returns 289.
- Parser control finds 10,945 records in the multi-environment, pre-agent-filter
  search scope and zero missing method, path, agent, authority or duration
  captures. It cannot validate records excluded by the initial search.
- The all-route Puzzled Mozilla-shaped upstream census contains only the same
  two ports: outer 80, n=522; inner 8012, n=522. These aggregate equal totals
  still do not prove request-by-request pairing.
- The Contour positive control contains 2,646,626 log rows across every one of
  the 289 intersecting five-minute bins, from 00:15:09.706 UTC on November 3
  through 00:15:06.505 UTC on November 4. No whole five-minute logging gap is
  observed. Positive controls are not proof of lossless logging, nor a repair
  of the baseline's missing first 1h42.

### Disconfirming client/time-mixture check

The cohorts have the same UA rules, but their composition changed materially.
These groups are first-matching UA regex tokens, not authoritative browser
identities: for example, an Edge UA containing `Chrome/` before `Edg/` falls in
the Chrome bucket.

| Narrower browser/device group | Retained baseline n / share | Follow-up n / share | Baseline / follow-up P95 (ms) |
| --- | ---: | ---: | ---: |
| Chrome / Macintosh | 964 / 49.9% | 19 / 12.2% | 435 / 984 |
| Chrome / Windows | 521 / 27.0% | 75 / 48.1% | 281 / 113 |
| Chrome / Linux | 290 / 15.0% | 22 / 14.1% | 345 / 73 |
| Safari / iPhone | 102 / 5.3% | 29 / 18.6% | 683 / 99 |

The follow-up Chrome/Macintosh group has **2 of 19** records above 202ms,
208ms **and 416ms**. Applying that conditional exceedance rate to its retained
full-baseline weight alone gives:

```text
(964 / 1930) × (2 / 19) = 5.2576% above each threshold
```

This is already above 5%, before any contribution from other groups. Over the
common strata, whose baseline denominator is 1,928 rather than 1,930, the
renormalized point estimate is 5.2632%. The unsupported two baseline records
are Chrome with no extracted device family. Neither calculation averages
percentiles. The diagnostic was added after the frozen raw read; it is not a
replacement cohort or a second acceptance window.

Consequently, the observed raw pass **does not establish the half-P95 outcome
at a stable baseline client mixture**. The 19-record conditional sample is
small: this is an empirical falsifier of a composition-robust pass claim, not
a confidence bound, proof of a caused regression, or an irreducible floor.
Time mixture also changed: UTC hour 02 supplies 52/156 (33.3%) follow-up
records, versus 94/1,930 (4.9%) in the retained baseline; hour 23 supplies
29/156 (18.6%) versus 29/1,930 (1.5%). Ordinary-UA automation remains possible.

The weights above come from the retained corrected November 3 baseline, whose
counts agree with its 1,930-record denominator. A later historical query
returned fewer records and was not substituted for those frozen weights;
continued historical availability has not been proved.

### Source lineage and fresh functional receipt

The window contains completed request-phase events from `06ed26` (224),
`46b56d` (86), and `b849fb` (4), all HTTP 200. These events include non-cohort
traffic and are not joined to the ingress sample; cancelled requests may have
no completed event. Their phase percentiles are diagnostic, not a substitute
for the all-status acceptance instrument.

Both later source revisions descend from `06ed26`, and their entire
`puzzled-core/src` and `puzzled-server/src` trees are unchanged relative to it.
The overview, SQL and timing-observer blob identities are recorded in the
receipt. Dependencies did change (`jsonwebtoken` 10.3 to 11.0; test-only
`ed25519-dalek` 2 to 3), and web changes also shipped. This is not a controlled
single-release experiment.

At 2026-11-04 00:17 UTC, public health and the 100% serving API revision both
reported `46b56d59f9f207bacc65c3a23da33438d94fa6f3`. The read-only live harness
at 00:19:02 UTC exited **0: eight passed, zero failed**, with only the guest
finish intentionally not attempted. It verified that SHA, PostgreSQL
readiness, Hong Kong day `2026-11-04`, the free `crowns` puzzle, no answer keys,
two solved signatures absent from the share page, paid/archive refusals and
future-date rejection. No guest finish or production record was written.

**Verdict:** the uncached one-query implementation is shipped and its raw
24-hour P95 target is met. Composition-robust tail reduction, a causal saving
and an irreducible latency floor are **not established**. Keep the correct
one-query implementation; do not declare the broader performance outcome
complete or add speculative caching, warm replicas, indexes or shared-database
changes from this sample.
