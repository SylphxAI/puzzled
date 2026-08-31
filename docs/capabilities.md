# Puzzled identity graph

Clients consume owner ADR-038: peer generated SDKs and peer credentials on dest peels. Mega-clients and `{project}.api.sylphx.com` are not dest.

**Status:** Identity registry. Not live proof.
**Scope:** Puzzled — daily light brain-ritual suite (Connect Rust authority + content store).
**North Star package:** [`north-star/README.md`](north-star/README.md) + [`north-star/RITUAL-AND-MODULE-PROTOCOL.md`](north-star/RITUAL-AND-MODULE-PROTOCOL.md)
**Cite:** the **ID** column.

This file is the identity graph. It is not a PRD, ADR index, or live grade. Destination stays in [`vision.md`](vision.md). Field law stays in `north-star/`, `adr/ADR-170*`, `apps/puzzled`, and the Connect `PuzzleService`. If this file conflicts with the package, the package wins.

```text
ID | Identity | Fate | Depends on | Done when
```

## Graph

| ID | Identity | Fate | Depends on | Done when |
| --- | --- | --- | --- | --- |
| PUZ-MODULE | Module protocol (day key, finish, card, entitlement) | live | — | `product_day_key` in `Asia/Hong_Kong`, `puzzle_ritual` or `entertainment_oracle` admission, daily content store serve, server-authoritative `SubmitGuess` validate, one finish per `(user, module, day_key)`, non-spoiler common chrome + deep link — validated at the live layer. |
| PUZ-DAILY | Daily ritual play (catalog under one protocol) | live | PUZ-MODULE | Any admitted module completes in ~5–15 min as a daily ritual with finish honesty and result card at the live layer; catalog unbounded, exposure small. |
| PUZ-SHARE | Viral share loop (non-spoiler) | live | PUZ-DAILY | `formatRitualShareText` + module+`date=` link produces correct non-spoiler share without leaking the solution at the live layer; home does not dump full catalog on cold users. |
| PUZ-ORIGIN | Original content authority | live | PUZ-MODULE | Daily puzzles are original or public-domain; no third-party publisher daily grid is taken; entertainment oracles are play, not advice, at the source layer. |
| PUZ-MARKS | Third-party marks as slugs/titles | dead | — | Marks `Wordle/Connections/Strands/Spelling Bee/Letter Boxed/Queens/Tango` and obvious misspellings as player titles or slugs carry no fate; canonical slugs are `crowns`/`duo` with inbound aliases only. |

## Release boundary (GOV-017)

Company ADR-030 consequence (Owner runbook GOVERNANCE-AUDIT-2026-08-28,
row GOV-017): every Active product declares its public probe, owned
manifest/migration writers, consumed receipts, runtime effects, and
forbidden writes. Declared from this graph and this repository's docs;
not live proof. Facts not establishable here are `Unknown`, never green.

- **Public probe:** on `https://puzzled.gg`, a player finishes today's
  featured ritual in minutes through Connect `PuzzleService`
  (`SubmitGuess` server-authoritative, one finish per
  `(user, module, day_key)`), then shares a non-spoiler card with a
  `?date=` deep link (`PUZ-MODULE`, `PUZ-DAILY`, `PUZ-SHARE`). That
  live loop is the cheapest customer-visible falsifier. Source green
  and `GET /healthz` 200 are not this probe (vision). Naming the
  locator is not a live-success claim. README records a prior HTTP GET
  timeout; reachability remains `Unknown` here.
- **Owned manifest/migration writers:** this repository owns
  `sylphx.toml` (dockerfile `web` and `api`, `path_prefixes`, health
  paths, `[database.migrations]` Atlas Job on the `api` image) and the
  Atlas track (`apps/puzzled/atlas/migrations/`,
  `apps/puzzled/atlas.hcl`). It owns no kube or Release-intent writer:
  Platform owns build, binding, HTTPRoute, Deployment, and Kubernetes
  state. The authority that admits Puzzled's own production Release is
  not named in this graph — `Unknown`. Leftover Vercel is not a
  writer. `preview_deploys = true` is preview autoDeploy only; it is
  not production Promote.
- **Consumed receipts:** Platform-issued JWT as the Connect caller
  identity (README). This graph has no Identity edge, so whether those
  tokens are Sylphx Identity receipts is `Unknown`. Platform
  Deployment and Hands realization receipts for the `sylphx.toml`
  services, consumed as a customer, not owned. Whether Compute
  Schedule/Tick receipts are bound for Platform cron callbacks to
  `JobsService` is `Unknown`.
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
  admission or `Live`. Never `GET /healthz` as the product oracle.
  Never a Schedule/Tick writer — Compute owns due time; JobsService
  handlers stay receivers.

Unknown in this declaration: the authority admitting this product's
own production Release; whether Platform JWT is an Identity receipt;
whether Compute Schedule receipts are bound for JobsService; whether
the current production Release matches `sylphx.toml` or passes the
public probe. Those are live- or owning-lease facts, not greened here.
