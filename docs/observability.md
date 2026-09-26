# Where errors go

Puzzled sends server and browser errors to **Sylphx Observability**, our own
error-monitoring service. There is no third-party error SDK, script or host.

| Source | Path | Code |
| --- | --- | --- |
| Next.js server (route handlers, server components, actions, proxy) | `onRequestError` in `apps/puzzled/src/instrumentation.ts` | `apps/puzzled/src/lib/observability/capture.ts` |
| Browser (uncaught errors, unhandled rejections, error boundaries) | same-origin `POST /api/observability/errors`, captured server side | `lib/observability/browser.ts`, `lib/observability/relay.ts` |
| Rust api (every 5xx, every panic) | axum middleware and panic hook | `crates/puzzled-server/src/observability.rs` |

## Key and endpoint

- Capture posts to `https://api.observability.sylphx.com/v1/error-events:captureException`
  with the environment's `SYLPHX_API_KEY`, which the platform mints and injects.
  The key never reaches the browser; that is why the browser posts to the relay.
- The generated SDK route on api.sylphx.com is not served yet
  (SylphxAI/cloud#9256); the code moves to it when it is.
- Capture is a soft dependency: it never throws, gives up after 3 s, and never
  fails a request. A refused capture logs `[observability] capture refused: <status>`
  (web) or `observability capture refused` (api).
- The key must carry the Observability ingest scope. Until SylphxAI/cloud#9257
  lands, Puzzled's key is billing-only and capture returns 403.

## Privacy

Messages, stacks, breadcrumbs and tags are scrubbed of email addresses,
credentials and URL query strings before they leave the process. No request
or response body and no header is attached. The api reports the route
template and status only. The relay accepts same-origin reports only, at most
16 KB each and 20 per client per minute; a page sends at most 10.

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

Read the occurrences back:

```bash
curl -X POST https://api.observability.sylphx.com/v1/error-groups:query \
  -H "authorization: Bearer $SYLPHX_API_KEY" -H 'content-type: application/json' \
  -d '{"timeRange":{"startTime":"<ISO>","endTime":"<ISO>"},"page":{"limit":50}}'
```
