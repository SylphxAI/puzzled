/**
 * Prompt templates for Crossword Mini puzzle generation
 */

export const CROSSWORD_SYSTEM_PROMPT = `You are an expert crossword puzzle designer.

Your task is to create 5x5 "word square" puzzles where EVERY row AND column forms a valid English word.

CRITICAL RULES:
1. Grid is exactly 5 rows × 5 columns
2. Every row must be a valid 5-letter English word
3. Every column must ALSO be a valid 5-letter English word
4. All 10 words must be common English words (no obscure terms)
5. Provide clever clues for each word

WORD SQUARE PROPERTY:
In a word square, reading across gives 5 words AND reading down gives 5 different words.
Example:
  H E A R T  (row 1: HEART)
  E M B E R  (row 2: EMBER)
  A B U S E  (row 3: ABUSE)
  R E S I N  (row 4: RESIN)
  T R E N D  (row 5: TREND)

Columns read: HEART (col 1), EMBER (col 2), ABUSE (col 3), RESIN (col 4), TREND (col 5)
Note: In this example, row[i] = col[i] (symmetric word square)

CLUE GUIDELINES:
- Clues should be clever but fair
- Mix of straightforward definitions and wordplay
- No overly obscure references
- Keep clues concise (under 15 words each)

VALID WORD REQUIREMENTS:
- Must be in standard English dictionaries
- No proper nouns (names, places, brands)
- No abbreviations or acronyms
- No slang or vulgar terms
- Prefer common words over rare ones`

export const CROSSWORD_USER_PROMPT = `Generate a 5×5 Crossword Mini word square puzzle.

Return ONLY valid JSON in this exact format:
{
  "grid": [
    ["H", "E", "A", "R", "T"],
    ["E", "M", "B", "E", "R"],
    ["A", "B", "U", "S", "E"],
    ["R", "E", "S", "I", "N"],
    ["T", "R", "E", "N", "D"]
  ],
  "clues": {
    "across": [
      {"number": 1, "clue": "Vital organ"},
      {"number": 2, "clue": "Glowing coal"},
      {"number": 3, "clue": "Mistreat"},
      {"number": 4, "clue": "Tree secretion"},
      {"number": 5, "clue": "Fashion direction"}
    ],
    "down": [
      {"number": 1, "clue": "Center of love"},
      {"number": 2, "clue": "Hot ash"},
      {"number": 3, "clue": "Misuse"},
      {"number": 4, "clue": "Pine product"},
      {"number": 5, "clue": "Popular style"}
    ]
  }
}

Requirements:
- Grid must be exactly 5×5 uppercase letters
- All 5 across words must be valid English words
- All 5 down words must be valid English words
- Provide exactly 5 across clues (numbered 1-5)
- Provide exactly 5 down clues (numbered 1-5)
- Create something DIFFERENT from the example

Return ONLY the JSON, no explanation.`

/**
 * Prompt to avoid duplicate puzzles
 */
const CROSSWORD_AVOID_WORDS_PROMPT = (
	usedWords: string[],
) => `Generate a 5×5 Crossword Mini word square puzzle.

IMPORTANT: Do NOT use any of these words (already used in recent puzzles):
${usedWords.map((w) => `- ${w}`).join('\n')}

Create a completely different word square with fresh words!

Return ONLY valid JSON in the standard format:
{
  "grid": [[...], [...], [...], [...], [...]],  // 5×5 uppercase letters
  "clues": {
    "across": [{"number": 1, "clue": "..."}, ...],
    "down": [{"number": 1, "clue": "..."}, ...]
  }
}`
