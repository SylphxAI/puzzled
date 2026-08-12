# Ritual and game module protocol

**Status:** Normative product contract for all shipped and future games  
**Revision:** 2026-08-12  
**Implements ambition:** unbounded catalog under minimal concepts

---

## 1. Purpose

This protocol is the **deep basis** that lets Puzzled host “every light daily brain game of this type” without inventing a new product per title.

Engineering implements the protocol (content store, Connect PuzzleService, pure validators in `puzzled-core`).  
**This document owns the product rules** modules must obey to ship.

---

## 2. The five concepts (full capability)

| Concept | Meaning |
|---------|---------|
| **Day key** | The product’s notion of “today” for shared content |
| **Game module** | A plug-in: rules, UI, validation, result-card mapping |
| **Ritual run** | One official attempt context for `(user, module, day_key)` |
| **Result card** | Shareable, non-spoiler summary of the run |
| **Entitlement** | Free vs premium access to content and modes |

Everything else (themes, cosmetics, optional multiplayer, oracles) composes on these five.

---

## 3. Day key

### 3.1 SSOT

- Timezone: **`Asia/Hong_Kong`** (see [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md)).  
- Format: `YYYY-MM-DD`.  
- Computed **on the server** for all ritual content selection and finish recording.  
- Clients may display local clocks; they must not choose `day_key` for ritual authority.

### 3.2 Why a single TZ (for now)

Shared conversation (“today’s puzzle”) collapses if every user has a private day boundary without product design. Multi-TZ is allowed only as a **versioned protocol upgrade** with migration of DRC definitions—not as ad hoc client behavior.

### 3.3 Content binding

For each `(game_module_id, day_key)` there is at most one **primary ritual content** row in the content store (or a documented deterministic server generator fallback, e.g. sudoku).  
Practice content is either undated or tagged `mode=practice` and excluded from DRC.

---

## 4. Game module

### 4.1 Identity

- **Slug:** stable string (e.g. `word-guess`, `sudoku`) — URL and registry key.  
- **module_class:**  
  - `puzzle_ritual` — contributes to **DRC**  
  - `entertainment_oracle` — contributes to **DFC** only  
  - (future classes require a North Star package amendment)

### 4.2 Required capabilities (puzzle_ritual)

A module **must**:

1. **Serve** today’s content without leaking the solution to the client (ADR-170).  
2. **Validate** submissions server-side via pure rules (core).  
3. **Define finish** — when a run is terminal (success / exhausted fail / other).  
4. **Emit** `ritual.completed` only through api success paths.  
5. **Map** terminal state → **result card** fields (no solution text by default).  
6. **Declare** free vs premium access (see [MONETIZATION.md](MONETIZATION.md)).  
7. **Complete in spirit under ~5–15 minutes** for the daily ritual mode (soft product bar; hardcore marathon modes must be non-default).

A module **must not**:

1. Trust client scores, solutions, or `has_completed`.  
2. Require payment to finish the designated free daily slot.  
3. Ship without a result-card mapping.  
4. Use real-money gambling mechanics.

### 4.3 Entertainment oracle modules

Allowed: random or lightweight deterministic “fun” outcomes (future baby, past life, playful match, etc.).

Required:

- UI copy: **entertainment only**, not advice or science.  
- Finish still server-recorded if counted in DFC.  
- Result card may be flashy; still avoid harmful claims.  
- **Never** pollute DRC.

### 4.4 Registration

Modules are listed in the product registry (code: `apps/puzzled/src/games/` and server dispatch).  
Shipping a module without registry + server validator is a **delivery reject**.

---

## 5. Ritual run

### 5.1 Key

```text
(user_or_guest_day_id, game_module_id, day_key)
```

### 5.2 Lifecycle (product)

1. **Open** — user lands on today’s puzzle.  
2. **Play** — guesses/moves validated as needed.  
3. **Terminal** — success or honest failure per rules.  
4. **Persist** — server stores outcome; emits ritual event if qualifying.  
5. **Card** — user may share.

**Already played:** re-entry shows results / review; does not double-count DRC.

### 5.3 Guests

Guest play is encouraged for viral landing.  
Identity: stable enough for one day of anti-cheat and DRC; upgrade to account preserves day history where implemented.

---

## 6. Result card (viral unit)

### 6.1 Requirements

| Requirement | Detail |
|-------------|--------|
| Non-spoiler default | No solution string; no paste of full answer grid that trivializes the puzzle |
| Glanceable | Pattern / score / streak / time band readable in a feed |
| Day + module labeled | So friends know *which* ritual |
| One-tap share | Web Share API and/or clipboard text |
| Deep link | Opens **today’s** same module when possible |

### 6.2 Anti-patterns

- Share that includes the answer “as a flex.”  
- Share that requires an app install before any play.  
- Different card systems per module with no common chrome (harms brand and Economy of attention).

---

## 7. Entitlement (summary)

Full rules: [MONETIZATION.md](MONETIZATION.md).

Protocol-level rules:

- **Free ritual floor:** at least one `puzzle_ritual` finish available every day without subscription (featured rotation and/or always-free modules).  
- **Premium:** archive dates, extra modules, practice packs, advanced stats—as declared per module.  
- Enforcement: **server fail-closed** (ADR-170).

---

## 8. Catalog floor (shipped puzzle modules)

Delivery authority pins the protected catalog. At North Star revision 2026-08-12 the **required** `puzzle_ritual` slugs (directories under `apps/puzzled/src/games/`, excluding `shared/`) are:

| Slug |
|------|
| word-guess |
| word-groups |
| word-hive |
| crossword |
| sudoku |
| nonogram |
| word-ladder |
| arithmo |
| pattern-match |
| block-slide |
| queens |
| tango |
| word-box |
| quad-words |
| killer-sudoku |
| cryptogram |
| word-search |

**Adding a module:** implement protocol + registry + tests; no change to DRC definition.  
**Removing a module:** forbidden without DELIVERY-AUTHORITY exception and migration of users.

---

## 9. Content pipeline

- Preferred: pre-generated content via content tool into `daily_puzzles` (ADR-170).  
- Allowed: documented server-side deterministic generators for specific modules.  
- Forbidden: client-invented daily solutions as authority.  
- Ops: content for day \(D+n\) should exist before day \(D+n\) traffic (Reliability).

---

## 10. Evolution

New cross-cutting needs (multiplayer, clubs, leagues) must answer:

1. Which of the five concepts extends?  
2. Does DRC still recompute cleanly?  
3. Is there still one finish authority?

If the answer requires a second parallel product, stop and redesign.
