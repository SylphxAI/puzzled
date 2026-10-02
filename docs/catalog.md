# Catalog

Which games Puzzled offers, what a new game needs, and the names we do not
use. The protocol every game follows is [game-protocol.md](game-protocol.md).

## Direction

The catalog grows to the whole class of light daily brain games (word,
crossword, number and logic grids, path and placement, visual, knowledge with
original clues, Chinese and Cantonese word games) plus a few clearly labelled
entertainment games. Home shows a small lineup: a large catalog is capability,
exposure stays small. Add games where a gap matters to players or a generator
is cheap; order matters less than keeping each game on the protocol. If
completers stay flat while the catalog grows, stop adding games and fix the
protocol or the experience first.

## Admission

A game joins the shipped list when it usually meets all of these:

1. It is a puzzle game or a labelled entertainment game ([game-protocol.md](game-protocol.md)).
2. The daily mode takes about 5 to 15 minutes.
3. Serving, validation and the one-finish rule are server-side.
4. It has a result card with common chrome and a deep link.
5. Its name and slug use no third-party mark (below).
6. Its content is original or public domain, never another publisher's daily puzzle.
7. It has no real-money gambling and no scientific, medical, IQ or destiny claims.
8. It can be disabled without breaking home.
9. The expected lift (weekly regulars, completers, conversion) justifies the content, verification, attention and runtime cost of one more game.

## Names

We copy mechanics, not names or expression: the rules of a word-guess loop are
generally free to use, while product names, logos, distinctive chrome and
publishers' daily grids are not. Descriptive English titles are the default.
Do not use these as a slug or player-facing title: Wordle, Connections, Strands,
Spelling Bee, Letter Boxed, Pips, The Mini and Midi, Crossplay, Queens, Tango,
Zip, Pinpoint, Crossclimb, Wend, Patches, KenKen, KenDoku, Picross, Hidato,
Numbrix, Scrabble, Words with Friends, Heardle, or near misspellings. Sudoku,
Kakuro, crossword, cryptogram, nonogram, word search and word ladder are
generic type names.

History behind the rename: LinkedIn's Queens and Tango were shipped as titles,
so the canonical slugs are now `crowns` and `duo`. `queens` and `tango` remain
inbound aliases only (they redirect and canonicalise; new writes use the
canonical slug); their code directories under `apps/puzzled/src/games/` keep the
old names. No music, film-still or licensed-character dailies; do not sell
"official" versions of another publisher's puzzles.

Out of scope: a full chess or ranked-ladder platform, gacha or wagers,
"scientifically validated IQ or brain age" claims, infinite SEO quiz farms, and
open-ended LLM output as the authority for a finish without a closed grader.

## Shipped games (19)

The registry in `apps/puzzled/src/games/registry.ts` is the source; this table
is the player-facing names.

| Slug | Title | Mechanic |
| --- | --- | --- |
| word-guess | Five | Five-letter guess, limited tries, colour feedback |
| quad-words | Quad | One guess paints four hidden words |
| word-groups | Threads | Sixteen words, four hidden groups |
| word-hive | Hive | Seven letters, centre letter required |
| word-box | Frame | Letters on a square's edges |
| crossword | Mini Grid | 5x5 word-square crossword; across and down clues from `rust-crossword-v2` (older boards play across-only) |
| word-ladder | Rungs | Change one letter per step |
| cryptogram | Cipher | Substitution cipher |
| word-search | Hunt | Find a list of words in a grid |
| sudoku | Sudoku | Standard 9x9 |
| killer-sudoku | Cage Sudoku | Cages by sum |
| arithmo | Arithmo | Short number puzzle |
| number-path | Path | Visit 1 to n without crossing |
| pip-place | Spots | Place dominoes to satisfy regions |
| nonogram | Paint | Row and column paint clues |
| block-slide | Slides | Slide blocks to a goal |
| pattern-match | Match | Pattern or sequence match |
| crowns | Crowns | One mark per row, column and region |
| duo | Duo | Two-symbol balance |

Adding a game changes no metric definition. Promote a game only with its
protocol pieces (validator, registry, card) and this table in the same pull
request.
