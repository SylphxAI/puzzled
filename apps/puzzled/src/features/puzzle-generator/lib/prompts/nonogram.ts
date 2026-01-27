/**
 * Prompt templates for Nonogram puzzle generation
 */

export const NONOGRAM_SYSTEM_PROMPT = `You are an expert pixel art designer for a Nonogram (Picross) puzzle game.

Your task is to create 10x10 pixel art patterns that players will enjoy revealing by solving number clues.

RULES:
1. Grid is exactly 10 rows × 10 columns
2. Each cell is either 0 (empty) or 1 (filled)
3. The pattern must form a RECOGNIZABLE shape or object when filled in
4. Provide a theme/name for what the picture represents

DESIGN GUIDELINES:
- Create clear, recognizable silhouettes (not abstract patterns)
- Good subjects: animals, objects, symbols, food, vehicles, faces, buildings
- Use ~30-70% filled cells (not too sparse, not too dense)
- Ensure the shape is identifiable when complete
- Avoid overly complex patterns that are hard to recognize
- The pattern should be interesting but not ambiguous

EXAMPLE SUBJECTS:
- Simple: Heart, Star, Moon, Apple, House, Tree, Fish, Cat face
- Medium: Umbrella, Rocket, Crown, Mushroom, Anchor, Ghost
- Creative: Coffee cup, Robot, Sailboat, Cactus, Penguin

The puzzle should be satisfying to solve and reveal a clear picture at the end.`

export const NONOGRAM_USER_PROMPT = `Generate a Nonogram pixel art puzzle.

Return ONLY valid JSON in this exact format:
{
  "theme": "OBJECT NAME",
  "grid": [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0]
  ]
}

Requirements:
- Grid must be exactly 10 rows × 10 columns
- Each cell must be 0 or 1
- The pattern must form a clear, recognizable shape
- Theme should be 1-2 words describing the picture
- Fill ratio should be between 30-70% (not too sparse or dense)
- Create something DIFFERENT from common patterns (heart, star, moon, cat)

Be creative! Think of unique objects: telescope, cupcake, headphones, lighthouse, hot air balloon, etc.

Return ONLY the JSON, no explanation.`

/**
 * Themed prompt for specific categories
 */
const _NONOGRAM_THEMED_PROMPT = (
	theme: string,
) => `Generate a Nonogram pixel art puzzle with the theme: "${theme}"

The picture should clearly represent something related to this theme.

Return ONLY valid JSON in the same format as before:
{
  "theme": "SPECIFIC OBJECT NAME",
  "grid": [[...], [...], ...]  // 10×10 grid of 0s and 1s
}

Make sure the silhouette is recognizable as something related to "${theme}".`

/**
 * Exclusion prompt to avoid duplicate themes
 */
const _NONOGRAM_AVOID_THEMES_PROMPT = (
	usedThemes: string[],
) => `Generate a Nonogram pixel art puzzle.

IMPORTANT: Do NOT create any of these themes (already used):
${usedThemes.map((t) => `- ${t}`).join('\n')}

Create something completely different and unique!

Return ONLY valid JSON in the standard format:
{
  "theme": "UNIQUE OBJECT NAME",
  "grid": [[...], [...], ...]  // 10×10 grid of 0s and 1s
}`
