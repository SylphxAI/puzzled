/**
 * Cryptogram Game Types
 * Decrypt famous quotes by substituting letters
 */

// ==========================================
// Constants
// ==========================================

export const MAX_HINTS = 3
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ==========================================
// Core Types
// ==========================================

/**
 * A letter substitution mapping
 * Key: encrypted letter, Value: original letter
 */
export type SubstitutionMap = Record<string, string>

/**
 * Player's current guesses
 * Key: encrypted letter, Value: player's guess (or empty)
 */
export type PlayerGuesses = Record<string, string>

/**
 * Puzzle data sent to client
 */
export type CryptogramPuzzleData = {
	/** The encrypted quote text */
	encryptedText: string
	/** Author of the quote (shown as hint) */
	author: string
	/** Category/theme of the quote */
	category: string
	/** Number of unique letters to solve */
	uniqueLetters: number
	/** Maximum hints allowed */
	maxHints: number
}

/**
 * Solution stored server-side
 */
export type CryptogramSolution = {
	/** The original quote text */
	originalText: string
	/** The substitution cipher used */
	cipher: SubstitutionMap
	/** Reverse mapping for validation */
	reverseCipher: SubstitutionMap
}

/**
 * Client's guess for validation
 */
export type CryptogramGuess = {
	/** The encrypted letter being mapped */
	encryptedLetter: string
	/** The player's guess for what letter it represents */
	guessedLetter: string
}

/**
 * Result of validating a guess
 */
export type CryptogramGuessResult = {
	/** Whether the guess format is valid */
	valid: boolean
	/** Whether the guess is correct */
	correct?: boolean
	/** Error message if invalid */
	error?: string
}

/**
 * Game state for the cryptogram puzzle
 */
export type CryptogramGameState = {
	/** Player's current guesses for each encrypted letter */
	guesses: PlayerGuesses
	/** Currently selected encrypted letter (for keyboard input) */
	selectedLetter: string | null
	/** Number of hints used */
	hintsUsed: number
	/** Letters revealed by hints (cannot be changed) */
	revealedLetters: string[]
	/** Current game status */
	gameStatus: 'playing' | 'won' | 'lost'
	/** When the player started */
	startTime: number | null
	/** When the player finished */
	endTime: number | null
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Create a random substitution cipher
 */
export function createCipher(seed: number): SubstitutionMap {
	const letters = ALPHABET.split('')
	const shuffled = seededShuffle(letters, seed)

	const cipher: SubstitutionMap = {}
	for (let i = 0; i < 26; i++) {
		cipher[letters[i]] = shuffled[i]
	}

	return cipher
}

/**
 * Create reverse mapping from cipher
 */
export function reverseCipher(cipher: SubstitutionMap): SubstitutionMap {
	const reverse: SubstitutionMap = {}
	for (const [original, encrypted] of Object.entries(cipher)) {
		reverse[encrypted] = original
	}
	return reverse
}

/**
 * Encrypt text using cipher
 */
export function encryptText(text: string, cipher: SubstitutionMap): string {
	return text
		.toUpperCase()
		.split('')
		.map((char) => {
			if (char >= 'A' && char <= 'Z') {
				return cipher[char] || char
			}
			return char // Keep punctuation, spaces, etc.
		})
		.join('')
}

/**
 * Get unique letters in text
 */
export function getUniqueLetters(text: string): string[] {
	const letters = new Set<string>()
	for (const char of text.toUpperCase()) {
		if (char >= 'A' && char <= 'Z') {
			letters.add(char)
		}
	}
	return Array.from(letters).sort()
}

/**
 * Check if puzzle is solved
 */
export function isSolved(
	encryptedText: string,
	playerGuesses: PlayerGuesses,
	reverseCipherMap: SubstitutionMap,
): boolean {
	const uniqueEncrypted = getUniqueLetters(encryptedText)

	for (const encrypted of uniqueEncrypted) {
		const correct = reverseCipherMap[encrypted]
		const guess = playerGuesses[encrypted]
		if (guess !== correct) {
			return false
		}
	}

	return true
}

/**
 * Count correct guesses
 */
export function countCorrect(
	encryptedText: string,
	playerGuesses: PlayerGuesses,
	reverseCipherMap: SubstitutionMap,
): number {
	const uniqueEncrypted = getUniqueLetters(encryptedText)
	let correct = 0

	for (const encrypted of uniqueEncrypted) {
		if (playerGuesses[encrypted] === reverseCipherMap[encrypted]) {
			correct++
		}
	}

	return correct
}

/**
 * Seeded shuffle for deterministic cipher generation
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
	const shuffled = [...array]
	let currentSeed = seed

	const random = () => {
		currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff
		return currentSeed / 0x7fffffff
	}

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled
}
