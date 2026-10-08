# Offline recovery

## User experience

The page says what happened, explains that puzzles need a connection, and offers
one **Try again** action. It never promises offline puzzles, saved progress, or
automatic reconnection. Retry is a normal document navigation to Today, not a
client-router transition that depends on unavailable JavaScript.

The existing Puzzled `BrandMark`, `Wordmark`, `Button`, app stylesheet, brand
colour tokens and Fraunces font render the page. Its paper/ink light and dark
palettes follow the system preference. All eight existing locales have a recovery
document and a locale-preserving retry target. The default document has no external
stylesheets, fonts, scripts, images or data requests: its CSS, font and SVGs are
embedded, so caching the document is sufficient to render it.

References: the Puzzled design system, Nielsen's error-recognition and recovery
heuristic, and WCAG 2.2 AA (semantic heading/link, contrast, visible keyboard
focus, reduced motion, and a minimum 44 CSS pixel touch target).

## Integration boundary

The static documents are `/offline.html` for the default language and
`/offline/{locale}.html` for the other seven configured locales. The explicit
proxy skip-list admits these documents; arbitrary missing `.html` paths still
render the normal localised 404. Their content carries `noindex`.

The service worker must precache these documents before taking control. For a
failed same-origin **document navigation**, return the document for the URL's
locale prefix (case-insensitive), or the default document when there is no prefix.
Do not return HTML for API, Connect, asset, or client-router data requests. Do not
cache puzzles, answers, accounts or player data. An online navigation continues
to use the network. A retry while offline returns the same recovery screen; an
online retry reaches Today. Keep existing push reception and notification-click
behaviour unchanged.

This page supplies the presentation dependency for the reminder/offline change.
The service-worker integration and the complete application offline-navigation
acceptance are checked with that combined change, not in a separate deployment.

## Rebuild and check

From `apps/puzzled`, on a Sylphx Build lease:

```sh
bun run generate:offline
bun run check:offline
bun test src/lib/proxy-paths.test.ts src/shared/components/offline-view.test.tsx
bun run typecheck
bun run scripts/verify-offline-document.ts
```

`build` regenerates the static documents from their owners before building Next.
The generator compiles only the recovery and Button utility classes, taking the
rest of its design values from `globals.css` and the imported brand tokens.
Change the React view, the locale copy or the source tokens, then regenerate; do
not edit generated HTML by hand.

The browser check serves the actual generated documents with the app's CSP and
uses a deliberately small **test-only** precache worker to exercise the integration
contract. It checks phone, desktop and dark mode, an offline retry and online
recovery, keyboard focus, axe WCAG 2.2 AA rules, 44px targets, and all locale
layouts at 320px. It is not proof that the production service worker already
implements the contract.

Screenshots from that check live in `docs/design/offline/`: the existing `/offline`
404 on phone/desktop, the new offline documents on phone/desktop/dark mode, visible
focus, and Traditional Chinese and Spanish at narrow phone width.
