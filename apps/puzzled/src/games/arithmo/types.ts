/**
 * Arithmo Types (Nerdle-style)
 * Guess the equation in 6 tries
 */

export type CharStatus = 'correct' | 'present' | 'absent' | 'empty'

export type ArithmoPuzzleData = {
	length: number // Equation length (always 8)
}

export type ArithmoSolution = {
	equation: string // e.g., "12+34=46"
}

export type ArithmoGuess = {
	equation: string
}

export type ArithmoGuessResult = {
	valid: boolean
	result?: CharStatus[]
	error?: string
}

export type ArithmoState = {
	// Grid state
	guesses: string[]
	currentGuess: string
	results: CharStatus[][]

	// Game progress
	isComplete: boolean
	isWon: boolean
	currentRow: number
	startTime: number | null
	endTime: number | null
}

export const EQUATION_LENGTH = 8
export const MAX_ATTEMPTS = 6
export const VALID_CHARS = [
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'+',
	'-',
	'*',
	'/',
	'=',
]

/**
 * Check if equation is mathematically valid
 */
export function isValidEquation(equation: string): boolean {
	if (equation.length !== EQUATION_LENGTH) return false
	if (!equation.includes('=')) return false

	const parts = equation.split('=')
	if (parts.length !== 2) return false

	const [left, right] = parts
	if (!left || !right) return false

	try {
		// Basic validation - no leading zeros (except for single 0)
		const leftTokens = tokenize(left)
		const rightTokens = tokenize(right)

		if (!leftTokens || !rightTokens) return false

		// Evaluate both sides
		const leftValue = evaluateExpression(left)
		const rightValue = evaluateExpression(right)

		if (leftValue === null || rightValue === null) return false

		// Check equality (handle floating point)
		return Math.abs(leftValue - rightValue) < 0.0001
	} catch {
		return false
	}
}

/**
 * Tokenize expression for validation
 */
function tokenize(expr: string): string[] | null {
	const tokens: string[] = []
	let current = ''

	for (const char of expr) {
		if (VALID_CHARS.slice(0, 10).includes(char)) {
			current += char
		} else if (['+', '-', '*', '/'].includes(char)) {
			if (current) {
				// Check for leading zeros
				if (current.length > 1 && current[0] === '0') return null
				tokens.push(current)
			}
			tokens.push(char)
			current = ''
		} else {
			return null
		}
	}

	if (current) {
		if (current.length > 1 && current[0] === '0') return null
		tokens.push(current)
	}

	return tokens
}

/**
 * Safely evaluate a math expression: non-negative integers joined by + - * /
 * with the usual precedence and real (not integer) division. No parentheses and
 * no unary minus, matching the characters the game accepts and the server
 * validator (`domain/arithmo.rs`). Never uses `eval`/`new Function`: the CSP has
 * no 'unsafe-eval'.
 */
export function evaluateExpression(expr: string): number | null {
	// Only allow valid characters
	if (!/^[0-9+\-*/]+$/.test(expr)) return null

	// Prevent division by zero (including /0, /00, /000, etc.)
	if (/\/0+(?![0-9])/.test(expr) || expr.endsWith('/0')) return null

	let pos = 0

	const number = (): number | null => {
		const start = pos
		while (pos < expr.length && expr[pos] >= '0' && expr[pos] <= '9') pos++
		if (pos === start) return null
		const digits = expr.slice(start, pos)
		if (digits.length > 1 && digits[0] === '0') return null
		return Number(digits)
	}

	const term = (): number | null => {
		let value = number()
		if (value === null) return null
		while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
			const op = expr[pos++]
			const rhs = number()
			if (rhs === null) return null
			if (op === '*') {
				value *= rhs
			} else {
				if (rhs === 0) return null
				value /= rhs
			}
		}
		return value
	}

	let result = term()
	if (result === null) return null
	while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
		const op = expr[pos++]
		const rhs = term()
		if (rhs === null) return null
		result = op === '+' ? result + rhs : result - rhs
	}
	if (pos !== expr.length || !Number.isFinite(result)) return null
	return result
}

/**
 * Get character statuses for a guess compared to solution
 */
export function getGuessResult(guess: string, solution: string): CharStatus[] {
	const result: CharStatus[] = Array(EQUATION_LENGTH).fill('absent')
	const solutionChars = solution.split('')
	const guessChars = guess.split('')
	const used = Array(EQUATION_LENGTH).fill(false)

	// First pass: mark correct
	for (let i = 0; i < EQUATION_LENGTH; i++) {
		if (guessChars[i] === solutionChars[i]) {
			result[i] = 'correct'
			used[i] = true
		}
	}

	// Second pass: mark present
	for (let i = 0; i < EQUATION_LENGTH; i++) {
		if (result[i] === 'correct') continue

		for (let j = 0; j < EQUATION_LENGTH; j++) {
			if (!used[j] && guessChars[i] === solutionChars[j]) {
				result[i] = 'present'
				used[j] = true
				break
			}
		}
	}

	return result
}
