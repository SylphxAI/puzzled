# Puzzled identity graph

This graph decomposes the [product destination](vision.md) into durable
identities. One colloquial name has one fate. Dependencies are correctness
prerequisites, not roadmap order. Each `Done when` entry is a falsifiable
oracle; the table records no implementation, release, deployment, or live
status.

| ID | Identity | Fate | Depends on | Done when |
| --- | --- | --- | --- | --- |
| `PZL-001` | Product day and module protocol | live | — | For every admitted module, the server derives one product day, binds at most one primary daily puzzle for that module and day, and exposes its class, terminal rules, result-card mapping, and access policy without exposing a solution. |
| `PZL-010` | Player identity and access | live | — | A guest has a stable day identity for the free ritual; an account is accepted only from verified Platform identity; free, premium, and archive admission fails closed from server-evaluated entitlement, while at least one daily puzzle finish remains free. |
| `PZL-020` | Find today's ritual | live | `PZL-001`, `PZL-010` | From the product entry a guest can identify and open the server-selected free puzzle in one action; unavailable or locked choices explain the recovery path without presenting them as playable, and the displayed product day agrees with the server. |
| `PZL-030` | Serve an authoritative puzzle run | live | `PZL-001`, `PZL-010` | Daily and entitled archive requests return the requested module's playable puzzle plus immutable server identity and mode, never its solution; invalid module, day, identity, or entitlement is rejected without a client-generated fallback. |
| `PZL-040` | Play a complete module interaction | live | `PZL-030` | On supported viewports and inputs, every admitted module renders its rules and playable state, gives legible action and error feedback, preserves a clean stop or retry path, and can produce its declared terminal submission without asserting that the result was accepted. |
| `PZL-050` | Server-authoritative result validation | live | `PZL-030` | For every admitted module, the server reloads or deterministically re-derives the served puzzle, validates the full terminal submission with module rules, derives status and score itself, accepts valid play, and rejects tampered, incomplete, stale daily, or mismatched-puzzle claims. |
| `PZL-060` | Canonical completion record | live | `PZL-010`, `PZL-050` | An accepted terminal result is committed exactly once for player, module, and product day with its authoritative mode and result fields; concurrent or repeated submission returns the existing/already-played outcome, and a failed write cannot appear as saved completion or progress. |
| `PZL-070` | Result, re-entry, and non-spoiler share | live | `PZL-060` | After acceptance, refresh and re-entry show the same canonical outcome rather than another playable run; the result card omits the solution and its deep link opens the same module and product day for an eligible recipient. |
| `PZL-080` | Personal progress and history | live | `PZL-060` | Today completion, totals, per-module results, and history are derived from canonical accepted records and agree across home, result, and progress surfaces; account progress agrees across devices, and guest-to-account adoption preserves accepted results without duplication. |
| `PZL-090` | Gentle habit and mastery | live | `PZL-080` | Streaks, milestones, and achievements are derived from the same accepted day progress, remain consistent after retry or delayed synchronization, and an ordinary missed day does not erase unrelated earned history, paid access, or identity. |
| `PZL-100` | Archive and paid depth | live | `PZL-040`, `PZL-060` | An entitled player can select a past puzzle, complete it through the same serving, validation, and record authorities, and find it in personal history; a non-entitled request fails closed, and archive play cannot count as today's ritual finish. |
| `PZL-110` | Protocol-complete catalog expansion | live | `PZL-001`, `PZL-040`, `PZL-070` | A new module becomes customer-reachable only when its metadata, content source, interaction, terminal contract, server validator, canonical record, re-entry, and non-spoiler result mapping pass the shared module conformance oracle without adding a parallel authority. |
| `PZL-120` | Product-value observability | live | `PZL-060` | Daily puzzle completers can be recomputed for a product day from canonical qualifying records, excluding archive, practice, entertainment, admin, dry-run, and duplicate activity; the product read model matches that recomputation within its declared late-event window. |

## Contract locators

- Product ritual rules and metric semantics:
  [Ritual and module protocol](north-star/RITUAL-AND-MODULE-PROTOCOL.md) and
  [North Star Metric](north-star/NORTH-STAR-METRIC.md)
- Sole transport and execution authority:
  [ADR-170](adr/ADR-170-clean-break-north-star.md)
- Executable play contract: [`proto/puzzled/v1/puzzle.proto`](../proto/puzzled/v1/puzzle.proto)
- Executable personal-progress reads: [`proto/puzzled/v1/stats.proto`](../proto/puzzled/v1/stats.proto)

Interface fields and current behavior belong to those executable contracts and
tests. Current source work belongs to product pull requests, not this graph.
