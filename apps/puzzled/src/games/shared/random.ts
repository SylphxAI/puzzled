/**
 * Shared Random Utilities for Game Generators
 *
 * ⚠️ FROZEN ALGORITHMS - DO NOT MODIFY
 * These algorithms are used across all games for deterministic puzzle generation.
 * Changing them will break ALL historical puzzles across ALL games.
 *
 * Used by: word-ladder, block-slide, quordle, spelling-bee, worldle,
 *          sudoku, killer-sudoku, queens, letter-boxed, connections
 */

/**
 * Seeded random number generator
 * Linear Congruential Generator (LCG) with glibc parameters
 *
 * ⚠️ FROZEN: DO NOT MODIFY - breaks historical puzzles
 *
 * @param seed - Initial seed value
 * @returns Function that returns next random number in [0, 1)
 */
export function seededRandom(seed: number): () => number {
	let state = seed
	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff
		return state / 0x7fffffff
	}
}

/**
 * Shuffle array using Fisher-Yates algorithm with provided random function
 *
 * ⚠️ FROZEN: DO NOT MODIFY - breaks historical puzzles
 *
 * @param array - Array to shuffle (not mutated)
 * @param random - Random function returning [0, 1)
 * @returns New shuffled array
 */
export function shuffleArray<T>(array: T[], random: () => number): T[] {
	const result = [...array]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[result[i], result[j]] = [result[j], result[i]]
	}
	return result
}

/**
 * Convenience function: shuffle with seed directly
 *
 * @param array - Array to shuffle
 * @param seed - Seed for random generator
 * @returns New shuffled array
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
	return shuffleArray(array, seededRandom(seed))
}

/**
 * Pick random element from array
 *
 * @param array - Array to pick from
 * @param random - Random function returning [0, 1). Defaults to Math.random for non-deterministic use.
 * @returns Random element from array
 */
export function pickRandom<T>(array: T[], random: () => number = Math.random): T {
	return array[Math.floor(random() * array.length)]
}

/**
 * Pick n random elements from array (without replacement)
 *
 * @param array - Array to pick from
 * @param n - Number of elements to pick
 * @param random - Random function returning [0, 1)
 * @returns Array of n random elements
 */
function pickRandomN<T>(array: T[], n: number, random: () => number): T[] {
	return shuffleArray(array, random).slice(0, n)
}
