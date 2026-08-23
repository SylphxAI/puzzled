# Puzzled identity graph

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
