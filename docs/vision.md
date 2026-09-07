# Puzzled Vision

**Status:** Canonical product destination
**Identity graph:** [`capabilities.md`](capabilities.md)
**North Star package:** [`north-star/README.md`](north-star/README.md) (field contract subordinate to this destination), [`north-star/VISION.md`](north-star/VISION.md) (pointer), [`north-star/NORTH-STAR-METRIC.md`](north-star/NORTH-STAR-METRIC.md)

This document owns the long-term product destination. It does not claim the destination is landed or live. If the north-star package or an ADR conflicts with this file or [`capabilities.md`](capabilities.md), this file and the identity graph win.

## Destination

Puzzled is the default daily home for light, positive, brain-training play — minutes a day, optional depth, unlimited catalog under one protocol — a free daily finish floor, habit first, subscription second, shareable results without spoilers.

Catalog ambition is unbounded: every game that fits the daily light brain ritual (word, logic, pattern, mini crossword, sudoku family, spatial, and light entertainment oracle formats labeled as play) should eventually live here under the single module protocol (day key in `Asia/Hong_Kong`, run, finish, result card, entitlement). Capability ambition is not unbounded sprawl.

## Users and their jobs

- **Daily player** who wants a short uplifting mental break in minutes and to share a non-spoiler result.
- **Weekly ritualist** who returns daily, uses archive/stats, and optionally subscribes when the habit warrants it.
- **Virality loop:** one shared day, minutes-to-complete, soft failure, non-spoiler card, zero-install first play.

## Not doing

- Hardcore esports/ranked ladders as core, gambling/loot-box, scientific/medical/IQ/destiny claims.
- Infinite content-farm SEO spam or dark-pattern streak punishment.
- Shrinking catalog to look minimal — unbounded catalog is the destination.
- A second play authority behind a different transport (Connect `PuzzleService` is sole authority).
- Charging for today's featured free ritual, or selling the solution.

## Product oracle

The destination is true only when a non-technical player on a phone can finish today's featured ritual in minutes without payment or account, share a non-spoiler card with a `?date=` deep link, and return the next product day without push, with server-authoritative serve+validate, one finish per `(user, module, day_key)`, and with empty-catalog and mute-blog never presented as live, at the live layer.

Source green, `GET /healthz` 200, and `GET /` 200 are not this oracle.

## North Star Metric

**daily puzzle completers** — distinct users who complete at least one qualifying `puzzle_ritual` on product day D in `Asia/Hong_Kong`. Multiple finishes by the same user on D still count as one. Secondary entertainment metric: **daily entertainment completers**. Do not invent a house score acronym. Field definition: [`north-star/NORTH-STAR-METRIC.md`](north-star/NORTH-STAR-METRIC.md) (`PUZ-NSM`).

## Clients (company dest)

Consume owner ADR-038. This product calls peer public APIs with those
products' credentials and their generated Rust or TypeScript SDKs. It
does not implement Backend-as-a-Service, compile a mega-client, or use
`{project}.api.sylphx.com` as dest.
