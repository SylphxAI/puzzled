/**
 * Block Slide Board Component
 *
 * Renders the game board with grid, exit, and all blocks.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Block as BlockType, Direction } from '../types'
import { Block } from './block'

// Default cell size for SSR (375px viewport - 32px padding = 343px / 6 grid = ~57px)
const DEFAULT_CELL_SIZE = 57

type Props = {
	blocks: BlockType[]
	gridWidth: number
	gridHeight: number
	exitX: number
	exitY: number
	selectedBlockId: string | null
	onBlockClick: (blockId: string) => void
	onBlockDrag: (blockId: string, direction: Direction) => void
	onMove: (direction: Direction) => void
}

export function Board({
	blocks,
	gridWidth,
	gridHeight,
	exitX,
	exitY: _exitY,
	selectedBlockId,
	onBlockClick,
	onBlockDrag,
	onMove,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null)

	// Calculate cell size based on viewport and grid size
	// Use static default for SSR, update on client to avoid hydration mismatch
	const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE)

	useEffect(() => {
		const calculateCellSize = () => {
			const viewportWidth = window.innerWidth
			const maxBoardWidth = Math.min(viewportWidth - 32, 400) // 32px for padding, max 400px
			const calculatedSize = Math.floor(maxBoardWidth / gridWidth)
			// Ensure cell size is reasonable (between 40 and 70 pixels)
			setCellSize(Math.max(40, Math.min(70, calculatedSize)))
		}

		calculateCellSize()
		window.addEventListener('resize', calculateCellSize)
		return () => window.removeEventListener('resize', calculateCellSize)
	}, [gridWidth])

	const boardWidth = gridWidth * cellSize
	const boardHeight = gridHeight * cellSize

	// Exit position (at bottom, centered on exit location)
	const exitLeft = exitX * cellSize
	const exitWidth = 2 * cellSize // Target block is 2 wide

	// Keyboard controls
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!selectedBlockId) return

			let direction: Direction | null = null
			switch (e.key) {
				case 'ArrowUp':
				case 'w':
				case 'W':
					direction = 'up'
					break
				case 'ArrowDown':
				case 's':
				case 'S':
					direction = 'down'
					break
				case 'ArrowLeft':
				case 'a':
				case 'A':
					direction = 'left'
					break
				case 'ArrowRight':
				case 'd':
				case 'D':
					direction = 'right'
					break
			}

			if (direction) {
				e.preventDefault()
				onMove(direction)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedBlockId, onMove])

	const handleBlockDrag = useCallback(
		(blockId: string) => (direction: Direction) => {
			onBlockDrag(blockId, direction)
		},
		[onBlockDrag],
	)

	return (
		<div className="flex flex-col items-center w-full" ref={containerRef}>
			{/* Board */}
			<div
				className="relative rounded-lg border-2 sm:border-4 border-slate-700 bg-slate-100 dark:border-slate-500 dark:bg-slate-800"
				style={{
					width: boardWidth,
					height: boardHeight,
				}}
			>
				{/* Grid lines */}
				<svg
					className="pointer-events-none absolute inset-0"
					width={boardWidth}
					height={boardHeight}
					aria-hidden="true"
				>
					{/* Vertical lines */}
					{Array.from({ length: gridWidth + 1 }, (_, i) => (
						<line
							key={`v-${i}`}
							x1={i * cellSize}
							y1={0}
							x2={i * cellSize}
							y2={boardHeight}
							stroke="currentColor"
							className="text-slate-300 dark:text-slate-600"
							strokeWidth={1}
						/>
					))}
					{/* Horizontal lines */}
					{Array.from({ length: gridHeight + 1 }, (_, i) => (
						<line
							key={`h-${i}`}
							x1={0}
							y1={i * cellSize}
							x2={boardWidth}
							y2={i * cellSize}
							stroke="currentColor"
							className="text-slate-300 dark:text-slate-600"
							strokeWidth={1}
						/>
					))}
				</svg>

				{/* Blocks */}
				{blocks.map((block) => (
					<Block
						key={block.id}
						block={block}
						cellSize={cellSize}
						isSelected={selectedBlockId === block.id}
						onClick={() => onBlockClick(block.id)}
						onDrag={handleBlockDrag(block.id)}
					/>
				))}
			</div>

			{/* Exit indicator */}
			<div
				className="mt-1 flex items-center justify-center rounded-b-lg bg-green-500 text-white text-[10px] sm:text-xs font-bold"
				style={{
					width: Math.max(exitWidth - 4, 40),
					height: cellSize > 50 ? 24 : 20,
					marginLeft: exitLeft - (boardWidth - exitWidth) / 2 + 2,
				}}
			>
				EXIT
			</div>
		</div>
	)
}
