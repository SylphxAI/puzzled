# Where errors go

Puzzled sends server and browser errors to **Sylphx Observability**, our own
error-monitoring service, through the Sylphx SDK on `api.sylphx.com`
(`observability.errorGroups.capture`). There is no third-party error SDK,
script or host.

| Source | Path | Code |
| --- | --- | --- |
| Next.js server (route handlers, server components, actions, proxy) | `onRequestError` in `apps/puzzled/src/instrumentation.ts` | `apps/puzzled/src/lib/observability/capture.ts` (`@sylphx/sdk`) |
| Browser (uncaught errors, unhandled rejections, error boundaries, CSP violations: [csp.md](reference/csp.md)) | same-origin `POST /api/observability/errors`, captured server side | `lib/observability/browser.ts`, `lib/observability/relay.ts` |
| Rust api (every 5xx, every panic) | axum middleware and panic hook | `crates/puzzled-server/src/observability.rs` (`sylphx` crate) |

## Key and SDK route

- Capture calls `errorGroups.capture` with parent `orgs/-/projects/-/envs/-`
  (the key's own environment) and the environment's `SYLPHX_API_KEY`, which
  the platform mints and injects. The key needs `observability:ingest`.
  Until SylphxAI/cloud#8933 / #9258 land, Puzzled's key is billing-only and
  capture is refused with 403.
- Capture is a soft dependency: it never throws, gives up after 3 s, and never
  fails a request. A refused capture logs `[observability] capture failed`
  (web) or `observability capture failed` (api).
- The browser holds no key, so it posts to the same-origin relay. Direct
  browser capture waits on a publishable key with ingest (SylphxAI/cloud#9401).

## Source maps

- `next.config.ts` sets `productionBrowserSourceMaps`. The Dockerfile moves
  every `.map` out of `.next/static` into `.next/source-maps`, so the site
  never serves a map (`/_next/static/**/*.map` returns 404).
- At startup, `register()` calls `uploadSourceMaps()`
  (`lib/observability/source-maps.ts`). It uploads the maps for release
  `SYLPHX_GIT_COMMIT_SHA` and skips maps already stored for the release. Each
  map is keyed to the served URL of the script whose `sourceMappingURL`
  names it (Turbopack names maps by their own hash), with each path segment
  percent-encoded as browsers report it (`app/%5Blocale%5D/…`). The runtime
  image therefore carries both `.next/static` and `.next/source-maps`.
  The service maps minified browser frames to source at ingest.

## Api reporter

`crates/puzzled-server/src/observability.rs`. Each event carries service
(`SYLPHX_SERVICE_NAME`, default `api`), release (`SYLPHX_GIT_COMMIT_SHA`),
environment (`SYLPHX_ENVIRONMENT_TYPE`, as tag `environment`), the route
template as tag `route` (`unmatched` when no route matched; never the raw
path or query), kind, message and stack. Panics carry a backtrace (up to 50
frames, `app_frame` false for `/rustc/`, `.cargo` and registry paths).

- **Scrubbing**: before sending, message, stack strings and tag values lose
  emails, `Bearer`/`Basic` credentials, JWTs, `sylphx_`/`sk_`/`pk_`/`ghp_`
  style keys, values of `key=value` or `"key":"value"` pairs whose key
  contains secret, token, password, key, authorization or cookie, strings of
  32+ hex/base64 characters and 13-19 digit numbers (`[redacted]`).
- **Rate limit**: one fingerprint is sent at most once per 10 s per process;
  suppressed repeats are counted and logged at debug.
- **Queue**: events go through a bounded queue (64) to one worker. A full
  queue drops the event and logs `observability queue full or closed`
  with a running count, so if that line appears the api is erroring faster
  than the worker delivers. Each call times out after 3 s.
- **Off**: without `SYLPHX_API_KEY` the api logs
  `observability capture off: SYLPHX_API_KEY is not set` and only logs
  errors. Set the key (needs `observability:ingest`) and restart.

Verify after a deploy with the production check below, then
`sylphx observability error-groups list` (or the SDK read-back) and look for
the `observability test error <nonce>` group with the new release.

## Privacy

The service parses the raw stack and scrubs secrets, tokens, card numbers and
email addresses before storing. No request or response body and no header is
attached. The api reports the route template and status only. The relay
accepts same-origin reports only, at most 32 KB each and 20 per client per
minute; a page sends at most 10.

## Removed with the legacy host

The analytics (`/api/observability/analytics`) and session-replay
(`/api/observability/session-replays`) routes posted to the legacy
Observability host with `OBSERVABILITY_API_KEY`, which was never set, so they
never delivered. They, their hooks, the Web Vitals reporter and the game
analytics batcher are deleted. The SDK has no analytics or replay surface yet.

## Quality signals (owner standards/quality-signals.md)

The api reports its own problems as structured log lines; the platform turns
them into work items without anyone reading a log. The rule is the platform's
(`infra/runbooks/product-issues.md`); Puzzled only writes the lines.

| Line | When | Becomes |
| --- | --- | --- |
| `event="puzzled.issue.turn_failed.<route>" severity="info"` | any 5xx the caller saw | one work item per fingerprint (`ProductIssueReported` → the desk alert intake); a repeat while it is open is a note, a return after it closed a new item |
| `event="puzzled.api.write.ok\|failed" severity="info"` | one per finished write request (any method but GET, HEAD, OPTIONS) | the `puzzled-write-success` journey SLO in `SylphxAI/infra` |

The route subject is the route template with its parameters removed
(`/v1/puzzles/{game}/…` → `v1_puzzles…`), so no id, game slug or body ever
enters a line. The code is in
`crates/puzzled-server/src/shared/signals.rs`; the middleware is layered once
in `crates/puzzled-server/src/bootstrap/router.rs`.

Read back after a deploy (the same `SYLPHX_API_KEY`):

```bash
# Induced issue: answers 503 and reports one issue. Call once, then again
# within the hour, and read one item then one note in the work system.
curl -X POST https://puzzled.gg/signals:induce \
  -H "authorization: Bearer $SYLPHX_API_KEY" -d '{"nonce":"qa1"}'
# The lines themselves:
kubectl -n puzzled-prod logs <api-pod> -c user-container | grep 'puzzled.issue.'
```

## Production check

Both services have a test trigger that fails on purpose with
`observability test error <nonce>`. Without `authorization: Bearer <SYLPHX_API_KEY>`
it answers 404.

```bash
# web: the handler throws; onRequestError captures it.
curl -X POST https://puzzled.gg/api/observability/test \
  -H "authorization: Bearer $SYLPHX_API_KEY" -d '{"nonce":"n1"}'
# api: a task panics (panic hook) and the response is 500 (5xx middleware).
curl -X POST https://puzzled.gg/observability/test \
  -H "authorization: Bearer $SYLPHX_API_KEY" -d '{"nonce":"n2"}'
```

Read back with the same key:

```ts
import { Sylphx } from '@sylphx/sdk'
const sx = new Sylphx()
await sx.observability.errorGroups.list({ parent: 'orgs/-/projects/-/envs/-', pageSize: 50 })
```
