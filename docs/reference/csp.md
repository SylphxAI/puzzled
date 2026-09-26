# Content Security Policy

Every response from the web app carries a strict, per-request Content
Security Policy. `src/proxy.ts` creates a fresh nonce for each request and
builds the policy with `buildCsp` in `src/lib/csp.ts`. The static policy in
`next.config.ts` is gone.

## The policy

```
default-src 'self';
script-src 'self' 'nonce-<per request>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://sylphx.com https://*.sylphx.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com;
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
- **Pages are dynamic.** Every page was already rendered per request
  (`force-dynamic`, `private, no-store`), so the nonce costs no caching.
- **`worker-src 'self'`** is explicit because `'strict-dynamic'` ignores
  `'self'` in `script-src`, which is the service worker's fallback.
- **No third-party scripts.** Checkout is a redirect to Stripe Checkout, and
  analytics and replays are gone, so Stripe, PostHog, Vercel, GTM, Neon and
  Cloudflare hosts are no longer listed.

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
