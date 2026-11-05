# Locale verification

The public server-rendered pages serve eight locales (en-US, en-GB, zh-HK,
zh-TW, zh-CN, ja, es, pt-BR). Two things can go wrong between the message files
and a visitor:

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

`verify:locale` reads `/sitemap.xml` (one entry per locale per public route),
then checks each listed page. Authenticated settings are not in this anonymous
sweep: their redirect to sign-in does not serve settings content.

1. **lang** - `<html lang>` equals the BCP 47 tag of the locale prefix.
2. **keys** - no leaf path of the en-US catalogue appears in the text a reader
   sees, a labelled attribute, a button value or a script payload. Markup plumbing
   (`id`, `href`, `class`) is not read: a route name can share a key's dotted shape.
3. **copied page** - a non-English page must not have identical normalized
   server-rendered text to its English baseline. Both English locales are exempt.
   Word overlap is reported as a diagnostic only: shared vocabulary and the
   documented English fallback in game tips do not prove a page is untranslated.

Non-200 responses, redirects, empty text, an empty sitemap or an unmatched
`--only` selection fail. Filtered runs fetch their English baselines even when
those routes are outside the selected slice; a failed baseline fails its dependants.

It runs in the SEO contract job of `verify.yml` against the built site, and can
be pointed at anything:

```bash
cd apps/puzzled
bun run verify:locale --base http://localhost:3000          # a local build
bun run verify:locale --only /ja --only /es/pricing --json  # one slice
```

Exit code 1 on any failed page; the JSON carries each page's findings.

## Coverage boundary

The check parses the server response without executing scripts or loading
subresources. HTML entities and labelled attributes are decoded by the existing
HTML parser. Known dotted catalogue leaves are checked; misspelled or unknown
keys are outside that catalogue-derived matcher.

This is not browser interaction coverage. A hydration payload is scanned for
literal keys, but it does not prove that a later client render uses them correctly.
Lazy dialogs and authenticated pages need their own browser tests. The check
also does not prove every phrase is translated or evaluate translation quality.

## Native-speaker review

The sweep checks known key leaks in the inspected responses and the declared
language, not every interactive state. It cannot prove the ja, es and pt-BR copy reads naturally. That review is recorded in
[native review](i18n-native-review.md); update the date and the lines there when a
locale's copy changes.
