/**
 * Word Search Puzzle Generator
 *
 * Creates themed word search puzzles with deterministic generation.
 * Uses curated word lists organized by theme.
 */

import { ALPHABET } from '@/lib/constants/strings'
import type { Direction, PlacedWord, WordSearchPuzzleData, WordSearchSolution } from './types'
import {
	GRID_SIZE,
	getDirectionVector,
	MAX_WORDS,
	MIN_WORDS,
	seededRandom,
	seededShuffle,
} from './types'

// ==========================================
// Themed Word Lists
// ==========================================

type Theme = {
	name: string
	words: string[]
}

const THEMES: Theme[] = [
	{
		name: 'Animals',
		words: [
			'LION',
			'TIGER',
			'BEAR',
			'WOLF',
			'EAGLE',
			'SHARK',
			'WHALE',
			'SNAKE',
			'HORSE',
			'ZEBRA',
			'PANDA',
			'KOALA',
			'RABBIT',
			'MONKEY',
			'DOLPHIN',
			'PENGUIN',
			'GIRAFFE',
			'ELEPHANT',
			'LEOPARD',
			'CHEETAH',
		],
	},
	{
		name: 'Fruits',
		words: [
			'APPLE',
			'BANANA',
			'ORANGE',
			'GRAPE',
			'MANGO',
			'PEACH',
			'PEAR',
			'PLUM',
			'LEMON',
			'LIME',
			'MELON',
			'CHERRY',
			'BERRY',
			'PAPAYA',
			'GUAVA',
			'KIWI',
			'FIG',
			'DATE',
			'COCONUT',
			'APRICOT',
		],
	},
	{
		name: 'Colors',
		words: [
			'RED',
			'BLUE',
			'GREEN',
			'YELLOW',
			'ORANGE',
			'PURPLE',
			'PINK',
			'BLACK',
			'WHITE',
			'BROWN',
			'GRAY',
			'GOLD',
			'SILVER',
			'VIOLET',
			'INDIGO',
			'CYAN',
			'MAROON',
			'NAVY',
			'TEAL',
			'OLIVE',
		],
	},
	{
		name: 'Sports',
		words: [
			'SOCCER',
			'TENNIS',
			'GOLF',
			'HOCKEY',
			'RUGBY',
			'BOXING',
			'SKIING',
			'DIVING',
			'ROWING',
			'FENCING',
			'ARCHERY',
			'CYCLING',
			'RUNNING',
			'SWIMMING',
			'SURFING',
			'BOWLING',
			'BASEBALL',
			'BASKETBALL',
			'FOOTBALL',
			'VOLLEYBALL',
		],
	},
	{
		name: 'Countries',
		words: [
			'FRANCE',
			'SPAIN',
			'ITALY',
			'GERMANY',
			'BRAZIL',
			'JAPAN',
			'CHINA',
			'INDIA',
			'EGYPT',
			'GREECE',
			'MEXICO',
			'CANADA',
			'SWEDEN',
			'NORWAY',
			'POLAND',
			'TURKEY',
			'RUSSIA',
			'PERU',
			'CHILE',
			'KENYA',
		],
	},
	{
		name: 'Weather',
		words: [
			'SUNNY',
			'RAINY',
			'CLOUDY',
			'WINDY',
			'FOGGY',
			'STORM',
			'SNOW',
			'HAIL',
			'FROST',
			'SLEET',
			'THUNDER',
			'LIGHTNING',
			'RAINBOW',
			'BREEZE',
			'DRIZZLE',
			'BLIZZARD',
			'TORNADO',
			'HURRICANE',
			'MONSOON',
			'HEAT',
		],
	},
	{
		name: 'Music',
		words: [
			'PIANO',
			'GUITAR',
			'DRUMS',
			'VIOLIN',
			'FLUTE',
			'TRUMPET',
			'HARP',
			'CELLO',
			'BASS',
			'SAXOPHONE',
			'CLARINET',
			'HARMONICA',
			'BANJO',
			'MELODY',
			'RHYTHM',
			'CHORUS',
			'VERSE',
			'BEAT',
			'TEMPO',
			'HARMONY',
		],
	},
	{
		name: 'Space',
		words: [
			'STAR',
			'MOON',
			'PLANET',
			'COMET',
			'METEOR',
			'GALAXY',
			'NEBULA',
			'ORBIT',
			'ROCKET',
			'SATURN',
			'JUPITER',
			'MARS',
			'VENUS',
			'NEPTUNE',
			'URANUS',
			'PLUTO',
			'ASTEROID',
			'COSMOS',
			'SOLAR',
			'LUNAR',
		],
	},
	{
		name: 'Food',
		words: [
			'BREAD',
			'CHEESE',
			'PIZZA',
			'PASTA',
			'RICE',
			'SOUP',
			'SALAD',
			'STEAK',
			'CHICKEN',
			'FISH',
			'BURGER',
			'TACO',
			'SUSHI',
			'CURRY',
			'NOODLE',
			'WAFFLE',
			'PANCAKE',
			'SANDWICH',
			'PRETZEL',
			'COOKIE',
		],
	},
	{
		name: 'Nature',
		words: [
			'TREE',
			'FLOWER',
			'RIVER',
			'OCEAN',
			'MOUNTAIN',
			'VALLEY',
			'FOREST',
			'DESERT',
			'ISLAND',
			'BEACH',
			'LAKE',
			'WATERFALL',
			'CANYON',
			'VOLCANO',
			'GLACIER',
			'MEADOW',
			'JUNGLE',
			'PRAIRIE',
			'CLIFF',
			'CAVE',
		],
	},
	{
		name: 'Technology',
		words: [
			'COMPUTER',
			'PHONE',
			'TABLET',
			'LAPTOP',
			'MOUSE',
			'KEYBOARD',
			'MONITOR',
			'PRINTER',
			'ROUTER',
			'MODEM',
			'WIFI',
			'BLUETOOTH',
			'SOFTWARE',
			'HARDWARE',
			'INTERNET',
			'EMAIL',
			'BROWSER',
			'DATABASE',
			'SERVER',
			'CLOUD',
		],
	},
	{
		name: 'Occupations',
		words: [
			'DOCTOR',
			'NURSE',
			'TEACHER',
			'LAWYER',
			'CHEF',
			'PILOT',
			'ARTIST',
			'WRITER',
			'FARMER',
			'BAKER',
			'ENGINEER',
			'SCIENTIST',
			'MUSICIAN',
			'ACTOR',
			'ATHLETE',
			'DESIGNER',
			'ARCHITECT',
			'MECHANIC',
			'PLUMBER',
			'DENTIST',
		],
	},
]

// ==========================================
// Grid Generation
// ==========================================

const DIRECTIONS: Direction[] = [
	'horizontal',
	'vertical',
	'diagonal-down',
	'diagonal-up',
	'horizontal-reverse',
	'vertical-reverse',
	'diagonal-down-reverse',
	'diagonal-up-reverse',
]

/**
 * Try to place a word in the grid
 */
function tryPlaceWord(grid: string[][], word: string, random: () => number): PlacedWord | null {
	const shuffledDirections = seededShuffle(DIRECTIONS, random)

	for (const direction of shuffledDirections) {
		const vector = getDirectionVector(direction)
		const maxRow = GRID_SIZE - 1 - Math.max(0, (word.length - 1) * Math.abs(vector.row))
		const maxCol = GRID_SIZE - 1 - Math.max(0, (word.length - 1) * Math.abs(vector.col))
		const minRow = vector.row < 0 ? word.length - 1 : 0
		const minCol = vector.col < 0 ? word.length - 1 : 0

		if (maxRow < minRow || maxCol < minCol) continue

		// Try random starting positions
		const attempts = 50
		for (let attempt = 0; attempt < attempts; attempt++) {
			const startRow = minRow + Math.floor(random() * (maxRow - minRow + 1))
			const startCol = minCol + Math.floor(random() * (maxCol - minCol + 1))

			// Check if word fits
			let canPlace = true
			for (let i = 0; i < word.length; i++) {
				const row = startRow + i * vector.row
				const col = startCol + i * vector.col
				const currentLetter = grid[row][col]
				if (currentLetter !== '' && currentLetter !== word[i]) {
					canPlace = false
					break
				}
			}

			if (canPlace) {
				// Place the word
				for (let i = 0; i < word.length; i++) {
					const row = startRow + i * vector.row
					const col = startCol + i * vector.col
					grid[row][col] = word[i]
				}

				const endRow = startRow + (word.length - 1) * vector.row
				const endCol = startCol + (word.length - 1) * vector.col

				return {
					word,
					start: { row: startRow, col: startCol },
					end: { row: endRow, col: endCol },
					direction,
				}
			}
		}
	}

	return null
}

/**
 * Fill empty cells with random letters
 */
function fillEmptyCells(grid: string[][], random: () => number): void {
	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			if (grid[row][col] === '') {
				grid[row][col] = ALPHABET[Math.floor(random() * ALPHABET.length)]
			}
		}
	}
}

/**
 * Generate word search puzzle
 */
export function generateWordSearchPuzzle(seed: number): {
	puzzleData: WordSearchPuzzleData
	solution: WordSearchSolution
} {
	const random = seededRandom(seed)

	// Select theme
	const themeIndex = Math.floor(random() * THEMES.length)
	const theme = THEMES[themeIndex]

	// Shuffle and select words
	const shuffledWords = seededShuffle(theme.words, random)
	const targetWordCount = MIN_WORDS + Math.floor(random() * (MAX_WORDS - MIN_WORDS + 1))

	// Filter words that fit in grid
	const eligibleWords = shuffledWords.filter((word) => word.length <= GRID_SIZE)

	// Create empty grid
	const grid: string[][] = Array(GRID_SIZE)
		.fill(null)
		.map(() => Array(GRID_SIZE).fill(''))

	// Place words
	const placements: PlacedWord[] = []
	const words: string[] = []

	for (const word of eligibleWords) {
		if (words.length >= targetWordCount) break

		const placement = tryPlaceWord(grid, word, random)
		if (placement) {
			placements.push(placement)
			words.push(word)
		}
	}

	// Fill empty cells with random letters
	fillEmptyCells(grid, random)

	return {
		puzzleData: {
			grid,
			theme: theme.name,
			wordCount: words.length,
		},
		solution: {
			words,
			placements,
		},
	}
}

/**
 * Get theme count for archive planning
 */
export function getThemeCount(): number {
	return THEMES.length
}
