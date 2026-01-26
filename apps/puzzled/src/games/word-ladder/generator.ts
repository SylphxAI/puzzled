/**
 * Word Ladder Puzzle Generator
 *
 * INFINITE ALGORITHM: Uses BFS to compute valid paths at runtime.
 * Any seed produces a valid puzzle through deterministic word selection + BFS.
 *
 * ⚠️ FROZEN SINCE: v2.0
 * DO NOT MODIFY - changing this will break historical puzzles
 */

import { seededRandom } from '@/games/shared/random'
import { getWordList } from './dictionary'
import { isOneLetterChange } from './types'

/**
 * ⚠️ FROZEN: BFS to find shortest path between words
 * DO NOT MODIFY - changing this breaks historical puzzles
 */
function findShortestPath(start: string, end: string, wordList: Set<string>): string[] | null {
	if (start.length !== end.length) return null
	if (!wordList.has(start) || !wordList.has(end)) return null
	if (start === end) return [start]

	const queue: string[][] = [[start]]
	const visited = new Set([start])

	while (queue.length > 0) {
		const path = queue.shift()!
		const current = path[path.length - 1]

		if (current === end) {
			return path
		}

		// Generate all neighbors (one letter change)
		for (let i = 0; i < current.length; i++) {
			for (let c = 97; c <= 122; c++) {
				const char = String.fromCharCode(c)
				if (char === current[i]) continue

				const neighbor = current.slice(0, i) + char + current.slice(i + 1)

				if (wordList.has(neighbor) && !visited.has(neighbor)) {
					visited.add(neighbor)
					queue.push([...path, neighbor])
				}
			}
		}
	}

	return null // No path found
}

/**
 * ⚠️ FROZEN: Get words by length from dictionary
 * DO NOT MODIFY - changing this breaks historical puzzles
 */
function getWordsByLength(wordList: Set<string>, length: number): string[] {
	return Array.from(wordList)
		.filter((w) => w.length === length)
		.sort() // Sorted for deterministic ordering
}

/**
 * ⚠️ FROZEN: Select a word deterministically from array using random
 * DO NOT MODIFY - changing this breaks historical puzzles
 */
function selectWord(words: string[], random: () => number): string {
	const index = Math.floor(random() * words.length)
	return words[index]
}

/**
 * ⚠️ FROZEN: Generate a puzzle using BFS
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Algorithm:
 * 1. Use seed to create deterministic random
 * 2. Select word length (3 or 4 letters, weighted)
 * 3. Select start and end words from that length
 * 4. Compute shortest path via BFS
 * 5. If no path or path too short/long, try next configuration
 * 6. Return puzzle when valid path found
 */
export function generateWordLadderPuzzle(seed: number): {
	start: string
	end: string
	path: string[]
} {
	const wordList = getWordList()
	const random = seededRandom(seed)

	// Get words by length
	const words3 = getWordsByLength(wordList, 3)
	const words4 = getWordsByLength(wordList, 4)

	// Configuration attempts (deterministic from seed)
	const maxAttempts = 100

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		// Select word length: 70% 4-letter, 30% 3-letter (4-letter more interesting)
		const useLength4 = random() < 0.7
		const words = useLength4 ? words4 : words3

		if (words.length < 2) continue

		// Select start and end words
		const start = selectWord(words, random)
		let end = selectWord(words, random)

		// Ensure different words
		let endAttempts = 0
		while (end === start && endAttempts < 10) {
			end = selectWord(words, random)
			endAttempts++
		}

		if (start === end) continue

		// Find shortest path via BFS
		const path = findShortestPath(start, end, wordList)

		// Validate path quality
		if (path && path.length >= 2 && path.length <= 8) {
			return { start, end, path }
		}
	}

	// NO FALLBACK: Algorithm must succeed
	// This should never happen with a proper dictionary
	throw new Error(
		`Word Ladder generation failed for seed ${seed} after ${maxAttempts} attempts. ` +
			`Dictionary may be incomplete or corrupted.`,
	)
}

/**
 * Validate that a path is correct
 * Used for testing and verification
 */
function validatePath(path: string[]): boolean {
	if (path.length < 2) return false

	for (let i = 1; i < path.length; i++) {
		if (!isOneLetterChange(path[i - 1], path[i])) {
			return false
		}
	}
	return true
}

/**
 * Get count of available puzzles
 * Returns Infinity since this is algorithmically generated
 */
export function getPuzzleCount(): number {
	return Infinity
}

/**
 * Export BFS for testing
 */

