# Puzzled identity graph

Clients consume owner ADR-038: peer generated SDKs and peer credentials on dest peels. Mega-clients and `{project}.api.sylphx.com` are not dest.

**Status:** Identity registry. Not live proof.
**Scope:** Puzzled — daily light brain-ritual suite (Connect Rust authority + content store).
**North Star package:** [`north-star/README.md`](north-star/README.md) + [`north-star/RITUAL-AND-MODULE-PROTOCOL.md`](north-star/RITUAL-AND-MODULE-PROTOCOL.md)
**Cite:** the **ID** column.

This file is the identity graph. It is not a PRD, ADR index, or live grade. Destination stays in [`vision.md`](vision.md). Field law subordinate to that destination stays in `north-star/`, `adr/ADR-170*`, `apps/puzzled`, and the Connect `PuzzleService`. The north-star package is migration input and field contract; if it conflicts with `vision.md` or this graph, vision and this graph win.

```text
ID | Identity | Fate | Depends on | Done when
```

## Graph

| ID | Identity | Fate | Depends on | Done when |
| --- | --- | --- | --- | --- |
| PUZ-MODULE | Module protocol (day key, finish, card, entitlement) | live | — | `product_day_key` in `Asia/Hong_Kong`, `puzzle_ritual` or `entertainment_oracle` admission, daily content store serve or documented deterministic generator fallback, server-authoritative `SubmitGuess` validate, one finish per `(user, module, day_key)`, non-spoiler common chrome + deep link — validated at the live layer. |
| PUZ-DAILY | Daily ritual play (catalog under one protocol) | live | PUZ-MODULE | Any admitted module completes in ~5–15 min as a daily ritual with finish honesty and result card at the live layer; catalog unbounded, exposure small. |
| PUZ-FREE | Free daily finish floor | live | PUZ-MODULE | Every product day a guest can start and finish ≥1 `puzzle_ritual` without payment or account, with a result card, at the live layer. Featured rotation ("today's pick") uses the product day-key (`Asia/Hong_Kong`, flips at HKT midnight). No billing read sits on the play path. |
| PUZ-NSM | daily puzzle completers | live | PUZ-MODULE | Distinct users with ≥1 server-accepted qualifying `puzzle_ritual` finish on product day D (`Asia/Hong_Kong`) are recomputable from canonical records, excluding archive, practice, entertainment-oracle, admin, dry-run, and duplicate ticks, at the live layer. |
| PUZ-HABIT | Gentle return habit | live | PUZ-FREE | A player can return the next product day without push and find today's ritual; streaks and milestones derive from accepted day progress; an ordinary missed day does not erase unrelated history, paid access, or identity; no dark-pattern streak punishment, at the live layer. |
| PUZ-SHARE | Viral share loop (non-spoiler) | live | PUZ-DAILY | `formatRitualShareText` + module+`date=` link produces correct non-spoiler share without leaking the solution at the live layer; home does not dump full catalog on cold users. |
| PUZ-CONTENT | Daily-puzzle pipeline and server grading | live | PUZ-MODULE | The api generates and stores every game's puzzle 14 days ahead and keeps the 30-day archive (19 games), on the hourly Compute schedule and at start-up, generating a missing day on first read; word games are graded per guess (`CheckGuess`), clients play from a solution-free payload, and the answer returns only with the accepted finish, at the live layer. |
| PUZ-PLUS | Puzzled Plus: every game, archive, stats, family | dormant | PUZ-FREE, Sylphx Money | Decided 2026-09-26 in [#235](https://github.com/SylphxAI/puzzled/issues/235); policy in [MONETIZATION.md](north-star/MONETIZATION.md). Prices and seats live only in Sylphx Money's `catalogs/default`; no amount is in this repository. The Money path is built in `crates/puzzled-server/src/capabilities/money` and switches on when `SYLPHX_MONEY_URL` and `SYLPHX_SECRET_KEY` are set: every entitlement read is `entitlement_grants:check` (cached at most 60 seconds, never past `expire_time`, failing closed), checkout is a server-created Money `checkout_sessions` the browser is redirected to after the buyer ticks the immediate-supply consent (stored as one `checkout_consents` row), the pricing page and `ListPlans` read `catalogs/default`, and account erasure refuses while a Money subscription renews. The Stripe-based code from #237 stays, closed (no keys, nothing sold, nothing locked), until the follow-up PR deletes it. Done when a player buys the market-priced subscription through Sylphx Money's hosted checkout, Money's entitlements API unlocks every game and past day, the 14-day first-subscription refund and period-end cancellation hold, a family plan shares with up to 4 people, the free daily puzzle never reads billing and a failed entitlement read refuses paid play, at the live layer. |
| PUZ-OBS | Errors to Sylphx Observability | live | — | Server, api and browser errors are captured through the Sylphx SDK (no third-party error SDK); capture is accepted once Puzzled's environment key carries `observability:ingest` (SylphxAI/cloud#9450), at the live layer. |
| PUZ-ORIGIN | Original content authority | live | PUZ-MODULE | Daily puzzles are original or public-domain; no third-party publisher daily grid is taken; entertainment oracles are play, not advice, at the source layer. |
| PUZ-MARKS | Third-party marks as slugs/titles | dead | — | Marks `Wordle/Connections/Strands/Spelling Bee/Letter Boxed/Queens/Tango` and obvious misspellings as player titles or slugs carry no fate; canonical slugs are `crowns`/`duo` with inbound aliases only. |

## Release boundary (GOV-017)

Company ADR-030 consequence (Owner runbook GOVERNANCE-AUDIT-2026-08-28,
row GOV-017): every Active product declares its public probe, owned
manifest/migration writers, consumed receipts, runtime effects, and
forbidden writes. Declared from this graph and this repository's docs;
not live proof. Facts not establishable here are `Unknown`, never green.

- **Public probe:** on `https://puzzled.gg`, a guest finishes today's
  featured ritual in minutes without payment or account through Connect
  `PuzzleService` (`SubmitGuess` server-authoritative, one finish per
  `(user, module, day_key)`), then shares a non-spoiler card with a
  `?date=` deep link (`PUZ-MODULE`, `PUZ-DAILY`, `PUZ-FREE`,
  `PUZ-SHARE`). That live loop is the cheapest customer-visible
  falsifier. Source green, `GET /healthz` 200, and `GET /` 200 are not
  this probe (vision). Naming the locator is not a live-success claim.
  A prior README GET timeout is not current dest. Document GET 200 is
  reachability of the web document, not the probe.
- **Owned manifest/migration writers:** this repository owns
  `sylphx.toml` (dockerfile `web` and `api`, `path_prefixes`, health
  paths, `[database.migrations]` Atlas Job on the `api` image) and the
  Atlas track (`apps/puzzled/atlas/migrations/`,
  `apps/puzzled/atlas.hcl`). It owns no kube or Release-intent writer.
  Apps owns desired Service spec, hostname, and Journal `spec` as the
  hosting composer (Puzzled is an Apps customer). Hands realizes kube
  and Journal `status`. The authority that admits Puzzled's own
  production Release is not named in this graph — `Unknown`. Leftover
  Vercel is not a writer. `preview_deploys = true` is preview
  autoDeploy only; it is not production Promote.
- **Consumed receipts:** a Sylphx Auth end-user session (the web's
  session cookie or a Bearer), checked with Auth once per request.
  The Auth subject is another system's id: `auth_subjects` maps it, as
  the exact text Auth published, to Puzzled's own player id (`uuid`),
  so both `principal-<uuid>` and the TypeID `usr_…` that Auth moves to
  on 2026-10-04 (cloud#10008) reach the same player; the new form is
  never decoded. Players away through the cut are linked from the
  platform's id map export (`auth_subjects::LINK_FROM_ID_MAP`).
  Apps Deployment and Hands realization receipts for the
  `sylphx.toml` services, consumed as a customer, not owned. Compute's
  signed tick receipts (EdDSA JWT, `aud` equal to the exact URL) are the
  only admission for JobsService and the `/internal/compute/*` routes.
- **Runtime effects:** serve daily content; validate and persist one
  finish per `(user, module, day_key)`; emit non-spoiler share text
  and `date=` links; run JobsService retention handlers as product
  receivers. Web is presentation only — no backend authority, no DB.
  `api` is the single runtime schema writer.
- **Forbidden writes:** never a second play authority (REST `/api/v1`,
  Hono, client `isComplete`) — Connect `PuzzleService` is sole
  (`PUZ-MODULE`, vision). Never a third-party publisher daily grid
  (`PUZ-ORIGIN`). Never third-party marks as player titles or slugs
  (`PUZ-MARKS` `dead`). Never kube, HTTPRoute, or Journal `spec`
  writes. Never `{project}.api.sylphx.com` or a mega-client (ADR-038;
  CUTOVER retires `puzzled.api.sylphx.com`). Never a GitHub check
  name, webhook receipt, or deploy-status projection as Release
  admission or `Live`. Never `GET /healthz` or `GET /` as the product
  oracle. Never a Schedule/Tick writer — Compute owns due time;
  JobsService handlers stay receivers. Never the north-star package as
  dest over `vision.md` and this graph.

Unknown in this declaration: the authority admitting this product's
own production Release; whether the current production Release matches `sylphx.toml` or passes
the public probe. Document GET 200 is not that probe. Those are live-
or owning-lease facts, not greened here.
