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

These documents remain private and no-store. Removing a locale cookie does not
make the HTML safe to cache:

- The root layout generates a fresh CSP nonce for every response.
- Home streams the viewer's progress and milestone state.
- Pricing reads the currency cookie, country header, account entitlement and
  checkout-return state. Catalogue prices remain the billing API's authority.

Do not mark these responses public or cache session migration, checkout, or
personalised HTML. Cache public data independently only where its authority and
freshness contract permit it. Keep the service's scale minimum at zero.

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
cannot establish cold-start acceptance. After rollout, also fetch the page's
hashed assets and verify that its nonce matches the response policy.

Account for informational responses: curl's `time_starttransfer` can time an
HTTP 103 Early Hint. Save a same-curl timestamped status trace and add the
within-trace interval from the first status to the final status (>=200) to
`time_starttransfer` for final HTML-header TTFB. Without that trace, total
duration is only a conservative upper bound. Local fault injection proves the
tested dependency behavior, never production cold-start acceptance.
