/**
 * Spots Game Component
 * Place a complete double-n set so every region constraint holds.
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { HelpCircle, Play, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { formatRitualShareText } from '@/features/daily/lib/share-text'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { cn, getBaseUrl } from '@/lib/utils'
import { PipPlaceIcon } from './icon'
import { parsePipPlaceClientPayload } from './parse-client'
import type { Cell, PipPlaceRegion, PipPlaceTile } from './types'
import { cellKey, cellsEqual } from './types'
import { usePipPlace } from './use-pip-place'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

const REGION_COLORS = [
	'bg-orange-300/70 dark:bg-orange-500/40',
	'bg-sky-300/70 dark:bg-sky-500/40',
	'bg-lime-300/70 dark:bg-lime-500/40',
	'bg-violet-300/70 dark:bg-violet-500/40',
	'bg-amber-300/70 dark:bg-amber-500/40',
	'bg-rose-300/70 dark:bg-rose-500/40',
	'bg-teal-300/70 dark:bg-teal-500/40',
	'bg-fuchsia-300/70 dark:bg-fuchsia-500/40',
]

const PIP_PATTERN: Record<number, Array<[number, number]>> = {
	0: [],
	1: [[1, 1]],
	2: [
		[0, 0],
		[2, 2],
	],
	3: [
		[0, 0],
		[1, 1],
		[2, 2],
	],
	4: [
		[0, 0],
		[0, 2],
		[2, 0],
		[2, 2],
	],
	5: [
		[0, 0],
		[0, 2],
		[1, 1],
		[2, 0],
		[2, 2],
	],
	6: [
		[0, 0],
		[0, 1],
		[0, 2],
		[2, 0],
		[2, 1],
		[2, 2],
	],
}

function PipFace({ value, compact = false }: { value: number; compact?: boolean }) {
	const dots = PIP_PATTERN[value] ?? PIP_PATTERN[Math.min(6, Math.max(0, value))] ?? []
	const lit = new Set(dots.map(([row, col]) => `${row},${col}`))
	return (
		<div
			className={cn(
				'grid grid-cols-3 grid-rows-3 place-items-center',
				compact ? 'h-7 w-7 p-0.5' : 'h-9 w-9 p-1',
			)}
			aria-hidden="true"
		>
			{Array.from({ length: 9 }, (_, index) => {
				const row = Math.floor(index / 3)
				const col = index % 3
				return (
					<span
						key={`${row}-${col}`}
						className={cn(
							'rounded-full bg-foreground',
							compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
							lit.has(`${row},${col}`) ? 'opacity-90' : 'opacity-0',
						)}
					/>
				)
			})}
		</div>
	)
}

function regionBadge(region: PipPlaceRegion): string | null {
	switch (region.kind) {
		case 'sum':
			return region.value === null ? null : String(region.value)
		case 'equal':
			return region.value === null ? '=' : `=${region.value}`
		case 'unequal':
			return '≠'
		case 'free':
			return null
		default:
			return null
	}
}

function tileSpanStyle(tile: PipPlaceTile): CSSProperties {
	const rowStart = Math.min(tile.a.row, tile.b.row) + 1
	const colStart = Math.min(tile.a.col, tile.b.col) + 1
	const rowSpan = tile.a.row === tile.b.row ? 1 : 2
	const colSpan = tile.a.col === tile.b.col ? 1 : 2
	return {
		gridRow: `${rowStart} / span ${rowSpan}`,
		gridColumn: `${colStart} / span ${colSpan}`,
	}
}

function pipAt(placed: PipPlaceTile[], cell: Cell): number | null {
	for (const tile of placed) {
		if (cellsEqual(tile.a, cell)) return tile.pa
		if (cellsEqual(tile.b, cell)) return tile.pb
	}
	return null
}

export function PipPlaceGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.pipPlace')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => parsePipPlaceClientPayload(puzzleData))

	const {
		isReady,
		startGame,
		endGame,
		startTime,
		showCelebration,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: 'pip-place',
		mode,
		puzzleId,
		enableStarBurst: false,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	const game = usePipPlace(puzzle)
	const gameEndedRef = useRef(false)
	const { rows, cols, regionOf, regions } = puzzle
	const playing = game.state.gameStatus === 'playing'

	useEffect(() => {
		if (game.state.gameStatus === 'won' && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: 1,
				data: {
					tiles: game.state.placed,
				},
			})
		}
	}, [game.state.gameStatus, game.state.placed, endGame])

	const regionById = useMemo(() => {
		const map = new Map<number, PipPlaceRegion>()
		for (const region of regions) map.set(region.id, region)
		return map
	}, [regions])

	const labelCell = useMemo(() => {
		const first = new Map<number, Cell>()
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const id = regionOf[row]?.[col]
				if (id === undefined || first.has(id)) continue
				first.set(id, { row, col })
			}
		}
		return first
	}, [regionOf, rows, cols])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const text = formatRitualShareText({
			origin: getBaseUrl('origin'),
			gameSlug: 'pip-place',
			gameName: 'Spots',
			status: 'won',
			statLine: `⏱️ ${formatTimer(timeMs)}`,
		})
		void navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime])

	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-orange-500">
						<PipPlaceIcon size={40} />
					</div>
					<CardTitle>{t('name')}</CardTitle>
					<p className="text-sm text-muted-foreground">{t('description')}</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted/50 p-4">
						<h3 className="mb-2 flex items-center gap-2 font-medium">
							<HelpCircle className="h-4 w-4" />
							{t('rules.title')}
						</h3>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>• {t('rules.rule1')}</li>
							<li>• {t('rules.rule2')}</li>
							<li>• {t('rules.rule3')}</li>
						</ul>
					</div>

					<Button onClick={startGame} className="w-full" size="lg">
						<Play className="mr-2 h-4 w-4" />
						{tCommon('play')}
					</Button>
				</CardContent>
			</Card>
		)
	}

	const selectedFace =
		game.state.selectedTrayIndex !== null ? game.state.tray[game.state.selectedTrayIndex] : null

	return (
		<div className="relative flex w-full flex-col items-center">
			<Celebration show={showCelebration} />

			<div className="flex w-full max-w-md flex-col items-center gap-4">
				<div className="flex w-full items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">{t('name')}</div>
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={game.rotate}
							disabled={!playing || game.state.selectedTrayIndex === null}
							aria-label="Rotate"
						>
							<RotateCw className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={game.undo}
							disabled={!playing || !game.canUndo}
							aria-label="Undo"
						>
							<Undo2 className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={game.reset}
							disabled={!playing}
							aria-label="Reset"
						>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowHelpModal(true)}
							disabled={!playing}
							aria-label="Help"
						>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div
					className="relative w-full max-w-sm select-none overflow-hidden rounded-lg border-2 border-border bg-background p-1"
					style={{ aspectRatio: `${cols} / ${rows}` }}
				>
					<div
						className="relative grid h-full w-full gap-0.5"
						style={{
							gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
							gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
						}}
					>
						{Array.from({ length: rows }, (_, row) =>
							Array.from({ length: cols }, (_, col) => {
								const cell = { row, col }
								const regionId = regionOf[row]?.[col] ?? 0
								const region = regionById.get(regionId)
								const label = labelCell.get(regionId)
								const showBadge =
									label !== undefined && cellsEqual(label, cell) && region
										? regionBadge(region)
										: null
								const placedPip = pipAt(game.state.placed, cell)
								const pendingHere =
									game.state.pending !== null && cellsEqual(game.state.pending, cell)
								const ghost = pendingHere ? (selectedFace?.pa ?? null) : null
								const shown = placedPip ?? ghost

								return (
									<button
										key={cellKey(cell)}
										type="button"
										disabled={!playing}
										onClick={() => game.touchCell(cell)}
										aria-label={`cell ${row + 1},${col + 1}`}
										className={cn(
											'relative flex items-center justify-center rounded-sm border border-border/70',
											REGION_COLORS[regionId % REGION_COLORS.length],
											pendingHere && 'ring-2 ring-orange-500 ring-offset-1',
											!playing && 'pointer-events-none',
										)}
									>
										{showBadge !== null && (
											<span className="absolute left-0.5 top-0.5 rounded bg-background/85 px-0.5 text-[9px] font-bold leading-tight">
												{showBadge}
											</span>
										)}
										{shown !== null && <PipFace value={shown} />}
									</button>
								)
							}),
						)}

						{game.state.placed.map((tile, index) => (
							<div
								key={`tile-${index}-${cellKey(tile.a)}-${cellKey(tile.b)}`}
								className="pointer-events-none z-10 rounded-md ring-2 ring-foreground/35"
								style={tileSpanStyle(tile)}
							/>
						))}
					</div>
				</div>

				<div className="flex w-full flex-wrap justify-center gap-2 px-2">
					{game.state.tray.map((face, index) => {
						const selected = game.state.selectedTrayIndex === index
						return (
							<button
								key={`tray-${index}-${face.pa}-${face.pb}`}
								type="button"
								disabled={!playing}
								onClick={() => game.selectTray(index)}
								aria-label={`tile ${face.pa}-${face.pb}`}
								aria-pressed={selected}
								className={cn(
									'flex items-center rounded-md border bg-background shadow-sm',
									selected && 'ring-2 ring-orange-500 ring-offset-1',
									!playing && 'pointer-events-none opacity-60',
								)}
							>
								<PipFace value={face.pa} compact />
								<div className="h-6 w-px bg-border" />
								<PipFace value={face.pb} compact />
							</button>
						)
					})}
				</div>
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="pip-place"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="pip-place"
				status={game.state.gameStatus === 'won' ? 'won' : 'lost'}
				stats={{
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>
		</div>
	)
}
