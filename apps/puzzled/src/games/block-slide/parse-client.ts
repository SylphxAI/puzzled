/**
 * Client parser for the solution-safe Slides payload served by Connect.
 */

import type { Block, BlockSlidePuzzle } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseBlock(raw: unknown): Block {
	if (!isRecord(raw)) throw new Error('[block-slide] invalid block')
	if (typeof raw.id !== 'string' || raw.id.length === 0) {
		throw new Error('[block-slide] block id required')
	}
	for (const key of ['x', 'y', 'width', 'height'] as const) {
		if (typeof raw[key] !== 'number' || !Number.isInteger(raw[key]) || raw[key] < 0) {
			throw new Error('[block-slide] block coordinates must be integers')
		}
	}
	return {
		id: raw.id,
		x: raw.x as number,
		y: raw.y as number,
		width: raw.width as number,
		height: raw.height as number,
		isTarget: raw.isTarget === true,
	}
}

export function parseBlockSlideClientPayload(data: unknown): BlockSlidePuzzle {
	if (!isRecord(data)) throw new Error('[block-slide] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[block-slide] solution-bearing puzzle payload is not client-safe')
	}
	if (!Array.isArray(data.blocks) || data.blocks.length === 0) {
		throw new Error('[block-slide] blocks required')
	}
	const ints = ['gridWidth', 'gridHeight', 'exitX', 'exitY', 'minMoves'] as const
	for (const key of ints) {
		if (
			typeof data[key] !== 'number' ||
			!Number.isInteger(data[key]) ||
			(data[key] as number) < 0
		) {
			throw new Error(`[block-slide] ${key} must be a non-negative integer`)
		}
	}
	return {
		blocks: data.blocks.map(parseBlock),
		gridWidth: data.gridWidth as number,
		gridHeight: data.gridHeight as number,
		exitX: data.exitX as number,
		exitY: data.exitY as number,
		minMoves: data.minMoves as number,
	}
}
