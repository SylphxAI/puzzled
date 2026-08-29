# Puzzled Vision

**Status:** Canonical product destination
**Identity graph:** [`capabilities.md`](capabilities.md)
**North Star package:** [`north-star/README.md`](north-star/README.md) (normative 2026-08-13), [`north-star/VISION.md`](north-star/VISION.md), [`north-star/NORTH-STAR-METRIC.md`](north-star/NORTH-STAR-METRIC.md)
**Architecture law:** [`adr/ADR-170-clean-break-north-star.md`](adr/ADR-170-clean-break-north-star.md), [`adr/ADR-169-capability-first-modular-ddd.md`](adr/ADR-169-capability-first-modular-ddd.md)

This document owns the long-term product destination. It does not claim the destination is landed or live.

## Destination

Puzzled is the default daily home for light, positive, brain-training play — minutes a day, optional depth, unlimited catalog under one protocol — habit first, subscription second, shareable results without spoilers.

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

## Product oracle

The destination is true only when a non-technical player on a phone can finish today's featured ritual in minutes, share a non-spoiler card with a `?date=` deep link, and return the next product day without push, with server-authoritative serve+validate, one finish per `(user, module, day_key)`, and with empty-catalog and mute-blog never presented as live, at the live layer.

Source green and `GET /healthz` 200 are not this oracle. North Star Metric is daily puzzle completers.
