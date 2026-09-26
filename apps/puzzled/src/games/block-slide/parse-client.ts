/**
 * Client parser for GetDaily block-slide payloads.
 *
 * The server serves the board (`{ blocks, gridWidth, gridHeight, exitX, exitY,
 * minMoves }`) with the solution stripped. The legacy wrapped
 * `{ puzzleData, solution }` shape is accepted and its solution dropped: the
 * browser judges the finish by the rules (`isWin`), and the server validates
 * the submitted moves.
 */

import type { Block, BlockSlidePuzzle } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const isInt = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value)

function parseBlock(value: unknown): Block {
	if (!isRecord(value)) throw new Error('[block-slide] invalid block')
	const { id, x, y, width, height, isTarget } = value
	if (typeof id !== 'string' || !isInt(x) || !isInt(y) || !isInt(width) || !isInt(height)) {
		throw new Error('[block-slide] invalid block')
	}
	return { id, x, y, width, height, isTarget: isTarget === true }
}

export function parseBlockSlideClientPayload(data: unknown): BlockSlidePuzzle {
	if (!isRecord(data)) throw new Error('[block-slide] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const { blocks, gridWidth, gridHeight, exitX, exitY, minMoves } = inner
	if (!Array.isArray(blocks) || blocks.length === 0) {
		throw new Error('[block-slide] blocks missing')
	}
	if (!isInt(gridWidth) || !isInt(gridHeight) || !isInt(exitX) || !isInt(exitY)) {
		throw new Error('[block-slide] board size or exit missing')
	}
	const parsed = blocks.map(parseBlock)
	if (parsed.filter((block) => block.isTarget).length !== 1) {
		throw new Error('[block-slide] exactly one target block required')
	}
	return {
		blocks: parsed,
		gridWidth,
		gridHeight,
		exitX,
		exitY,
		minMoves: isInt(minMoves) ? minMoves : 0,
	}
}
