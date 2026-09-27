# Puzzled capabilities

Clients consume owner ADR-038: peer generated SDKs and peer credentials on dest peels. Mega-clients and `{project}.api.sylphx.com` are not dest.

**Status:** Capability table (owner `standards/docs.md` format).
**Scope:** Puzzled — daily light brain-ritual suite (Connect Rust authority + content store).
**North Star package:** [`north-star/README.md`](north-star/README.md) + [`north-star/RITUAL-AND-MODULE-PROTOCOL.md`](north-star/RITUAL-AND-MODULE-PROTOCOL.md)
**Cite:** the **ID** column.

This file is the capability table. It is not a PRD or ADR index. Destination stays in [`vision.md`](vision.md). Field law subordinate to that destination stays in `north-star/`, `adr/ADR-170*`, `apps/puzzled`, and the Connect `PuzzleService`. The north-star package is migration input and field contract; if it conflicts with `vision.md` or this graph, vision and this graph win.

```text
ID | Capability | Status | Code | Depends on
```

Status is what a live end-to-end test measured (owner `standards/docs.md`),
last on production web `4f540e3f`, 2026-09-26/27: a guest fetched and finished
every game's daily puzzle, and a browser loaded every game page.

## Table

| ID | Capability | Status | Code | Depends on |
| --- | --- | --- | --- | --- |
| PUZ-MODULE | Module protocol: day key (`Asia/Hong_Kong`), server-authoritative finish, result card, entitlement check | supported | `crates/puzzled-server/src/capabilities/puzzle_play`, `crates/puzzled-core/src/capabilities` | — |
| PUZ-DAILY | Daily play: 19 games under one protocol, each finishable in about 5–15 minutes | supported | `apps/puzzled/src/features/daily`, `crates/puzzled-server/src/capabilities/puzzle_play` | PUZ-MODULE |
| PUZ-CONTENT | Daily-puzzle pipeline and server grading: every game stored 14 days ahead plus the 30-day archive, hourly Compute tick and start-up; guesses graded on the server (`CheckGuess`); the answer returns only with the accepted finish | supported | `crates/puzzled-server/src/capabilities/daily_pipeline` | PUZ-MODULE |
| PUZ-FREE | Free daily puzzle: a guest finishes today's featured puzzle without payment or account; no billing read on the play path | supported | `apps/puzzled/src/lib/free-rotation.ts`, `crates/puzzled-server/src/capabilities/puzzle_play` | PUZ-MODULE |
| PUZ-SHARE | Share a result card without spoilers, with a `?date=` deep link | supported | `apps/puzzled/src/features/daily/lib/share-text.ts` | PUZ-DAILY |
| PUZ-HABIT | Gentle return habit: streaks and milestones from accepted days, no punishment for a missed day | partial | `apps/puzzled/src/lib/streak-info.ts`, `crates/puzzled-server/src/capabilities/gamification` | PUZ-FREE |
| PUZ-ACCOUNT | Sign-in with Sylphx Auth; results follow the account | blocked-on-platform | `crates/puzzled-server/src/capabilities/identity_access`, `apps/puzzled/src/lib/identity` | PUZ-MODULE |
| PUZ-NSM | Daily puzzle completers, recomputable from finish records | supported | `crates/puzzled-server/src/capabilities/puzzle_play/adapters/game_sessions_db.rs` | PUZ-MODULE |
| PUZ-PLUS | Puzzled Plus: every game, archive, stats, family plan. Dormant: the direct-Stripe code from #237 is deployed but closed (no keys, 0 payers); it is replaced by Sylphx Money's checkout and entitlements API, not switched on | blocked-on-platform | `crates/puzzled-server/src/capabilities/billing`, `apps/puzzled/src/lib/billing` | PUZ-FREE |
| PUZ-OBS | Errors to Sylphx Observability through the Sylphx SDK; capture is refused (403) until Puzzled's key carries `observability:ingest` (SylphxAI/cloud#9450) | blocked-on-platform | `apps/puzzled/src/lib/observability`, `crates/puzzled-server/src/observability.rs` | — |
| PUZ-ORIGIN | Original or public-domain puzzles only; entertainment formats are play, not advice | supported | `crates/puzzled-core/src/capabilities` | PUZ-MODULE |
| PUZ-MARKS | Third-party marks (Wordle, Connections, Strands, Spelling Bee, Letter Boxed, Queens, Tango) as titles or slugs; canonical slugs are `crowns`/`duo` with inbound aliases only | retired | — | — |

Platform issues: PUZ-ACCOUNT waits on the Auth keys reaching web
(SylphxAI/cloud#9216); PUZ-PLUS waits on Sylphx Money's customer payments
(SylphxAI/cloud#9152) and the Money migration guide; PUZ-OBS waits on
SylphxAI/cloud#9450. PUZ-HABIT is partial because signed-in streaks cannot be
tested until PUZ-ACCOUNT works.

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
  (`PUZ-MARKS` `retired`). Never kube, HTTPRoute, or Journal `spec`
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
