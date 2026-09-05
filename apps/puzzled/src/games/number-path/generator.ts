/**
 * Path puzzle generator
 *
 * Seeded Hamiltonian path via serpentine + random backbite, then clues
 * until the grid is (proven) unique. Always succeeds on a rectangular grid.
 */

import { seededRandom, shuffleArray } from '@/games/shared/random'
import type { Cell, NumberPathPuzzleData, NumberPathSolution } from './types'
import { cellKey, GRID_SIZE } from './types'

const MIN_CLUES = 8
const BACKBITE_MIN = 200
const BACKBITE_SPAN = 301
const DEFAULT_NODE_BUDGET = 100_000
const DEFAULT_MAX_SOLUTIONS = 2

export type CountSolutionsResult = {
	solutions: number
	nodes: number
	exhausted: boolean
}

function serpentinePath(size: number): Cell[] {
	const path: Cell[] = []
	for (let r = 0; r < size; r++) {
		if (r % 2 === 0) {
			for (let c = 0; c < size; c++) path.push({ row: r, col: c })
		} else {
			for (let c = size - 1; c >= 0; c--) path.push({ row: r, col: c })
		}
	}
	return path
}

function orthogonalNeighbors(cell: Cell, size: number): Cell[] {
	const out: Cell[] = []
	const dirs: Array<[number, number]> = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	]
	for (const [dr, dc] of dirs) {
		const row = cell.row + dr
		const col = cell.col + dc
		if (row >= 0 && col >= 0 && row < size && col < size) {
			out.push({ row, col })
		}
	}
	return out
}

function applyBackbite(path: Cell[], size: number, random: () => number): void {
	if (random() < 0.5) {
		path.reverse()
	}
	const n = path.length
	if (n < 3) return

	const indexOf = new Map<string, number>()
	for (let i = 0; i < n; i++) {
		indexOf.set(cellKey(path[i]), i)
	}

	const end = path[n - 1]
	const candidates: number[] = []
	for (const neighbor of orthogonalNeighbors(end, size)) {
		const i = indexOf.get(cellKey(neighbor))
		if (i !== undefined && i < n - 2) {
			candidates.push(i)
		}
	}
	if (candidates.length === 0) return

	const pick = candidates[Math.floor(random() * candidates.length)]
	const suffix = path.slice(pick + 1).reverse()
	path.length = pick + 1
	path.push(...suffix)
}

function isTurn(path: Cell[], idx: number): boolean {
	if (idx <= 0 || idx >= path.length - 1) return false
	const prev = path[idx - 1]
	const cur = path[idx]
	const next = path[idx + 1]
	const dr1 = cur.row - prev.row
	const dc1 = cur.col - prev.col
	const dr2 = next.row - cur.row
	const dc2 = next.col - cur.col
	return dr1 !== dr2 || dc1 !== dc2
}

function emptyClues(size: number): (number | null)[][] {
	return Array.from({ length: size }, () => Array<number | null>(size).fill(null))
}

function isProvenUnique(result: CountSolutionsResult): boolean {
	return result.solutions === 1 && !result.exhausted
}

/**
 * Count Hamiltonian paths that respect clues.
 * Aborts at `maxSolutions` or `nodeBudget` (treat exhaustion as not-proven-unique).
 */
export function countSolutions(
	clues: (number | null)[][],
	options?: { maxSolutions?: number; nodeBudget?: number },
): CountSolutionsResult {
	const size = clues.length
	if (size === 0) return { solutions: 0, nodes: 0, exhausted: false }
	for (const row of clues) {
		if (row.length !== size) return { solutions: 0, nodes: 0, exhausted: false }
	}

	const n = size * size
	const maxSolutions = options?.maxSolutions ?? DEFAULT_MAX_SOLUTIONS
	const nodeBudget = options?.nodeBudget ?? DEFAULT_NODE_BUDGET

	const cluePos = new Map<number, Cell>()
	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; col++) {
			const clue = clues[row][col]
			if (clue === null || clue === undefined) continue
			cluePos.set(clue, { row, col })
		}
	}

	const start = cluePos.get(1)
	if (!start) return { solutions: 0, nodes: 0, exhausted: false }

	const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
	visited[start.row][start.col] = true

	let solutions = 0
	let nodes = 0
	let exhausted = false

	const dirs: Array<[number, number]> = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	]

	function manhattanOk(cell: Cell, nextNum: number): boolean {
		for (const [k, pos] of cluePos) {
			if (k < nextNum) continue
			const dist = Math.abs(cell.row - pos.row) + Math.abs(cell.col - pos.col)
			const steps = k - nextNum
			if (dist > steps) return false
			if ((steps - dist) % 2 !== 0) return false
		}
		return true
	}

	function dfs(row: number, col: number, len: number): void {
		if (exhausted || solutions >= maxSolutions) return
		nodes++
		if (nodes >= nodeBudget) {
			exhausted = true
			return
		}
		if (len === n) {
			solutions++
			return
		}
		const nextNum = len + 1
		for (const [dr, dc] of dirs) {
			const nr = row + dr
			const nc = col + dc
			if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue
			if (visited[nr][nc]) continue
			const clue = clues[nr][nc]
			if (clue !== null && clue !== undefined && clue !== nextNum) continue
			if (!manhattanOk({ row: nr, col: nc }, nextNum)) continue
			visited[nr][nc] = true
			dfs(nr, nc, len + 1)
			visited[nr][nc] = false
			if (exhausted || solutions >= maxSolutions) return
		}
	}

	if (!manhattanOk(start, 1)) {
		return { solutions: 0, nodes: 0, exhausted: false }
	}
	dfs(start.row, start.col, 1)
	return { solutions, nodes, exhausted }
}

export function generateNumberPathPuzzle(
	seed: number,
	size: number = GRID_SIZE,
): {
	puzzleData: NumberPathPuzzleData
	solution: NumberPathSolution
} {
	const random = seededRandom(seed)
	const path = serpentinePath(size)
	const biteCount = BACKBITE_MIN + Math.floor(random() * BACKBITE_SPAN)
	for (let i = 0; i < biteCount; i++) {
		applyBackbite(path, size, random)
	}

	const n = size * size
	const clues = emptyClues(size)
	clues[path[0].row][path[0].col] = 1
	clues[path[n - 1].row][path[n - 1].col] = n

	const intermediates: { cell: Cell; number: number; turn: boolean }[] = []
	for (let i = 1; i < n - 1; i++) {
		intermediates.push({
			cell: path[i],
			number: i + 1,
			turn: isTurn(path, i),
		})
	}
	const turns = shuffleArray(
		intermediates.filter((item) => item.turn),
		random,
	)
	const straights = shuffleArray(
		intermediates.filter((item) => !item.turn),
		random,
	)
	const order = [...turns, ...straights]

	let clueCount = 2
	let unique = isProvenUnique(countSolutions(clues))
	for (const item of order) {
		if (unique && clueCount >= MIN_CLUES) break
		clues[item.cell.row][item.cell.col] = item.number
		clueCount++
		unique = isProvenUnique(countSolutions(clues))
	}

	return {
		puzzleData: { size, clues },
		solution: {
			path: path.map((cell) => ({ row: cell.row, col: cell.col })),
		},
	}
}
