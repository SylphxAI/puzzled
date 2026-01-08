/**
 * Block Slide Types
 *
 * Sliding puzzle where you move blocks to get the target block to the exit.
 */

export type Block = {
	id: string
	x: number
	y: number
	width: number
	height: number
	isTarget: boolean
}

export type BlockSlidePuzzle = {
	blocks: Block[]
	gridWidth: number
	gridHeight: number
	exitX: number
	exitY: number
	minMoves: number
}

export type BlockSlideSolution = {
	minMoves: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

/**
 * Check if a block can move in a direction
 * Classic Klotski rules: any block can move in any direction if there's space
 */
export function canMove(
	blocks: Block[],
	blockId: string,
	direction: Direction,
	gridWidth: number,
	gridHeight: number,
): boolean {
	const block = blocks.find((b) => b.id === blockId)
	if (!block) return false

	const newX = block.x + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0)
	const newY = block.y + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0)

	// Check bounds
	if (newX < 0 || newY < 0) return false
	if (newX + block.width > gridWidth) return false
	if (newY + block.height > gridHeight) return false

	// Check collision with other blocks
	for (const other of blocks) {
		if (other.id === blockId) continue
		if (blocksOverlap({ ...block, x: newX, y: newY }, other)) {
			return false
		}
	}

	return true
}

/**
 * Check if two blocks overlap
 */
function blocksOverlap(a: Block, b: Block): boolean {
	return !(
		a.x + a.width <= b.x ||
		b.x + b.width <= a.x ||
		a.y + a.height <= b.y ||
		b.y + b.height <= a.y
	)
}

/**
 * Move a block in a direction
 */
export function moveBlock(blocks: Block[], blockId: string, direction: Direction): Block[] {
	return blocks.map((block) => {
		if (block.id !== blockId) return block
		return {
			...block,
			x: block.x + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0),
			y: block.y + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0),
		}
	})
}

/**
 * Check if the target block has reached the exit
 */
export function isWin(blocks: Block[], exitX: number, exitY: number): boolean {
	const target = blocks.find((b) => b.isTarget)
	if (!target) return false
	return target.x === exitX && target.y === exitY
}
