# Puzzled vision

## Goal

Puzzled is the default daily home for light, positive brain games: a few
minutes a day, one shared puzzle for everyone, and a result card you can share
without spoiling the answer. Habit comes first and the subscription second.

Why this shape: the daily games that became cultural habits (Wordle, the NYT
Games suite) grew because finishing today's puzzle creates a small social
object, the result card, that makes a friend curious about the same day. The
product is built around that loop, not around a large catalog or a paywall.
The catalog can grow without limit, as long as every game fits the same
daily-puzzle protocol ([game-protocol.md](game-protocol.md)) and home does not
dump the whole list on a new visitor.

## Who it serves

- **Daily player**: wants a short, uplifting mental break and to share a result
  that gives nothing away. Plays as a guest, on a phone, with no install.
- **Weekly regular**: returns most days, uses the archive and stats, and
  subscribes when the habit is worth paying for.

## What it costs and earns

Today's featured puzzle is free for everyone, always. Puzzled Plus, a
subscription in the NYT Games class, opens every other game, every past day,
stats for every game and a family plan. The policy is in
[monetization.md](monetization.md). Payments, subscription state and
entitlements go through Sylphx Money, the platform's payments service; the
product builds no billing of its own.

## What we won't do

- Charge for today's featured puzzle or sell the solution. The free finish is
  what creates daily habit, and habit is what a subscription is sold to.
- Hardcore ranked ladders as the main social surface, gambling or loot boxes,
  and scientific, medical, IQ or destiny claims. They pull the tone away from
  light and positive, and the claims are not ours to back.
- Dark-pattern streak punishment or false urgency. A missed day should not
  erase progress; trust is worth more than a short-term conversion.
- A second play authority. The Rust api (Connect `PuzzleService`) alone decides
  results, so a client can never assert a finish or hold an answer.
- Thin pages that exist only to rank in search, or another publisher's daily
  puzzle or trademarked title ([catalog.md](catalog.md)).
- Shrinking the catalog to look minimal. Breadth gives more reasons to return
  each day; it must not change how success is counted.

## How success is measured

The North Star is **daily puzzle completers**: distinct players who finish at
least one qualifying daily puzzle on a product day. Definition, supporting
metrics and stop-the-line signals are in [metrics.md](metrics.md).

Targets, to be recalibrated once live baselines exist:

| Metric | Target direction |
| --- | --- |
| Daily puzzle completers | Grows week over week; never falls without a deploy or content explanation |
| D7 retention of new completers | Measured first, then improved; own cohort curves, not industry medians |
| Weekly regulars (4 or more finish days in 7) | Grows faster than completers; leading indicator for subscriptions |
| Share-landing new completers | Every share that lands can be traced to a first finish |
| Free-to-Plus conversion among weekly regulars | Measured once Plus is on sale; paid players' completion stays close to free players' |

The live product check is what a non-technical player on a phone can do: finish
today's featured puzzle in minutes without payment or an account, share a
result card with a `?date=` link, and return the next day. A `200` from
`/healthz` or `/` is not that check (`bun run verify:live`,
[reference/live-verification.md](reference/live-verification.md)).

## Related

- [capabilities.md](capabilities.md): what exists and its measured status.
- [growth.md](growth.md): the loop and the ranked backlog.
- [design/README.md](design/README.md): brand, tokens, shell, page list.
