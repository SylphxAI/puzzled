# Public landing delivery

The unprefixed `/` and `/pricing` routes use the default language when there is
no remembered language. They do not need to create `NEXT_LOCALE` on that first
visit. Explicit locale URLs still remember the language, and an existing
preference still redirects an unprefixed URL. Session-cookie migration remains
independent of this choice.

The first-visit cookie observed on 2026-11-03 was `NEXT_LOCALE`, not a session.
With locale detection disabled, next-intl still writes its cookie when the
request's Accept-Language is absent or differs from the resolved locale. The
proxy uses the same routing with `localeCookie: false` only for these two paths
when no preference exists. It does not remove arbitrary Set-Cookie headers.

## Cache boundary

Only an anonymous full `GET /` without a query, Cookie, Authorization, RSC,
router or action header has one shared representation. Language detection is
disabled, so Accept-Language and country do not change this default-language
guest document. It renders the existing guest day and rotating game lineup,
without progress, streak, trial or milestone islands. An incoming internal
profile header is discarded and recomputed by the proxy.

All cookie/authenticated, query, browser transition and non-root documents stay
private. `/pricing` remains private because it reads currency choice, country,
entitlement and checkout-return state. Its existing first-visitor geography is
preserved; catalogue prices remain the billing API's authority. Session migration,
checkout and personalised HTML are never shared. The service minimum stays zero.

The shared root uses complete-response hashes and script SRI instead of a nonce
([CSP contract](csp.md)). The native HTTP wrapper withholds shared headers until
the document is complete. Only status 200, no Set-Cookie, a valid product-day
marker and no streamed render error may be public. Other responses stay private;
redirect status and body are preserved. Vary includes Cookie and Authorization
as well as Next's RSC fields, protecting subsequent browser identity transitions.

## Freshness and retained browser assets

Shared HTML uses `public, max-age=60, stale-while-revalidate=3600,
stale-if-error=0`. The total configured freshness/stale allowance is at most
61 minutes, reduced at render completion so it cannot cross the next Hong Kong
product midnight. A deployment can therefore leave an old document in an edge
cache for that bound; no automatic deployment purge is assumed. Actual provider
freshness and cold-origin acceptance require delivered-response/cache evidence.

Production Next builds use `NEXT_PUBLIC_PUZZLED_ASSET_PREFIX` for `.next/static`.
After moving source maps out of that directory, the Docker build mounts its
production-only `public_assets` secret for one publication step. It publishes
every browser file through ordinary Sylphx Data APIs in the production tenant's
`web-static` bucket, then anonymously checks every file's digest, MIME and CORS.
The versioned bucket has no expiry lifecycle. The publisher never deletes keys
or overwrites different bytes at an existing URL. Old documents' entries, lazy
chunks, CSS and fonts remain independently readable after image replacement.
Server output, configuration and source maps are never published.

Only a successful complete publication writes a verified `.next/public-assets.json`.
At startup, public admission requires its prefix to match Next's built config and
its digest/size/type inventory to match the entire current static population.
Missing, stale or mismatched custody keeps HTML private. The publisher reads its
credential only during the BuildKit step, never from an image layer. Hosting
currently also projects stored environment secrets into production runtime; the
web server does not use that credential or publish at startup. Preview has no
production prefix or secret declaration;
its descriptor cannot admit shared HTML. The existing database release step is
unchanged. This requires Hosting's environment build-secret override support.

Primary reads on 2026-11-03: Next's current `assetPrefix` documentation (updated
2026-08-25) specifies uploading only `.next/static` as `_next/static`; Cloudflare's
cache-control documentation specifies that `s-maxage` implies proxy revalidation
and disables SWR, and that `stale-if-error=0` disables stale error fallback.

The installed Next.js 16.4.3 CSP guide and next-intl cookie-sync implementation
were read on 2026-11-03 at 01:07 UTC. The Next.js guide requires dynamic
rendering for per-request nonces; see `next/dist/docs/01-app/02-guides/` in the
installed package and [the CSP contract](csp.md).

## Cold process work

The shared layout reads local translations and request headers. It does not
discover OAuth providers: only the sign-in pages use that list, through
`loadOAuthProviders`. The former layout fetch populated a client context with
no readers and could delay every document until its one-second deadline.
Session discovery and consent still use their existing client provider.

Next.js loads route modules on demand (`preloadEntriesOnStart: false`) so a
cold health probe does not import every unrelated page. Requested modules stay
in process memory. The installed Next.js 16.4.3 memory guide and implementation
were read on 2026-11-03 at 04:53 UTC; this option changes module loading, not
rendering, response caching or the service's scale minimum.

## Verification

`src/proxy.test.ts` exercises both paths with missing, default and different
Accept-Language, remembered/explicit locales, unchanged login routing and
legacy-session migration. The CSP and session-cookie suites cover the shared
invariants.

For live timings, save the web and API/dependency pod state before the first
request. Record serving SHA, response status, TTFB, total duration, cookie
names and cache headers. Separate ready-pod samples from a natural cold first
hit; a ready frontend does not establish a ready dependency. A warm sample
cannot establish cold-start acceptance. After rollout, also verify the page's
hashed assets and matching script hashes/SRI or nonce, as applicable. An edge HIT
with an absent origin must carry the selected serving SHA; a Ready revision or a
local browser run is not that production receipt.

Account for informational responses: curl's `time_starttransfer` can time an
HTTP 103 Early Hint. Save a same-curl timestamped status trace and add the
within-trace interval from the first status to the final status (>=200) to
`time_starttransfer` for final HTML-header TTFB. Without that trace, total
duration is only a conservative upper bound. Local fault injection proves the
tested dependency behavior, never production cold-start acceptance.
