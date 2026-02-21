import "server-only";

/**
 * Parse JSON from LLM response
 *
 * Handles common LLM output formats:
 * - Markdown code blocks (```json ... ```)
 * - Raw JSON
 * - JSON embedded in other text
 *
 * @param response - Raw LLM response string
 * @returns Parsed JSON object or null if parsing fails
 */
export function parseLlmJsonResponse<T = Record<string, unknown>>(
	response: string,
): T | null {
	try {
		let cleaned = response.trim();

		// Try 1: Handle markdown code blocks
		if (cleaned.startsWith("```json")) {
			cleaned = cleaned.slice(7);
		} else if (cleaned.startsWith("```")) {
			cleaned = cleaned.slice(3);
		}
		if (cleaned.endsWith("```")) {
			cleaned = cleaned.slice(0, -3);
		}
		cleaned = cleaned.trim();

		// If it starts with { or [, try direct parse
		if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
			return JSON.parse(cleaned) as T;
		}

		// Try 2: Extract JSON object from anywhere in the response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]) as T;
		}

		return null;
	} catch {
		return null;
	}
}
