/**
 * Spots puzzle generator
 *
 * Seeded matching tiling of a 4×5 board, complete double-3 set shuffled
 * onto the pairs, then 6–8 connected regions of size 2–4 with constraints
 * taken from the seed pips. Always succeeds. Uniqueness is not required.
 */

import { seededRandom, shuffleArray } from '@/games/shared/random'
import type {
	Cell,
	PipPlacePuzzleData,
	PipPlaceRegion,
	PipPlaceSolution,
	PipPlaceTile,
} from './types'
import { DAILY_COLS, DAILY_MAX_PIP, DAILY_ROWS, doubleSet, isOrthogonalNeighbor } from './types'

type Cover = { a: Cell; b: Cell }

function cellId(cell: Cell, cols: number): number {
	return cell.row * cols + cell.col
}

function fromId(id: number, cols: number): Cell {
	return { row: Math.floor(id / cols), col: id % cols }
}

function firstEmpty(occupied: boolean[][]): Cell | null {
	for (let row = 0; row < occupied.length; row++) {
		const line = occupied[row]
		if (!line) continue
		for (let col = 0; col < line.length; col++) {
			if (!line[col]) return { row, col }
		}
	}
	return null
}

function generateMatching(rows: number, cols: number, random: () => number): Cover[] {
	const occupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
	const result: Cover[] = []

	function dfs(): boolean {
		const cell = firstEmpty(occupied)
		if (!cell) return true
		const options: Cover[] = []
		if (cell.col + 1 < cols && !occupied[cell.row][cell.col + 1]) {
			options.push({ a: cell, b: { row: cell.row, col: cell.col + 1 } })
		}
		if (cell.row + 1 < rows && !occupied[cell.row + 1][cell.col]) {
			options.push({ a: cell, b: { row: cell.row + 1, col: cell.col } })
		}
		for (const cover of shuffleArray(options, random)) {
			occupied[cover.a.row][cover.a.col] = true
			occupied[cover.b.row][cover.b.col] = true
			result.push(cover)
			if (dfs()) return true
			result.pop()
			occupied[cover.a.row][cover.a.col] = false
			occupied[cover.b.row][cover.b.col] = false
		}
		return false
	}

	if (!dfs()) {
		throw new Error('Spots generator: board is not tileable')
	}
	return result
}

function assignTiles(covers: Cover[], maxPip: number, random: () => number): PipPlaceTile[] {
	const set = shuffleArray(doubleSet(maxPip), random)
	return covers.map((cover, i) => {
		const pair = set[i] ?? [0, 0]
		if (random() < 0.5) {
			return { a: cover.a, b: cover.b, pa: pair[0], pb: pair[1] }
		}
		return { a: cover.a, b: cover.b, pa: pair[1], pb: pair[0] }
	})
}

function pipAt(tiles: PipPlaceTile[], cell: Cell): number | null {
	for (const tile of tiles) {
		if (tile.a.row === cell.row && tile.a.col === cell.col) return tile.pa
		if (tile.b.row === cell.row && tile.b.col === cell.col) return tile.pb
	}
	return null
}

function gridEdges(rows: number, cols: number): Array<[number, number]> {
	const edges: Array<[number, number]> = []
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const id = row * cols + col
			if (col + 1 < cols) edges.push([id, id + 1])
			if (row + 1 < rows) edges.push([id, id + cols])
		}
	}
	return edges
}

function remapRegions(parent: number[], rows: number, cols: number): number[][] | null {
	const n = rows * cols
	const find = (x: number): number => {
		let cur = x
		while (parent[cur] !== cur) cur = parent[cur]
		return cur
	}
	const roots: number[] = []
	const rootIndex = new Map<number, number>()
	for (let i = 0; i < n; i++) {
		const root = find(i)
		if (!rootIndex.has(root)) {
			rootIndex.set(root, roots.length)
			roots.push(root)
		}
	}
	if (roots.length < 6 || roots.length > 8) return null

	const sizes = Array(roots.length).fill(0)
	const regionOf: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
	for (let i = 0; i < n; i++) {
		const idx = rootIndex.get(find(i))
		if (idx === undefined) return null
		sizes[idx]++
		const cell = fromId(i, cols)
		regionOf[cell.row][cell.col] = idx
	}
	if (sizes.some((size) => size < 2 || size > 4)) return null
	return regionOf
}

function tryRandomRegions(rows: number, cols: number, random: () => number): number[][] | null {
	const n = rows * cols
	const parent = Array.from({ length: n }, (_, i) => i)
	const size = Array(n).fill(1)
	const find = (x: number): number => {
		let cur = x
		while (parent[cur] !== cur) cur = parent[cur]
		return cur
	}
	const union = (a: number, b: number): boolean => {
		let ra = find(a)
		let rb = find(b)
		if (ra === rb) return false
		if (size[ra] + size[rb] > 4) return false
		if (size[ra] < size[rb]) {
			const tmp = ra
			ra = rb
			rb = tmp
		}
		parent[rb] = ra
		size[ra] += size[rb]
		return true
	}

	const edges = shuffleArray(gridEdges(rows, cols), random)
	for (const [a, b] of edges) {
		const sa = size[find(a)]
		const sb = size[find(b)]
		if (sa === 1 || sb === 1 || random() < 0.55) union(a, b)
	}
	for (const [a, b] of edges) {
		if (size[find(a)] === 1 || size[find(b)] === 1) union(a, b)
	}

	const componentCount = (): number => {
		const seen = new Set<number>()
		for (let i = 0; i < n; i++) seen.add(find(i))
		return seen.size
	}
	if (componentCount() > 8) {
		for (const [a, b] of edges) {
			if (componentCount() <= 8) break
			union(a, b)
		}
	}
	return remapRegions(parent, rows, cols)
}

function fallbackRegions(rows: number, cols: number, random: () => number): number[][] {
	const n = rows * cols
	const parent = Array.from({ length: n }, (_, i) => i)
	const size = Array(n).fill(1)
	const find = (x: number): number => {
		let cur = x
		while (parent[cur] !== cur) cur = parent[cur]
		return cur
	}
	const union = (a: number, b: number): boolean => {
		const ra = find(a)
		const rb = find(b)
		if (ra === rb) return false
		if (size[ra] + size[rb] > 4) return false
		parent[rb] = ra
		size[ra] += size[rb]
		return true
	}

	for (let col = 0; col < cols; col++) {
		for (let row = 0; row + 1 < rows; row += 2) {
			union(cellId({ row, col }, cols), cellId({ row: row + 1, col }, cols))
		}
	}

	const adjacent: Array<[number, number]> = []
	for (let a = 0; a < n; a++) {
		for (let b = a + 1; b < n; b++) {
			if (find(a) === find(b)) continue
			if (!isOrthogonalNeighbor(fromId(a, cols), fromId(b, cols))) continue
			adjacent.push([a, b])
		}
	}
	const mergesWanted = 2 + Math.floor(random() * 3)
	let merged = 0
	for (const [a, b] of shuffleArray(adjacent, random)) {
		if (merged >= mergesWanted) break
		if (union(a, b)) merged++
	}

	const mapped = remapRegions(parent, rows, cols)
	if (mapped) return mapped

	const regionOf: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
	let id = 0
	for (let col = 0; col < cols; col++) {
		for (let row = 0; row + 1 < rows; row += 2) {
			regionOf[row][col] = id
			regionOf[row + 1][col] = id
			id++
		}
	}
	return regionOf
}

function generateRegions(rows: number, cols: number, random: () => number): number[][] {
	for (let attempt = 0; attempt < 80; attempt++) {
		const found = tryRandomRegions(rows, cols, random)
		if (found) return found
	}
	return fallbackRegions(rows, cols, random)
}

function regionPips(regionOf: number[][], tiles: PipPlaceTile[], id: number): number[] {
	const pips: number[] = []
	for (let row = 0; row < regionOf.length; row++) {
		const line = regionOf[row]
		if (!line) continue
		for (let col = 0; col < line.length; col++) {
			if (line[col] !== id) continue
			const pip = pipAt(tiles, { row, col })
			if (pip === null) continue
			pips.push(pip)
		}
	}
	return pips
}

function assignConstraints(
	regionOf: number[][],
	tiles: PipPlaceTile[],
	random: () => number,
): PipPlaceRegion[] {
	const ids = new Set<number>()
	for (const line of regionOf) {
		for (const id of line) ids.add(id)
	}
	const ordered = [...ids].sort((a, b) => a - b)
	const stats = ordered.map((id) => {
		const pips = regionPips(regionOf, tiles, id)
		const sum = pips.reduce((acc, pip) => acc + pip, 0)
		const canEqual = pips.length > 0 && pips.every((pip) => pip === pips[0])
		const canUnequal = pips.length > 0 && new Set(pips).size === pips.length
		return { id, pips, sum, canEqual, canUnequal }
	})

	const assigned: PipPlaceRegion[] = stats.map((stat) => ({
		id: stat.id,
		kind: 'sum',
		value: stat.sum,
	}))

	const equalCandidates = shuffleArray(
		stats.map((stat, index) => ({ index, ok: stat.canEqual })),
		random,
	).filter((item) => item.ok)
	if (equalCandidates[0]) {
		const idx = equalCandidates[0].index
		const first = stats[idx]?.pips[0] ?? 0
		assigned[idx] = { id: stats[idx].id, kind: 'equal', value: first }
	}

	const unequalCandidates = shuffleArray(
		stats.map((stat, index) => ({
			index,
			ok: stat.canUnequal && assigned[index]?.kind !== 'equal',
		})),
		random,
	).filter((item) => item.ok)
	if (unequalCandidates[0]) {
		const idx = unequalCandidates[0].index
		assigned[idx] = { id: stats[idx].id, kind: 'unequal', value: null }
	}

	let nonFree = assigned.length
	for (let i = 0; i < assigned.length; i++) {
		if (nonFree <= 3) break
		if (random() >= 0.12) continue
		assigned[i] = { id: assigned[i].id, kind: 'free', value: null }
		nonFree--
	}

	if (nonFree < 3) {
		for (let i = 0; i < assigned.length && nonFree < 3; i++) {
			if (assigned[i].kind !== 'free') continue
			assigned[i] = { id: stats[i].id, kind: 'sum', value: stats[i].sum }
			nonFree++
		}
	}

	return assigned
}

export function generatePipPlacePuzzle(
	seed: number,
	rows: number = DAILY_ROWS,
	cols: number = DAILY_COLS,
	maxPip: number = DAILY_MAX_PIP,
): {
	puzzleData: PipPlacePuzzleData
	solution: PipPlaceSolution
} {
	const random = seededRandom(seed)
	const covers = generateMatching(rows, cols, random)
	const tiles = assignTiles(covers, maxPip, random)
	const regionOf = generateRegions(rows, cols, random)
	const regions = assignConstraints(regionOf, tiles, random)

	return {
		puzzleData: {
			maxPip,
			rows,
			cols,
			regionOf,
			regions,
		},
		solution: {
			tiles: tiles.map((tile) => ({
				a: { row: tile.a.row, col: tile.a.col },
				b: { row: tile.b.row, col: tile.b.col },
				pa: tile.pa,
				pb: tile.pb,
			})),
		},
	}
}
