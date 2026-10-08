# Publisher content

`app.json` is the manually authored English and Traditional Chinese payload for
`SylphxAI/publisher-pages/content/apps/puzzled.json`. Keep `external` pointing to
`https://puzzled.gg`: this payload does not introduce duplicate product pages.
The publisher copy must name the exact Puzzled commit and `publisher/app.json`
in `source.note`. Apart from that provenance note, copy the payload unchanged.

## Authoring evidence

The first payload was checked against Puzzled commit
`9ee1ffeb436b183467a27e35ca1d52609b7d9f4f` on 2026-10-08. The privacy update date
is the date this publisher payload was authored, not a claimed deployment date.

| Payload claim | Product-owned source at that commit |
| --- | --- |
| One inbox, `hi@puzzled.gg`, for support, privacy and legal; email replies without a promised response time | `apps/puzzled/src/lib/config/app.ts:11-23`; `apps/puzzled/src/messages/{en-US,zh-HK}/support.json` |
| Account/profile fields, game sessions, preferences and push subscription data | `apps/puzzled/atlas/migrations/20260222000000_baseline.sql:81-154`; `crates/puzzled-server/src/capabilities/identity_access/adapters/platform_jwt.rs`; `crates/puzzled-server/src/capabilities/preferences/adapters/web_push.rs` |
| Analytics and advertising are separate opt-in choices; withdrawal clears the choices | `apps/puzzled/src/features/analytics/lib/consent.ts:19-58,75-95` |
| Error messages, stacks and query-free paths; no request bodies attached | `apps/puzzled/src/lib/observability/capture.ts:1-15,63-77`; `apps/puzzled/src/lib/observability/browser.ts` |
| Checkout and paid access use Money; today's featured puzzle is free | `README.md:9-14,29-36`; `AGENTS.md:58-61`; `crates/puzzled-server/src/capabilities/money/mod.rs`; `crates/puzzled-server/src/capabilities/money/tests.rs:258-291` |
| Hong Kong puzzle day, not device-local midnight | `apps/puzzled/src/lib/product-day.ts:1-9,89-94`; `AGENTS.md:54-55` |
| Access, export, correction and deletion requests go to the same inbox; the full policy remains on the product site | `apps/puzzled/src/messages/{en-US,zh-HK}/support.json:54-56`; `apps/puzzled/src/messages/{en-US,zh-HK}/legal.json`; `apps/puzzled/src/app/[locale]/(main)/privacy/page.tsx` |
| Existing hub listing and service declarations | `sylphx.toml`; the prior publisher card at `SylphxAI/publisher-pages@c8146c05e6aec5b8fc7fe02647243ee1e3be5506:content/apps/puzzled.json` |

This is a product data summary, not a second publisher legal policy. The
publisher owns its controller, rights and contact sections. Do not add response
SLAs, retention periods or provider guarantees without product evidence.
The payload does not claim that Plus is currently on sale: the README describes
it as built but not on sale. It also does not copy the older guest-progress FAQ:
`apps/puzzled/src/lib/guest-day-id.ts` now describes legacy metadata only, while
`apps/puzzled/src/lib/api/server-credential.test.ts` documents issued guest
session cookies. Guest account-transfer behaviour needs its own verification
before it can be described here.
