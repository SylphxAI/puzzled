# Content Security Policy

Every response from the web app carries a strict Content Security Policy.
`src/proxy.ts` creates fresh nonces for private documents and builds the policy
with `buildCsp` in `src/lib/csp.ts`. The anonymous shared home uses hashes of
its complete representation, described below.

## The policy

```
default-src 'self';
script-src 'self' 'nonce-<per request>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com;
frame-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- **Scripts** run only with the request's nonce. There is no `'unsafe-inline'`
  and no `'unsafe-eval'` (development adds `'unsafe-eval'` for React and HMR).
  `'strict-dynamic'` lets nonced scripts load their chunks, and it makes
  browsers ignore host allowlists, so the policy lists no script hosts.
- **Where the nonce goes.** The proxy sets it on the request as
  `Content-Security-Policy` (Next.js reads it and nonces its own inline and
  chunk scripts) and as `x-nonce`. The locale layout reads `x-nonce` for the
  theme and consent-settle scripts and passes it to next-themes. JSON-LD
  blocks (`type="application/ld+json"`) are data, not script, and need none.
- **Private pages are dynamic.** They render per request with `private, no-store`.
- **`worker-src 'self'`** is explicit because `'strict-dynamic'` ignores
  `'self'` in `script-src`, which is the service worker's fallback.
- **Ads (only when configured).** With `ADS_ADSENSE_CLIENT_ID` and `ADS_SLOT_ID` set, `buildCsp`
  adds the ad network's hosts to `frame-src` and `connect-src` (`AD_CSP_HOSTS` in `src/lib/ads.ts`).
  `script-src` does not change: our nonced code inserts the loader, which `'strict-dynamic'` trusts.
  Unconfigured, the policy is exactly the one above.
- **Google tag (only when configured).** With `GA_MEASUREMENT_ID` or `GOOGLE_ADS_ID` set, `buildCsp`
  adds Google's collection hosts to `connect-src` (`GOOGLE_TAG_CONNECT_HOSTS`). `script-src` does not
  change: the consent-gated loader in `src/features/analytics` inserts gtag.js, which `'strict-dynamic'`
  trusts. Unconfigured, nothing Google is allowed.
- **No other third-party scripts.** Checkout is a redirect to a hosted checkout page, and
  analytics and replays are gone, so Stripe, PostHog, Vercel, GTM, Neon and
  Cloudflare hosts are no longer listed.

## Anonymous shared home

Only `GET /` with no query and no Cookie, Authorization, RSC, router or action
selector gets this profile. The proxy strips any incoming profile/nonce headers
before making that decision. Other pages, including `/pricing`, keep their nonce.

`shared-home-server.cjs` buffers this response until completion, hashes the exact
inline script bytes, and gives each external Next entry script and script preload
its exact SHA-256 integrity and anonymous CORS attributes. `script-src` keeps
`strict-dynamic` with those hashes; it adds no script origin allowance. The same
policy authorizes runtime-created lazy chunks. A missing script, unexpected nonce
or failed transformation returns a private 503.

Public cache admission additionally requires a matching, complete public asset
publication receipt, successful complete HTML, no render error and no Set-Cookie.
Redirects and private traffic keep their existing response behavior. See
[public landing delivery](public-page-delivery.md) for identity and freshness.

Production uses the configured public Data asset origin for CSS, fonts and chunk
fetches. It adds no script host authority: scripts still require a nonce or an
exact hash with SRI.

## Exception: `style-src 'unsafe-inline'`

Styles keep `'unsafe-inline'`, for two reasons:

- Sonner (toasts, through `@sylphx/ui`) inserts an un-nonced `<style>` element
  when it loads, and it has no nonce option.
- Server-rendered React `style` attributes (board geometry, per-cell colours,
  about 60 places) would be blocked by `style-src-attr` without it.

A nonce cannot be added to `style-src` alongside `'unsafe-inline'`, because
browsers then ignore `'unsafe-inline'`. Injected styles cannot run script, so
the XSS protection comes from `script-src`.

## Violation reports

The browser error capture (`src/lib/observability/browser.ts`) listens for
`securitypolicyviolation` and posts each one to the error relay as a
`CSPViolation` error group (tag `handler=csp`), one per directive and blocked
origin. Violations before hydration are not captured.

## Checking it

`bun test src/lib/csp.test.ts` covers the policy and the proxy. In a browser,
listen for `securitypolicyviolation` from document start and visit the key
pages; the count must be zero.

## Hydration and streamed boundaries

Streamed Suspense boundaries (the top nav, for one) can hydrate after the
session request has resolved, and the timing shifts with the policy. So
`useSafeUser` renders the server's loading state during any hydrating render
(`useSyncExternalStore` server snapshot) and switches right after. Rendering
the resolved session there broke hydration with React error #418 on the
second page view after #256.
