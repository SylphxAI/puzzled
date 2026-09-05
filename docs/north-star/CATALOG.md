# Destination catalog — every daily ritual we will offer

**Status:** Normative destination catalog (2026-09-05)  
**Does not change:** [daily puzzle completers](NORTH-STAR-METRIC.md), daily entertainment completers, five protocol concepts  
**Does not ship games:** this file is doctrine. A slug here is not live until protocol-complete.  
**Shipped floor (may not delete):** [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md) §8 and [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md) §4.

Purpose: humans and agents decide **what exists in the class**.  
Audience: both. Language: English. One meaning per slug.

---

## 1. Decision

Puzzled’s catalog destination is **the whole daily light-brain-ritual class**, plus a bounded set of honest entertainment oracles.

Not a five-game forever MVP.  
Not a museum of half-wired titles.  
Not a trademark-clone of any one publisher.

A module is in this catalog when it can be **one shared day, minutes to finish, honest terminal, non-spoiler card**, under the five concepts. If it cannot, it is another product.

**Greedy on capability. Strict on protocol.** Agent-native typing is not a reason to skip validators, content SLA, or cards ([VISION.md](VISION.md) §7).

Home must not dump the full list on a cold user ([GROWTH-AND-VIRALITY.md](GROWTH-AND-VIRALITY.md)). Large catalog is capability; exposure stays small.

---

## 2. Admission gate (every slug)

A destination slug **may** enter the shipped floor only when all of the following hold:

1. Fits `puzzle_ritual` or `entertainment_oracle` ([protocol](RITUAL-AND-MODULE-PROTOCOL.md) §4).  
2. Daily ritual mode completes in spirit in **~5–15 minutes** (longer modes are non-default, non-ritual unless reclassified).  
3. Server-authoritative serve + validate + one finish per `(user, module, day_key)`.  
4. Result card: non-spoiler, common chrome, deep link.  
5. **Name hygiene** (§3): no third-party product mark as slug or player-facing title.  
6. Content is original or public-domain. Never another publisher’s daily.  
7. No real-money gambling, no scientific / medical / IQ / destiny claims.  
8. Disable switch without bricking home.  
9. Expected weekly-ritualist lift, daily-entertainment-to-daily-puzzle-completer crossover, or protocol proof clears content + verification + attention + runtime + reversal ([MONETIZATION.md](MONETIZATION.md) §8).

Fail any row → not a Puzzled module.

---

## 3. Intellectual-property hygiene

**Not legal advice.** Product floor until counsel searches marks in the ship markets.

### 3.1 What we copy vs what we refuse

| Allowed | Forbidden |
|---------|-----------|
| Generic *mechanics* (US commentary: rules of a word-guess loop are generally not copyright; trademarks and distinctive expression are — CNBC / Boyden, 2022-02-24) | Product **names**, logos, distinctive chrome, original daily grids, cloned share cards that read as that brand |
| Original dailies generated or edited by us | NYT / LinkedIn / Athletic / other publishers’ *today* |
| Descriptive English titles | Marks in §3.2 as slug or title |

NYT (Axios, 2024-03-15): no issue with similar word games that do **not** take the Wordle mark or copyrighted gameplay elements; DMCA targeted clones that used both.

### 3.2 Marks we do not use (player title or slug)

Wordle · Connections · Strands · Spelling Bee · Letter Boxed · Pips · The Mini / Midi (as NYT product titles) · Crossplay · Queens · Tango · Zip · Pinpoint · Crossclimb · Wend · Patches · KenKen · KenDoku · Picross · Hidato · Numbrix · Scrabble · Words with Friends · Heardle · and obvious misspellings (Wordl, Connexions, Ken-Ken).

**Sudoku**, **Kakuro**, **crossword** (generic type), **cryptogram**, **nonogram**, **word search**, **word ladder** are treated as generic type names unless counsel says otherwise.

### 3.3 Shipped rename (cut)

Canonical slugs are `crowns` and `duo`. `queens` / `tango` are **inbound aliases only** (redirect + canonicalize). New writes use the canonical slug. Player titles are Crowns and Duo. See [CUTOVER.md](CUTOVER.md).

### 3.4 Content and media

- No music-ID, film-still, or licensed-character dailies (Heardle / Framed / franchise Wordle).  
- Entertainment oracles: play, not advice.  
- Nikoli-class: use descriptive English titles; do not sell “official Nikoli” without a license. Rules are public; their *puzzles* are theirs.

---

## 4. Industry basis (why these families)

Retrieved 2026-08-12. Category existence, not Puzzled targets.

| Source | What it shows |
|--------|----------------|
| [NYT Games](https://www.nytco.com/games/), [subscription list](https://www.nytimes.com/subscription/games), [Wikipedia](https://en.wikipedia.org/wiki/The_New_York_Times_Games) | Suite: Crossword / Midi / Mini, Wordle, Connections, Strands, Spelling Bee, Letter Boxed, Tiles, Sudoku, Pips, Crossplay, sports Connections. Vertex / Digits / Zorse retired. 2024 play counts in the billions for Wordle, Connections, Strands. |
| [LinkedIn Games](https://www.linkedin.com/games) | Wend, Patches, Mini Sudoku, Zip, Tango, Queens, Pinpoint, Crossclimb. |
| [Nikoli](https://www.nikoli.co.jp/en/puzzles/) | Language-free logic family beyond Sudoku. |
| [KenKen / Calcudoku](https://en.wikipedia.org/wiki/KenKen) | Arithmetic cages are a type; **KenKen** is a mark — we ship **Cages**. |

---

## 5. Destination slugs

**Status column**

| Status | Meaning |
|--------|---------|
| `shipped` | On the protected floor today |
| `rename` | Shipped; title/slug must change (§3.3) |
| `dest` | Destination; not shipped |

Industry analog is **research only**. Never a player-facing name.

### 5.1 Word and crossword

| Slug | Player title | Mechanic | Analog (do not use) | Class | Status |
|------|--------------|----------|---------------------|-------|--------|
| word-guess | Five | Five-letter guess, limited tries, color feedback | Wordle | ritual | shipped |
| word-guess-plus | Five Plus | Six- or seven-letter daily | longer Wordle-likes | ritual | dest |
| quad-words | Quad | One guess paints four hidden words | Quordle | ritual | shipped |
| octa-words | Octa | Eight boards, one guess stream | Octordle | ritual | dest |
| word-grid-swap | Lattice | Scrambled word grid, limited swaps | Waffle | ritual | dest |
| word-groups | Threads | Sixteen words, four hidden groups | Connections | ritual | shipped |
| word-groups-sport | Threads Sport | Same mechanic, original sports clues | Connections Sports | ritual | dest |
| theme-path | Theme Path | Trace letters; themed words | Strands | ritual | dest |
| word-hive | Hive | Seven letters, center required | Spelling Bee | ritual | shipped |
| word-box | Frame | Letters on a square’s edges | Letter Boxed | ritual | shipped |
| crossword | Mini Grid | 5×5 / 7×7 crossword | Mini Crossword | ritual | shipped |
| crossword-midi | Midi Grid | 9–11 square themed crossword | Midi | ritual | dest |
| crossword-daily | Daily Grid | 15×15 daily crossword | newspaper crossword | ritual | dest |
| cryptic-mini | Crypt Mini | Cryptic clues, mini grid | cryptic | ritual | dest |
| acrostic | Quote Grid | Clues restore a quotation | acrostic | ritual | dest |
| word-ladder | Rungs | Change one letter per step | word ladder | ritual | shipped |
| clue-ladder | Clue Climb | Clues plus ladder | Crossclimb | ritual | dest |
| category-five | Pin | Five clues, one category | Pinpoint | ritual | dest |
| letter-bank | Bank | Build words from a bank | letter bank | ritual | dest |
| anagram-chain | Chain | Daily seed, anagram chain | anagram chain | ritual | dest |
| phrase-blend | Blend | Two phrases mashed into one | Zorse-like | ritual | dest |
| semant-guess | Near | Semantic nearness, unlimited guesses | Semantle | ritual | dest |
| hang-lite | Gallows | Limited-miss word (no gore) | hangman | ritual | dest |
| cryptogram | Cipher | Substitution cipher | cryptogram | ritual | shipped |
| word-search | Hunt | Find a list in a grid | word search | ritual | shipped |
| fill-quote | Quote Fill | Cloze of a public-domain line | fill-in | ritual | dest |

### 5.2 Number and Latin squares

| Slug | Player title | Mechanic | Analog (do not use) | Class | Status |
|------|--------------|----------|---------------------|-------|--------|
| sudoku | Sudoku | Standard 9×9 | Sudoku | ritual | shipped |
| sudoku-mini | Mini Sudoku | 6×6 | LinkedIn Mini Sudoku | ritual | dest |
| killer-sudoku | Cage Sudoku | Cages by sum | killer sudoku | ritual | shipped |
| calc-cages | Cages | Arithmetic cages, Latin rows/cols | **KenKen → Cages** | ritual | dest |
| kakuro | Cross Sums | Run sums | Kakuro | ritual | dest |
| futoshiki | Unequal | Inequalities | Futoshiki | ritual | dest |
| skyscrapers | Towers | Visibility counts | skyscrapers | ritual | dest |
| kropki | Dots | Black/white adjacency dots | Kropki | ritual | dest |
| duo | Duo | Two symbols, no triple, balance | Tango / Binairo | ritual | shipped (alias `tango`) |
| equals | Equals | Guess a true equation | Nerdle | ritual | dest |
| target-six | Target | Six numbers, hit a target | Countdown / Digits | ritual | dest |
| twenty-four | Twenty-Four | Four numbers make 24 | 24-point | ritual | dest |
| thermo-sudoku | Thermo | Thermometer extras | thermo sudoku | ritual | dest |
| sandwich-sudoku | Sandwich | Sandwich sums | sandwich sudoku | ritual | dest |
| arithmo | Arithmo | Short number ritual (shipped rules) | — | ritual | shipped |

### 5.3 Japanese-style logic (Nikoli-class)

Descriptive English titles. Japanese genre names may appear in How-to as **type aliases**, not brands.

| Slug | Player title | Mechanic | Type alias | Class | Status |
|------|--------------|----------|------------|-------|--------|
| slitherlink | Fences | Loop on dots; clues = edges | Slitherlink | ritual | dest |
| hashi | Bridges | Connect islands | Hashiwokakero | ritual | dest |
| nurikabe | Islands | Shade walls; islands by size | Nurikabe | ritual | dest |
| akari | Lamps | Light every cell | Akari | ritual | dest |
| masyu | Pearls | Loop through pearls | Masyu | ritual | dest |
| heyawake | Rooms | Room-shade rules | Heyawake | ritual | dest |
| hitori | Singles | Shade duplicates | Hitori | ritual | dest |
| shikaku | Rects | Partition into rectangles | Shikaku | ritual | dest |
| fillomino | Areas | Polyomino by number | Fillomino | ritual | dest |
| numberlink | Pairs | Join equal numbers | Numberlink | ritual | dest |
| yajilin | Arrows | Loop + shaded cells | Yajilin | ritual | dest |
| shakashaka | Shades | Black triangles | Shakashaka | ritual | dest |
| ripple | Ripple | Room digits + distance | Ripple Effect | ritual | dest |
| lits | Tetro | One tetromino per region | LITS | ritual | dest |
| tapa | Clue Walls | Neighborhood shade clues | Tapa | ritual | dest |
| norinori | Domino Shade | Two shaded cells per region | Norinori | ritual | dest |
| galaxies | Galaxies | 180° regions | Tentai Show | ritual | dest |
| sto-stone | Stones | Gravity-shade | Sto-stone | ritual | dest |
| moon-sun | Moon Sun | Moon/sun room loop | Moon-or-Sun | ritual | dest |
| suraromu | Gates | Ordered gates on a loop | Suraromu | ritual | dest |

### 5.4 Space, path, placement

| Slug | Player title | Mechanic | Analog (do not use) | Class | Status |
|------|--------------|----------|---------------------|-------|--------|
| crowns | Crowns | One mark per row, column, color region | Queens | ritual | shipped (alias `queens`) |
| number-path | Path | Visit 1…n, no crossing | Zip | ritual | shipped |
| pip-place | Spots | Place dominoes to satisfy regions | Pips | ritual | shipped |
| nonogram | Paint | Row/column paint clues | nonogram (not Picross) | ritual | shipped |
| fill-a-pix | Neighbors | Clue = adjacent shaded | Fill-a-Pix | ritual | dest |
| tents | Tents | Tent beside each tree | Tents | ritual | dest |
| ships | Ships | Locate ships from row and column clues | Battleships | ritual | dest |
| magnets | Magnets | Place polar pairs | Magnets | ritual | dest |
| tracks | Tracks | Single track | train tracks | ritual | dest |
| net-rotate | Net | Rotate tiles to connect | Net | ritual | dest |
| untangle | Untangle | Drag vertices; no crossings | Untangle | ritual | dest |
| block-slide | Slides | Slide blocks to a goal | sliding block | ritual | shipped |
| klotski-daily | Klotski | Daily sliding layout | Huarong | ritual | dest |
| black-box | Beam | Deduce hidden atoms from beams | Black Box | ritual | dest |
| mines-safe | Mines | Daily mines grid | Minesweeper | ritual | dest |
| slant | Slant | One diagonal per cell | Slant | ritual | dest |
| loopy | Loopy | Generalized fence | Loopy | ritual | dest |
| dominosa | Dominosa | Pair a full domino set | Dominosa | ritual | dest |
| same-clear | Clear | Daily one-board color clear | SameGame | ritual | dest |
| pattern-match | Match | Pattern / sequence match | shipped | ritual | shipped |

### 5.5 Visual

| Slug | Player title | Mechanic | Analog (do not use) | Class | Status |
|------|--------------|----------|---------------------|-------|--------|
| tile-pair | Pairs | Match visual attributes | Tiles | ritual | dest |
| triple-set | Triple | Three cards: each attribute all-same or all-different | Set-like (confirm mark before title “Set”) | ritual | dest |
| trace-form | Trace | Connect dots to a figure (our art) | Vertex-like | ritual | dest |
| silhouette | Silhouette | Three views → shape | block views | ritual | dest |
| rotate-fit | Fit | Rotate pieces into a silhouette | packing | ritual | dest |
| tangram-daily | Tangram | Daily silhouette | tangram | ritual | dest |
| hash-diff | Diff | Find differences | spot-the-difference | ritual | dest |
| chroma | Chroma | Guess a color from channel hints | Spectra-like | ritual | dest |

### 5.6 Knowledge and maps (original clues only)

| Slug | Player title | Mechanic | Analog (do not use) | Class | Status |
|------|--------------|----------|---------------------|-------|--------|
| world-outline | Outline | Country outline + distance | Worldle-like | ritual | dest |
| globe-guess | Globe | Country hot/cold | Globle-like | ritual | dest |
| flag-guess | Flags | Flag → country | flags | ritual | dest |
| capital-path | Capitals | Capital chain | geography | ritual | dest |
| year-line | Timeline | Order events | timeline | ritual | dest |
| odd-fact | Odd One | Which fact does not belong | trivia | ritual | dest |
| clue-five | Rung Facts | Five clues, vague → obvious | riddle ladder | ritual | dest |

### 5.7 Chinese and Cantonese (first-class; product day is HKT)

| Slug | Player title | Mechanic | Class | Status |
|------|--------------|----------|-------|--------|
| idiom-chain | 成語接 | Tail-character chain from a daily seed | ritual | dest |
| idiom-blank | 成語缺 | Cloze four-character idiom | ritual | dest |
| feihua | 飛花 | Constrained idiom/verse from a required character | ritual | dest |
| couplet | 對仗 | Pair a couplet (choice or closed lexicon first) | ritual | dest |
| canto-guess | 潮語 | Cantonese daily word, limited tries | ritual | dest |
| jyutping-fill | 粵拼 | Build a word from jyutping parts | ritual | dest |
| poem-blank | 詩缺 | Public-domain poem cloze | ritual | dest |
| xiehou | 歇後 | Xiehouyu completion | ritual | dest |
| chengyu-groups | 成語線 | Idiom Threads | ritual | dest |
| hanzi-search | 尋字 | Character search | ritual | dest |
| riddle-lantern | 燈謎 | Daily riddle, closed answers | ritual | dest |

### 5.8 Entertainment oracles (daily entertainment completers only)

Copy: **entertainment only**. Never science, destiny, diagnosis, or finance advice. Never daily puzzle completers.

| Slug | Player title | Mechanic | Status |
|------|--------------|----------|--------|
| daily-stars | Stars | Play horoscope card | dest |
| past-life | Past Life | Play past-life card | dest |
| tarot-three | Three Cards | Three-card play | dest |
| which-grid | Which Grid | “Which ritual are you today” | dest |
| luck-hue | Hue | Daily color play | dest |
| baby-fun | Baby | Playful predictor; adult; disclaimer | dest |
| ship-fun | Ship | Two-name play match; not counsel | dest |
| oracle-yes | Eight Ball | Yes/no toy | dest |

---

## 6. Explicit non-entries

| Idea | Why out |
|------|---------|
| Heardle / Framed / clip-ID | Third-party audio/video rights |
| Franchise skins (Pokémon, MCU, …) | License |
| Full chess platform / ranked ladder | Wrong North Star and tone ([VISION.md](VISION.md) §6) |
| Scrabble-named or WWF-named tile scoring as a title | Marks; optional later mode under a new name, S5 |
| Gacha, loot, real-money wager | Security / brand / law |
| “Scientifically validated IQ / brain age” | Ethics + Correctness |
| Infinite SEO quiz farm | Economy of attention |
| Open-ended LLM couplet/poem as *authority* without a closed grader | Cannot oracle a finish honestly |

S5 social (compare, light co-op, family profiles) is a **mode on existing slugs**, not a second catalog and not a second North Star.

---

## 7. Counts (destination, not a ship-tonight promise)

| Family | Destination slugs |
|--------|-------------------|
| Word / crossword | 26 |
| Number / Latin | 15 |
| Nikoli-class | 20 |
| Space / path | 20 |
| Visual | 8 |
| Knowledge / maps | 7 |
| Chinese / Cantonese | 11 |
| Entertainment oracles | 8 |
| **Total** | **115** |

Of those, **19 are shipped** (two pending rename). Adding a `dest` slug does not change daily puzzle completers.

---

## 8. Sequencing (does not shrink §5)

Order protects the basis ([STRATEGY-ROADMAP.md](STRATEGY-ROADMAP.md)). Destination stays §5.

| Wave | What | Why |
|------|------|-----|
| **W0** | Rename Crowns / Duo; keep play | Close shipped mark risk |
| **W1** | Theme Path, Frame depth, Clue Climb, Pin, Cages, Path, Spots | Table-stakes gaps vs NYT + LinkedIn *mechanics* |
| **W2** | Fences, Bridges, Islands, Lamps, Mini Sudoku | Generator-friendly logic breadth |
| **W3** | Cantonese / idiom family | Product day is HKT; locales already exist |
| **W4** | First 2–3 oracles (daily entertainment completers instrumented) | Fun without North Star pollution |
| **W5** | Midi/Daily Grid, knowledge maps, remaining Nikoli-class | Depth after protocol is boring |

Kill signal (unchanged): daily puzzle completers flat while slugs grow, or weekly ritualists flat while daily puzzle completers grow → stop adding modules.

---

## 9. How this file changes

| Change | Same PR must also |
|--------|-------------------|
| Add/remove a **destination** slug | Edit this file; no North Star change |
| Promote `dest` → shipped protected | Protocol §8 + DELIVERY §4 + registry + validators + card |
| Rename `queens` / `tango` | This file + redirects + registry + core slug list |
| New `module_class` | North Star package amendment first |

Revision history is git. Bump the Status date when this file ships.

---

## 10. Sources (2026-08-12)

- https://www.nytco.com/games/  
- https://www.nytimes.com/subscription/games  
- https://en.wikipedia.org/wiki/The_New_York_Times_Games  
- https://www.linkedin.com/games  
- https://www.nikoli.co.jp/en/puzzles/  
- https://en.wikipedia.org/wiki/KenKen  
- https://www.cnbc.com/2022/02/24/wordle-kind-of-rips-off-lingo-a-copyright-lawyer-says-thats-ok.html  
- https://www.axios.com/2024/03/15/nyt-wordle-clones-takedown-dmca-copyright  

Gaps: jurisdiction-specific trademark clearance; whether “Set” / “Waffle” / similar indie titles collide in our markets — counsel before those player titles ship.
