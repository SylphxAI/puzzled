# Game protocol

The rules every game follows, so Puzzled can host any light daily brain game
without inventing a new product per title. Engineering implements it (content
store, Connect `PuzzleService`, pure validators in `puzzled-core`); this file
owns what a game must do to ship. The list of games and naming rules is
[catalog.md](catalog.md).

## Five concepts

| Concept | Meaning |
| --- | --- |
| Day key | The product's "today" for shared content |
| Game module | Rules, UI, validation and result-card mapping for one game |
| Daily run | One official attempt for `(user, game, day_key)` |
| Result card | A shareable summary that does not spoil the answer |
| Entitlement | Free or Plus access to content and modes |

Themes, cosmetics, multiplayer and entertainment games compose on these five.
A new cross-cutting feature should say which concept it extends, whether daily
puzzle completers still recompute cleanly ([metrics.md](metrics.md)), and that
there is still one finish authority; if it needs a second parallel product,
redesign it.

## Day key

- Timezone `Asia/Hong_Kong`, format `YYYY-MM-DD`, computed on the server for all
  daily content and finish recording. Clients may show local clocks but never
  choose the day key.
- One timezone because shared conversation ("today's puzzle") breaks if every
  player has a private day boundary. Changing it is a protocol change that also
  migrates the completers definition, not client behaviour.
- Each `(game, day_key)` has at most one primary daily puzzle in the content
  store, or a documented deterministic server generator (sudoku). Practice
  content is undated or marked practice; archive content is dated but marked
  archive. Neither counts toward completers.

## Game module

A game has a stable slug (the URL and registry key) and a class:
`puzzle_ritual` counts toward daily puzzle completers; `entertainment_oracle`
counts only toward entertainment completers. A new class needs an amendment to
[metrics.md](metrics.md) first.

A puzzle game must:

1. Serve today's puzzle without leaking the solution to the client.
2. Validate submissions on the server with pure rules in core.
3. Define when a run is terminal (win, exhausted loss, other).
4. Record the finish only through api success paths.
5. Map the terminal state to result-card fields (no solution text by default).
6. Declare free or Plus access ([monetization.md](monetization.md)).
7. Fit a daily mode of about 5 to 15 minutes; longer modes are opt-in, not the default.
8. Treat a second finish for `(user, game, day_key)` as review, not another write.

A game must not trust client scores, solutions or completion flags; require
payment for the designated free daily puzzle; ship without a result-card
mapping; or use real-money gambling mechanics. Shipping without a registry
entry (`apps/puzzled/src/games/registry.ts` and server dispatch) and a server
validator is a rejected change.

Entertainment games (future-baby, playful match and similar) are labelled as
entertainment, not advice or science; their result cards may be flashy but must
avoid harmful claims, and they never count toward puzzle completers.

## Daily run

Lifecycle: open, play (guesses validated), terminal, persist (server stores the
outcome), card, re-entry (results and review, already played).

- One terminal finish per `(user or guest day id, game, day_key)`, even when a
  deterministic generator gives no stable `puzzle_id`. The submit path must
  still guard already-played in that case (`submit_must_guard_already_played`:
  do not gate that helper on `puzzle_id`). The write path enforces uniqueness;
  recompute rows do not need the game slug.
- Finishing one game does not consume another; a second game the same day is how
  suite depth happens, and it is still one completer day.
- Guests are welcome and are the main landing path. Their identity is stable for
  one day; upgrading to an account keeps day history where implemented.

## Result card

The viral unit. Prefer it non-spoiler, readable at a glance in a feed (pattern,
score, streak or time band), labelled with day and game so friends know which
puzzle, shareable in one tap (Web Share or clipboard text), and linking to the
same game and day (`?date=`). Give every game the same chrome so the brand is
recognisable, and a text alternative for visual grids. Avoid sharing the answer
as a flex, or any share that needs an install before playing. The card and its
image must never contain the solution.

## Entitlement

At least one puzzle game is finishable every day without a subscription
(the featured rotation). Plus covers past days, the other games and advanced
stats, declared per game. Enforcement is on the server and fails closed to the
free floor ([monetization.md](monetization.md)).

## Content pipeline

Prefer puzzles pre-generated into `daily_puzzles` by the api's daily pipeline
(14 days ahead, 30-day archive); allow deterministic server generators for
specific games; never let a client invent a daily solution. Content for a day
should exist before that day's traffic.

A generator is frozen once it has stored rows. To improve a game's content, add a
new generator version for new days (`generate::current_generator_version`), keep
the old one reproducing its stored rows, and record the version on each row
(`daily_puzzles.generator_version`); never rewrite a served or finished puzzle.
The Mini Grid did this with `rust-crossword-v2`.

## Floors a change must not break

These protect players and the North Star. Engineering cleanups (deleting
retired duplicate surfaces, refactoring internals) are welcome, but lines of
code removed is not a success measure.

- Do not delete or hollow a catalog game without a migration plan (redirects,
  data retention, owner acknowledgement in the pull request).
- Do not remove the free daily finish for any player.
- Do not restore client-trusted solutions, scores or completion flags, or add a
  second play authority such as a REST submit path.
- Do not add a game without server validator, registry entry and card mapping.
- Keep a path to record and recompute completers for any new play path.

Journeys that stay possible after every merge (`scripts/verify-live.ts` covers
the live subset):

| ID | Journey |
| --- | --- |
| P1 | Free today's puzzle, play, terminal, result card |
| P2 | Open a shared card as a new guest and play the same day |
| P3 | Second game the same day |
| P4 | Sign in and see streak and history |
| P5 | Archive: a past day is served with Plus (or while Plus is not on sale) and refused with an unlock path otherwise; a future day is refused |
| P6 | Api `/healthz` and web ready |
| P7 | Admin lists games |

Evidence layers follow the owner standard: a merged change, a deployed change
and a working product are different claims
([owner docs standard](https://github.com/SylphxAI/owner/blob/main/standards/docs.md#claims-stay-inside-their-layer)).

## Public player disclosure boundary

Public leaderboard rows expose rank, score and display name, never an account or
player UUID or a stable surrogate derived from one. The compatibility `user_id`
wire field is a fresh random per-response entry identifier. A private `is_viewer`
marker preserves own-row highlighting; avatar URLs are omitted because their
paths can reveal stable account identifiers. Responses use private/no-store
browser and CDN directives. Internal aggregate caches still hold private join
keys; sanitization runs after every cache read and before serialization.

Share cards remain puzzle/result summaries rather than identity links; `/profile`
is the signed-in player's own card, not a public directory. Removing disclosure
reduces discovery but does not revoke already cached identifiers or repair object
authorization. Identity/adoption authorization containment is a separate concurrent
security outcome. Ops must invalidate previously cached leaderboard API/page
responses through the platform/CDN owner and verify the deployed public boundary.
