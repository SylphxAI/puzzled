# Protocol sole-writer cutover

**Status:** Normative  
**Revision:** 2026-08-12  
**Cut:** predecessor duals → five protocol concepts + HRC Polar  
**Terminal:** destination is the only writer on each named surface; predecessors deleted or inbound-alias only.

This is the living cut list for the model already declared in
[RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md) and
[NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md). It does **not** add a sixth
concept.

---

## 1. Named surfaces

| Surface | Predecessor (retire) | Destination (sole writer) |
|---------|----------------------|---------------------------|
| Day clock | UTC day-of-year, client locale, `CURRENT_DATE` | `product_day_key` / `Asia/Hong_Kong` |
| Polar quantity | `GetTodayOverview.playerCount`, DAU, raw finish counts | `compute_drc` / `compute_hrc` on `game_sessions` |
| Share / card | `Play at puzzled.gg`, origin-only, per-game ad-hoc text as a second stack | `formatRitualShareText` + module+`date=` deep link |
| Finish | Client `isComplete` vs leaked solution | Server `SubmitGuess` after validation |
| Module identity (player) | LinkedIn **Queens** / **Tango**; NYT **Wordle** / **Connections** / **Quordle** / **Spelling Bee** / **Letter Boxed** as titles | CATALOG player titles; slugs `crowns` / `duo` |
| Play transport | REST `/api/v1` play, Hono client | Connect `PuzzleService` only (ADR-170) |
| Product API host | `puzzled.api.sylphx.com` sidecar | `idle-tie-elxzm6.sylphx.app` + same-origin `/puzzled.v1.*` on `puzzled.gg` |

Inbound **aliases** (`queens`→`crowns`, `tango`→`duo`, historic Wordle URLs) are not second products. They rewrite to the canonical slug. New writes persist **only** the canonical slug.

---

## 2. Backfill

On apply:

1. If both alias and canonical ritual rows exist for the same `(user_id, day_key)`, keep the earlier qualifying finish; drop the extra from the unique ritual index.  
2. `UPDATE game_sessions SET game_slug = 'crowns' WHERE game_slug = 'queens'` (and `tango`→`duo`).  
3. Same rewrite on `daily_puzzles.game_slug`.

DRC/HRC are `COUNT DISTINCT user_id` — collapsing alias/canonical pairs must not invent users.

---

## 3. Oracles (this cut)

1. `canonicalize_game_slug("queens") == "crowns"` and `"tango" == "duo"` in core + TS tests.  
2. No player-facing title string `Queens` or `Tango` in `apps/puzzled` (rules may say “crown”, not the LinkedIn product name).  
3. No `Play at puzzled.gg` share stack in `apps/puzzled/src/games`.  
4. `useGameAnalytics` does not import `useAnalytics` (dynamic chunks use `useSafeAnalytics`).  
5. Live: `puzzled.gg/games/crossword` hydrates a playable ritual (not Global Error); GetDaily has zero `"answer"` keys; share path is `/games/<canonical>?date=YYYY-MM-DD`.  
6. Live: `/games/queens` redirects to `/games/crowns`; title is Crowns.

---

## 4. Authority

LinkedIn Help documents **Queens** and **Tango** as LinkedIn Games product names
([Queens](https://www.linkedin.com/help/linkedin/answer/a6269510),
[Games hub](https://www.linkedin.com/games)). Mechanics (one mark per row /
region; two-symbol balance) are not those marks. CATALOG §3.2–3.3 is the
player-title law.

`GetTodayOverview` may remain **chrome** (how many people touched something
today). It is **not** DRC and must not be labeled as Polar.

---

## 5. Path

PR → Merge Queue → main → Auto Deploy → live oracles.  
Merged ≠ done. Deployed ≠ done.
