/**
 * Arithmo Equation Generator
 *
 * ⚠️ FROZEN SINCE: v1.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Algorithmically generates valid 8-character equations.
 * Uses seed for deterministic selection from a large pool.
 */

import type { ArithmoPuzzleData, ArithmoSolution } from './types'

/**
 * Generate all valid 8-character equations
 * Patterns:
 * - NN+NN=NN (addition)
 * - NN-NN=NN (subtraction)
 * - NNN/N=NN (division)
 * - N*NN=NNN (multiplication)
 * - N+N*N=NN (order of operations)
 */
function generateEquationPool(): string[] {
	const equations: string[] = []

	// Addition: NN+NN=NN (8 chars)
	// a + b = c where a, b are 10-99 and c is 10-99
	for (let a = 10; a <= 99; a++) {
		for (let b = 10; b <= 99; b++) {
			const c = a + b
			if (c >= 10 && c <= 99) {
				const eq = `${a}+${b}=${c}`
				if (eq.length === 8) {
					equations.push(eq)
				}
			}
		}
	}

	// Subtraction: NN-NN=NN (8 chars)
	// a - b = c where a, b are 10-99 and c is 10-99
	for (let a = 10; a <= 99; a++) {
		for (let b = 10; b <= 99; b++) {
			const c = a - b
			if (c >= 10 && c <= 99) {
				const eq = `${a}-${b}=${c}`
				if (eq.length === 8) {
					equations.push(eq)
				}
			}
		}
	}

	// Division: NNN/N=NN (8 chars)
	// a / b = c where a is 100-999, b is 1-9, c is 10-99
	for (let a = 100; a <= 999; a++) {
		for (let b = 2; b <= 9; b++) {
			if (a % b === 0) {
				const c = a / b
				if (c >= 10 && c <= 99) {
					const eq = `${a}/${b}=${c}`
					if (eq.length === 8) {
						equations.push(eq)
					}
				}
			}
		}
	}

	// Multiplication: N*NN=NNN (8 chars)
	// a * b = c where a is 2-9, b is 10-99, c is 100-999
	for (let a = 2; a <= 9; a++) {
		for (let b = 10; b <= 99; b++) {
			const c = a * b
			if (c >= 100 && c <= 999) {
				const eq = `${a}*${b}=${c}`
				if (eq.length === 8) {
					equations.push(eq)
				}
			}
		}
	}

	// Order of operations: N+N*N=NN (8 chars)
	// a + b * c = d (follows math order: b*c first)
	for (let a = 1; a <= 9; a++) {
		for (let b = 2; b <= 9; b++) {
			for (let c = 2; c <= 9; c++) {
				const d = a + b * c
				if (d >= 10 && d <= 99) {
					const eq = `${a}+${b}*${c}=${d}`
					if (eq.length === 8) {
						equations.push(eq)
					}
				}
			}
		}
	}

	// Order of operations: N*N+N=NN (8 chars)
	for (let a = 2; a <= 9; a++) {
		for (let b = 2; b <= 9; b++) {
			for (let c = 1; c <= 9; c++) {
				const d = a * b + c
				if (d >= 10 && d <= 99) {
					const eq = `${a}*${b}+${c}=${d}`
					if (eq.length === 8) {
						equations.push(eq)
					}
				}
			}
		}
	}

	// Order of operations: N*N-N=NN (8 chars)
	for (let a = 2; a <= 9; a++) {
		for (let b = 2; b <= 9; b++) {
			for (let c = 1; c <= 9; c++) {
				const d = a * b - c
				if (d >= 10 && d <= 99) {
					const eq = `${a}*${b}-${c}=${d}`
					if (eq.length === 8) {
						equations.push(eq)
					}
				}
			}
		}
	}

	// Division alternative: NN/N=NN (7 chars - need to adjust)
	// Actually this is 7 chars, skip

	// N*NNN=NN doesn't work (too long)

	// Shuffle for variety while keeping deterministic
	return shuffle(equations, 42)
}

/**
 * Seeded shuffle for deterministic randomization
 */
function shuffle<T>(array: T[], seed: number): T[] {
	const result = [...array]
	let state = seed

	const random = () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff
		return state / 0x7fffffff
	}

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[result[i], result[j]] = [result[j], result[i]]
	}

	return result
}

// Pre-generate the pool at module load
const EQUATION_POOL = generateEquationPool()

/**
 * Get a puzzle from seed
 */
export function generateArithmoPuzzle(seed: number): {
	puzzleData: ArithmoPuzzleData
	solution: ArithmoSolution
} {
	const index = Math.abs(seed) % EQUATION_POOL.length
	const equation = EQUATION_POOL[index]

	return {
		puzzleData: {
			length: 8,
		},
		solution: {
			equation,
		},
	}
}

/**
 * Get count of available equations
 */
export function getEquationPoolCount(): number {
	return EQUATION_POOL.length
}
