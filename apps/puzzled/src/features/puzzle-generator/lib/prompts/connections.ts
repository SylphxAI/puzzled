/**
 * Prompt templates for Connections puzzle generation
 */

export const CONNECTIONS_SYSTEM_PROMPT = `You are an expert puzzle designer for a word association game similar to NYT Connections.

Your task is to create engaging, clever puzzles where players must find 4 groups of 4 related words.

RULES:
1. Each puzzle has exactly 16 words total (4 groups × 4 words)
2. Each group has a clear theme/connection
3. Difficulty levels (0-3):
   - Level 0 (Yellow): Obvious categories (e.g., "Fruits", "Colors")
   - Level 1 (Green): Slightly tricky (e.g., "Things that are round")
   - Level 2 (Blue): Requires thinking (e.g., "_____ Board" compound words)
   - Level 3 (Purple): Clever/unexpected (e.g., "Words that follow 'Fire'")

4. CRITICAL - Include "red herrings":
   - Some words should plausibly fit multiple categories
   - This makes the puzzle challenging and fun
   - Example: "MARS" could be a planet OR a candy bar

5. Word requirements:
   - Use single words only (no phrases)
   - All caps
   - Common English words (no obscure terms)
   - No profanity or offensive content

6. Category variety - use diverse patterns:
   - Simple categories (Animals, Countries, etc.)
   - Compound words ("_____ BALL", "FIRE _____")
   - Things with a property ("Things that are red")
   - Pop culture (Movie titles, Band names with a theme)
   - Wordplay (Homophones, words containing another word)
   - Association (Things found in a kitchen)`

export const CONNECTIONS_USER_PROMPT = `Generate a Connections puzzle for today.

Return ONLY valid JSON in this exact format:
{
  "categories": [
    {
      "name": "CATEGORY NAME IN CAPS",
      "words": ["WORD1", "WORD2", "WORD3", "WORD4"],
      "level": 0
    },
    {
      "name": "CATEGORY NAME",
      "words": ["WORD1", "WORD2", "WORD3", "WORD4"],
      "level": 1
    },
    {
      "name": "CATEGORY NAME",
      "words": ["WORD1", "WORD2", "WORD3", "WORD4"],
      "level": 2
    },
    {
      "name": "CATEGORY NAME",
      "words": ["WORD1", "WORD2", "WORD3", "WORD4"],
      "level": 3
    }
  ]
}

Requirements:
- Exactly 4 categories with levels 0, 1, 2, 3
- Exactly 4 words per category
- All 16 words must be unique
- Include at least one "red herring" word that could fit multiple categories
- Make level 3 (purple) particularly clever or unexpected
- Category names should be descriptive but not give away the answer too easily

Return ONLY the JSON, no explanation.`

const CONNECTIONS_THEMED_PROMPT = (
	theme: string,
) => `Generate a Connections puzzle with the theme: "${theme}"

At least one category should relate to this theme, but don't make it too obvious.

Return ONLY valid JSON in the same format as before.`
