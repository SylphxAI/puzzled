/**
 * Pattern Match Types
 *
 * ⚠️ FROZEN SINCE: v1.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Find sets of 3 cards where each property is either
 * all the same OR all different across the 3 cards.
 */

export type Shape = 'diamond' | 'oval' | 'squiggle'
export type Color = 'red' | 'green' | 'purple'
export type Fill = 'solid' | 'striped' | 'empty'
export type Count = 1 | 2 | 3

export type Card = {
	id: number
	shape: Shape
	color: Color
	fill: Fill
	count: Count
}

export type PatternMatchPuzzle = {
	cards: Card[] // 12 cards on board
	validSets: [number, number, number][] // All valid sets (by card id)
}

export type PatternMatchSolution = {
	validSets: [number, number, number][]
	totalSets: number
}

/**
 * Check if 3 values are all same or all different
 */
function isValidProperty<T>(a: T, b: T, c: T): boolean {
	const allSame = a === b && b === c
	const allDifferent = a !== b && b !== c && a !== c
	return allSame || allDifferent
}

/**
 * Check if 3 cards form a valid set
 */
export function isValidSet(card1: Card, card2: Card, card3: Card): boolean {
	return (
		isValidProperty(card1.shape, card2.shape, card3.shape) &&
		isValidProperty(card1.color, card2.color, card3.color) &&
		isValidProperty(card1.fill, card2.fill, card3.fill) &&
		isValidProperty(card1.count, card2.count, card3.count)
	)
}

/**
 * Find all valid sets in a list of cards
 */
export function findAllSets(cards: Card[]): [number, number, number][] {
	const sets: [number, number, number][] = []

	for (let i = 0; i < cards.length - 2; i++) {
		for (let j = i + 1; j < cards.length - 1; j++) {
			for (let k = j + 1; k < cards.length; k++) {
				if (isValidSet(cards[i], cards[j], cards[k])) {
					sets.push([cards[i].id, cards[j].id, cards[k].id])
				}
			}
		}
	}

	return sets
}

/**
 * Generate all 81 possible cards (3^4 combinations)
 */
export function generateAllCards(): Card[] {
	const shapes: Shape[] = ['diamond', 'oval', 'squiggle']
	const colors: Color[] = ['red', 'green', 'purple']
	const fills: Fill[] = ['solid', 'striped', 'empty']
	const counts: Count[] = [1, 2, 3]

	const cards: Card[] = []
	let id = 0

	for (const shape of shapes) {
		for (const color of colors) {
			for (const fill of fills) {
				for (const count of counts) {
					cards.push({ id: id++, shape, color, fill, count })
				}
			}
		}
	}

	return cards
}

/**
 * Select 12 cards that guarantee at least minSets valid sets
 */
export function selectCardsWithSets(seed: number, minSets: number = 6): Card[] {
	const allCards = generateAllCards()

	// Simple seeded shuffle using LCG (Mulberry32)
	const mulberry32 = (a: number) => {
		let state = a
		return () => {
			state += 0x6d2b79f5
			let t = state
			t = Math.imul(t ^ (t >>> 15), t | 1)
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296
		}
	}

	const random = mulberry32(seed)

	// Fisher-Yates shuffle
	const shuffled = [...allCards]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	// Try different approaches to find 12 cards with enough sets
	for (let attempt = 0; attempt < 200; attempt++) {
		let selected: Card[]

		if (attempt < 50) {
			// First 50 attempts: try contiguous slices with various offsets
			const startIndex = (attempt * 7) % (shuffled.length - 12)
			selected = shuffled.slice(startIndex, startIndex + 12)
		} else {
			// Next 150 attempts: try random selections from shuffled deck
			// Use the attempt number to vary the random selection
			const attemptRandom = mulberry32(seed + attempt * 1337)
			selected = []
			const indices = new Set<number>()
			while (indices.size < 12) {
				const idx = Math.floor(attemptRandom() * shuffled.length)
				if (!indices.has(idx)) {
					indices.add(idx)
					selected.push(shuffled[idx])
				}
			}
		}

		// Re-assign IDs for selected cards (0-11)
		const cards = selected.map((card, idx) => ({ ...card, id: idx }))
		const sets = findAllSets(cards)

		if (sets.length >= minSets) {
			return cards
		}
	}

	// ⚠️ ARCHITECTURE PRINCIPLE: No silent fallbacks
	// If we can't find cards with enough sets, this is a bug
	// Mathematical fact: any 12 cards from 81 should have sets
	throw new Error(
		`PatternMatch: Failed to find ${minSets}+ sets in 12 cards for seed ${seed}. ` +
			`This indicates a bug - the algorithm should always find valid sets.`,
	)
}
