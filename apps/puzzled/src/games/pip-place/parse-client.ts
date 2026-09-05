/**
 * Client parser for GetDaily Spots payloads.
 *
 * After leak-strip, the wire form is
 * `{ maxPip, rows, cols, regionOf, regions }` — not
 * `{ puzzleData, solution }`. Tray is `doubleSet(maxPip)` from those
 * fields. Stored tiles and solution comparison are forbidden here.
 */

import type { PipPlacePuzzleData, PipPlaceRegion, RegionKind } from './types'

const REGION_KINDS = new Set<RegionKind>(['sum', 'equal', 'unequal', 'free'])

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asInt(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function parseRegionOf(raw: unknown, rows: number, cols: number): number[][] {
	if (!Array.isArray(raw) || raw.length !== rows) {
		throw new Error('[pip-place] invalid regionOf')
	}
	const out: number[][] = []
	for (const line of raw) {
		if (!Array.isArray(line) || line.length !== cols) {
			throw new Error('[pip-place] invalid regionOf row')
		}
		const parsed: number[] = []
		for (const cell of line) {
			const id = asInt(cell)
			if (id === null) {
				throw new Error('[pip-place] invalid regionOf cell')
			}
			parsed.push(id)
		}
		out.push(parsed)
	}
	return out
}

function parseRegions(raw: unknown): PipPlaceRegion[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Error('[pip-place] missing regions')
	}
	const out: PipPlaceRegion[] = []
	for (const item of raw) {
		if (!isRecord(item)) {
			throw new Error('[pip-place] invalid region')
		}
		const id = asInt(item.id)
		if (id === null) {
			throw new Error('[pip-place] invalid region id')
		}
		if (typeof item.kind !== 'string' || !REGION_KINDS.has(item.kind as RegionKind)) {
			throw new Error('[pip-place] invalid region kind')
		}
		let value: number | null
		if (item.value === null) {
			value = null
		} else {
			value = asInt(item.value)
			if (value === null) {
				throw new Error('[pip-place] invalid region value')
			}
		}
		out.push({ id, kind: item.kind as RegionKind, value })
	}
	return out
}

/**
 * Accept live GetDaily `{maxPip,rows,cols,regionOf,regions}` or the
 * legacy wrapped shape. Never returns or requires a solution. `tiles`
 * keys are dropped.
 */
export function parsePipPlaceClientPayload(data: unknown): PipPlacePuzzleData {
	if (!isRecord(data)) {
		throw new Error('[pip-place] invalid puzzle payload')
	}
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	if (!isRecord(inner)) {
		throw new Error('[pip-place] invalid puzzle payload')
	}

	const maxPip = asInt(inner.maxPip)
	if (maxPip === null || maxPip < 0) {
		throw new Error('[pip-place] invalid maxPip')
	}
	const rows = asInt(inner.rows)
	const cols = asInt(inner.cols)
	if (rows === null || cols === null || rows <= 0 || cols <= 0) {
		throw new Error('[pip-place] invalid board size')
	}

	return {
		maxPip,
		rows,
		cols,
		regionOf: parseRegionOf(inner.regionOf, rows, cols),
		regions: parseRegions(inner.regions),
	}
}
