# Ritual and game module protocol

**Status:** Normative product contract for all shipped and future games  
**Revision:** 2026-08-12  
**Implements ambition:** unbounded catalog under five concepts  
**Polar dependency:** every qualifying finish this protocol defines is a DRC-day candidate and therefore an HRC input ([NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md))

---

## 1. Purpose

This protocol is the **deep basis** that lets Puzzled host “every light daily brain game of this type” without inventing a new product per title.

Engineering implements the protocol (content store, Connect PuzzleService, pure validators in `puzzled-core`).  
**This document owns the product rules** a module must obey to ship.

If a proposed feature cannot name which of the five concepts it extends, it is not yet designed.

---

## 2. The five concepts (full capability)

| Concept | Meaning | What must stay singular |
|---------|---------|-------------------------|
| **Day key** | The product’s notion of “today” for shared content | One SSOT timezone and server clock path |
| **Game module** | A plug-in: rules, UI, validation, result-card mapping | One registry, one slug, one `module_class` |
| **Ritual run** | One official attempt context for `(user, module, day_key)` | One finish authority (api + core) |
| **Result card** | Shareable, non-spoiler summary of the run | One chrome system; per-module fields only |
| **Entitlement** | Free vs premium access to content and modes | One billing authority (Platform); fail-closed |

Everything else (themes, cosmetics, optional multiplayer, oracles, stats, streaks) **composes** on these five. A sixth independent “progress product,” a second share stack, or a second day clock is a protocol breach.

**Simplicity test:** adding a module must not add a concept. Adding a concept requires a versioned protocol upgrade and a North Star package amendment.

---

## 3. Day key

### 3.1 SSOT

- Timezone: **`Asia/Hong_Kong`** (see [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md)).  
- Format: `YYYY-MM-DD`.  
- Computed **on the server** for all ritual content selection, free rotation, finish recording, DRC, and HRC.  
- Implementation: `puzzled_core::puzzle_play::daily_time::product_day_key`.  
- Clients may display local clocks. They must not choose `day_key` for ritual authority.

### 3.2 Why a single TZ (for now)

Shared conversation (“today’s puzzle”) collapses if every user has a private day boundary without product design. Two people in the same chat must be able to mean the same puzzle.

Multi-TZ is allowed only as a **versioned protocol upgrade** with:

1. Migration of DRC and HRC definitions  
2. A stated rule for the conversation object (whose “today” does a share card name?)  
3. Tests at the HKT midnight boundary **and** at the new zone’s midnight  

Ad hoc client-local `day_key` is forbidden.

### 3.3 Content binding

For each `(game_module_id, day_key)` there is at most one **primary ritual content** row in the content store (or a documented deterministic server generator fallback, e.g. sudoku).

Practice content is either undated or tagged `mode=practice` and excluded from DRC/HRC.  
Archive content is dated but `mode=archive` and excluded from DRC/HRC for day \(D\) (it may still be valuable play).

### 3.4 Midnight and the conversation object

At HKT midnight, “today” flips for:

- Featured free rotation  
- GetDaily content  
- New ritual runs  
- Which `day_key` a finish writes  

A result card minted at 23:59 HKT still names that `day_key`. A land after midnight opens the **new** today unless the card deep-links an explicit archive date (premium). This is the intended conversation seam. Do not “helpfully” keep serving yesterday without labeling it yesterday.

---

## 4. Game module

### 4.1 Identity

- **Slug:** stable string (e.g. `word-guess`, `sudoku`) — URL and registry key. Changing a slug is a user-facing break (redirects required).  
- **`module_class`:**  
  - `puzzle_ritual` — can create a **DRC** day (hence can feed **HRC**)  
  - `entertainment_oracle` — **DFC** only  
  - Future classes require a North Star package amendment before any finish is counted

### 4.2 Required capabilities (`puzzle_ritual`)

A module **must**:

1. **Serve** today’s content without leaking the solution to the client (ADR-170).  
2. **Validate** submissions server-side via pure rules (`puzzled-core` dispatch).  
3. **Define finish** — when a run is terminal (`success` / `exhausted_fail` / `other_terminal`).  
4. **Emit** a qualifying finish only through api success paths (`game_sessions` / `ritual.completed`).  
5. **Map** terminal state → **result card** fields (no solution text by default).  
6. **Declare** free vs premium access (see [MONETIZATION.md](MONETIZATION.md)).  
7. **Complete in spirit under ~5–15 minutes** for the daily ritual mode (soft product bar; hardcore marathon modes must be non-default and non-ritual unless explicitly reclassified).  
8. **Honor already-played** for `(user, module, day_key)` — review, not a second terminal write.  
9. **Be reachable** from home without a unique login or a unique billing product.

A module **must not**:

1. Trust client scores, solutions, or `has_completed`.  
2. Require payment to finish the designated free daily slot.  
3. Ship without a result-card mapping.  
4. Use real-money gambling mechanics.  
5. Claim scientific, medical, or IQ authority.  
6. Invent a private day clock.  
7. Count as DRC when played as archive or practice.

### 4.3 Entertainment oracle modules

Allowed: random or lightweight deterministic “fun” outcomes (future baby, past life, playful match, etc.).

Required:

- UI copy: **entertainment only**, not advice, science, destiny, or diagnosis.  
- Finish still server-recorded if counted in DFC.  
- Result card may be flashy; still avoid harmful claims and still avoid leaking anything that should stay private.  
- **Never** create a DRC day. **Never** tick HRC.  
- Age / sensitive-topic review before ship (Security × ethics). An oracle about a real person’s health, children, or finances is out of class.

### 4.4 Registration

Modules are listed in:

- Product registry: `apps/puzzled/src/games/`  
- Server / core slug list: `puzzled_core::puzzle_play::game_slugs`  

These lists must not drift. Shipping a module without registry + server validator + card mapping is a **delivery reject**.

### 4.5 Quality bar (not optional because agents are fast)

Protocol-complete means **production-shaped**, not scaffolded:

| Bar | Meaning |
|-----|---------|
| Rules | Pure, tested, including fail-complete and illegal-move reject |
| Content | Day \(D+n\) exists before day \(D+n\) traffic, or a documented generator |
| Serve | No `solution_json` on the wire |
| Persist | Qualifying finish written once |
| Card | Non-spoiler, common chrome, deep link |
| A11y | Playable with keyboard / screen reader at the level the UI kit supports; reduced-motion respected |
| Locale | Strings in the shipping locale packs; day_key remains SSOT |
| Disable | A flag or registry switch can hide the module without crashing home |
| Oracle | Fixture journey exists for play correctness ([EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md)) |

A stub route that 404s on submit is not a module. It is a hole in the catalog floor.

---

## 5. Ritual run

### 5.1 Key

```text
(user_or_guest_storage_id, game_module_id, day_key)
```

### 5.2 Lifecycle (product)

1. **Open** — user lands on today’s puzzle; guest identity minted if needed (`X-Puzzled-Guest-Id`).  
2. **Play** — guesses/moves validated as needed; illegal moves rejected without consuming a dishonest fail.  
3. **Terminal** — success or honest failure per rules.  
4. **Persist** — server stores outcome; writes ritual row if qualifying.  
5. **Card** — user may share.  
6. **Re-entry** — results / review; **already played**; no second DRC tick.

### 5.3 Already played

The free daily ritual admits **one** terminal finish per `(user, module, day_key)`, independent of whether a stable `puzzle_id` exists (deterministic generators included).

Shell enforces via session pre-check + uniqueness. Submit must still guard already-played when a content day is known **even if** `puzzle_id` is null (`submit_must_guard_already_played` — do not re-gate that helper on `puzzle_id`). Polar recompute rows (`RitualCompletionRow`) do not need `game_module_id`; uniqueness is a write-path concern.

Cross-module: finishing sudoku does **not** consume word-guess. Same-day second module is allowed and is how suite depth happens. It still counts as one DRC day.

### 5.4 Guests

Guest play is encouraged for viral landing and for the free floor.

| Rule | Detail |
|------|--------|
| Stability | UUID in `localStorage` + `puzzled_guest_id` cookie; header `X-Puzzled-Guest-Id` |
| Server form | `guest_<uuid>`; never collides with Platform `sub` |
| DRC / HRC | Guest identifiers **do** count; report auth/guest splits |
| Upgrade | Sign-in should attach prior guest day history where implemented |
| Fragility | Clearing site data creates a new person — do not treat guest-HRC as equal evidence to auth-HRC |
| Premium | Archive and non-rotation remain auth + entitlement gated |

### 5.5 Honest fail

A module that has a limited-guess or limited-life structure **must** define exhausted fail as terminal and card-eligible. Hiding fail so the user never “finishes” destroys DRC for people who played in good faith.

A module without a natural fail (e.g. some logic puzzles) may be success-only; document it. Do not invent fake lives to juice cards.

---

## 6. Result card (viral unit)

### 6.1 Requirements

| Requirement | Detail |
|-------------|--------|
| Non-spoiler default | No solution string; no paste of a full answer grid that trivializes the puzzle |
| Glanceable | Pattern / score / streak / time band readable in a feed |
| Day + module labeled | So friends know *which* ritual and *which* `day_key` |
| One-tap share | Web Share API and/or clipboard text |
| Deep link | Opens **today’s** same module when the card is for today; archive links are labeled and entitlement-gated |
| Accessible alternative | Text equivalent for visual grids |
| Common chrome | Puzzled mark; do not invent a second brand per module |

### 6.2 Anti-patterns

- Share that includes the answer “as a flex.”  
- Share that requires an app install before any play.  
- Different card systems per module with no common chrome (harms brand and Economy of attention).  
- Cards that cannot be parsed as “this is today’s X on Puzzled.”  
- Requiring an account solely to generate a card after a guest-legal finish.

### 6.3 What a card is for

A card is a **conversation object** that should produce a land and a first DRC. It is not, by itself, a habit. Habit is tomorrow and the day after. Cards that optimize shock or spoilers at the expense of return are illegal even if share rate rises.

---

## 7. Entitlement (summary)

Full rules: [MONETIZATION.md](MONETIZATION.md).

Protocol-level rules:

- **Free ritual floor:** at least one `puzzle_ritual` finish available every product day without subscription (featured rotation and/or always-free modules), including guests.  
- **Current rotation (implementation):** `word-guess`, `word-groups`, `queens`, `sudoku`, `crossword` — day-of-year in product `day_key`, not UTC. Rotation membership may change; the *floor* (a free finish exists) may not.  
- **Premium:** archive dates, extra today’s modules, practice packs, advanced stats — as declared per module.  
- Enforcement: **server fail-closed** (ADR-170). Billing uncertainty degrades *premium only*.

---

## 8. Catalog floor (shipped puzzle modules)

Delivery authority pins the protected catalog. At this revision the **required** `puzzle_ritual` slugs (directories under `apps/puzzled/src/games/`, excluding `shared/`) are:

| Slug | Notes |
|------|--------|
| word-guess | Free-rotation member |
| word-groups | Free-rotation member |
| word-hive | |
| crossword | Free-rotation member |
| sudoku | Free-rotation member; deterministic generator fallback allowed |
| nonogram | |
| word-ladder | |
| arithmo | |
| pattern-match | |
| block-slide | |
| queens | Free-rotation member |
| tango | |
| word-box | |
| quad-words | |
| killer-sudoku | |
| cryptogram | |
| word-search | |

**Adding a module:** implement protocol + registry + tests; no change to HRC or DRC definitions. Update this table and [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md) in the same PR if the module is to be protected.

**Removing a module:** forbidden without DELIVERY-AUTHORITY exception and migration of users.

**Hollowing a module** (route exists, submit 404s, validator missing) is treated as a deletion.

No `entertainment_oracle` is in the protected catalog at this revision. Shipping the first one requires DFC instrumentation and honesty copy, not an HRC amendment.

---

## 9. Content pipeline

- Preferred: pre-generated content via content tool into `daily_puzzles` (ADR-170).  
- Allowed: documented server-side deterministic generators for specific modules.  
- Forbidden: client-invented daily solutions as authority.  
- Ops: content for day \(D+n\) should exist before day \(D+n\) traffic (Reliability).  
- Economy: generating 90 days of junk to “fill the store” is not a pipeline. Fairness and uniqueness matter.

---

## 10. Evolution

New cross-cutting needs (multiplayer, clubs, leagues, multi-TZ, family profiles) must answer:

1. Which of the five concepts extends?  
2. Do DRC and HRC still recompute cleanly from finish rows?  
3. Is there still one finish authority?  
4. Does the free floor still produce a DRC day for a guest?  
5. Did we add a concept we will now have to carry forever?

If the answer requires a second parallel product, stop and redesign.

**Family / multiple profiles** (NYT-class analog exists) is an entitlement + identity extension, not a new Polar. Each profile has its own DRC series. Do not merge a household into one HRC person.
