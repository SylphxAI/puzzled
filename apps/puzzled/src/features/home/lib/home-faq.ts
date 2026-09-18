/**
 * Message coordinates for the home FAQ.
 *
 * The copy lives at `home.faq.<key>.question` / `.answer` in every locale's
 * `home.json`, so the namespace the home FAQ reads from has to be `home.faq`.
 * `MarketingFaq` resolves `t(\`\${key}.question\`)` inside the namespace it is
 * handed, and next-intl prints the dotted path verbatim when the message is
 * missing — which is how `home.free.question` reached the page and its FAQPage
 * JSON-LD. Keeping the coordinates here lets the page and `home-faq.test.ts`
 * state them once.
 */
export const HOME_FAQ_NAMESPACE = 'home'
export const HOME_FAQ_KEYS = ['free', 'account', 'schedule', 'streak', 'share', 'catalog'] as const
