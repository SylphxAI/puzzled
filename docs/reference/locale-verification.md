# Locale verification

Every page the site serves to visitors in eight locales (en-US, en-GB, zh-HK,
zh-TW, zh-CN, ja, es, pt-BR) must render translated copy. Two things can go wrong
between the message files and a visitor:

- a **raw message key** reaches the page (`home.hero.title` instead of copy),
  because a namespace was not wired or a shell surface renders outside the
  translator;
- **`<html lang>`** names the wrong locale, which breaks screen readers,
  hyphenation and search.

## The checks

| Where | What it proves |
| --- | --- |
| `apps/puzzled/src/lib/i18n/*.test.ts` (unit) | the message files are wired: every locale resolves to the en-US leaf structure, overlays carry only deltas, full locales carry no English copy |
| `apps/puzzled/scripts/locale-verify.ts` (`bun run verify:locale`) | the **served** pages in every locale: no raw key, `lang` equals the locale |

`verify:locale` reads `/sitemap.xml` (one entry per locale per public route) and
adds `/settings` per locale, then checks each page:

1. **lang** - `<html lang>` equals the BCP 47 tag of the locale prefix.
2. **keys** - no leaf path of the en-US catalogue appears in the text a reader
   sees, a labelled attribute or the hydration payload. Markup plumbing (`id`,
   `href`, `class`) is not read: a route name can share a key's dotted shape.
3. **translated** - a non-English page shares at most 60% of its words with the
   English page of the same route.

It runs in the SEO contract job of `verify.yml` against the built site, and can
be pointed at anything:

```bash
cd apps/puzzled
bun run verify:locale --base http://localhost:3000          # a local build
bun run verify:locale --only /ja --only /es/pricing --json  # one slice
```

Exit code 1 on any failed page; the JSON carries each page's findings.

## Why not a browser

The check reads the server-rendered HTML. Client-only paths are covered by the
hydration payload, which carries the message catalogue a client render would use.
A page that renders translated copy on the server and swaps it in the browser is
therefore still covered for keys, and the accessibility suite covers what a reader
actually sees.

## Native-speaker review

The machine check proves no key leaks and the right language is declared. It
cannot prove the ja, es and pt-BR copy reads naturally. That review is recorded in
[native review](i18n-native-review.md); update the date and the lines there when a
locale's copy changes.
