import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A miniature of each game's board, drawn on the game's colour field.
 *
 * Every motif is a crisp ink-and-paper object on a 160 x 100 canvas: tiles
 * stand on a solid ink key edge, the one amber piece is the move that clicks,
 * and nothing here is a real puzzle or a real answer. The field colour stays
 * in dark mode (printed colour), so the motif keeps fixed ink and paper.
 */

const INK = '#1a1712'
const PAPER = '#fbf9f4'
const AMBER = '#f4b42a'
const AMBER_SOFT = '#fbe0a1'
const GREEN = '#6bb57c'
const GREY = '#cfc9bc'
const EDGE = 2.5

type TileProps = {
	x: number
	y: number
	w: number
	h?: number
	r?: number
	fill?: string
	stroke?: number
	edge?: number
	children?: ReactNode
}

/** A tile on a solid ink key edge: the press-able unit of every motif. */
function Tile({
	x,
	y,
	w,
	h = w,
	r = 3,
	fill = PAPER,
	stroke = 1.6,
	edge = EDGE,
	children,
}: TileProps) {
	return (
		<g>
			{edge > 0 ? <rect x={x} y={y + edge} width={w} height={h} rx={r} fill={INK} /> : null}
			<rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={INK} strokeWidth={stroke} />
			{children}
		</g>
	)
}

function Glyph({
	x,
	y,
	size,
	children,
	fill = INK,
	weight = 800,
}: {
	x: number
	y: number
	size: number
	children: ReactNode
	fill?: string
	weight?: number
}) {
	return (
		<text
			x={x}
			y={y}
			fontSize={size}
			fontWeight={weight}
			fill={fill}
			textAnchor="middle"
			dominantBaseline="central"
		>
			{children}
		</text>
	)
}

/** A paper board with an ink frame and key edge, the tray tiles sit on. */
function Board({ x, y, w, h, r = 5 }: { x: number; y: number; w: number; h: number; r?: number }) {
	return (
		<g>
			<rect x={x} y={y + 3} width={w} height={h} rx={r} fill={INK} />
			<rect x={x} y={y} width={w} height={h} rx={r} fill={PAPER} stroke={INK} strokeWidth={2} />
		</g>
	)
}

function GridLines({
	x,
	y,
	cols,
	rows,
	s,
	color = INK,
	width = 0.8,
	opacity = 0.35,
}: {
	x: number
	y: number
	cols: number
	rows: number
	s: number
	color?: string
	width?: number
	opacity?: number
}) {
	const lines: ReactNode[] = []
	for (let c = 1; c < cols; c++) {
		lines.push(<line key={`c${c}`} x1={x + c * s} y1={y} x2={x + c * s} y2={y + rows * s} />)
	}
	for (let r = 1; r < rows; r++) {
		lines.push(<line key={`r${r}`} x1={x} y1={y + r * s} x2={x + cols * s} y2={y + r * s} />)
	}
	return (
		<g stroke={color} strokeWidth={width} opacity={opacity}>
			{lines}
		</g>
	)
}

const STATE_FILL = { g: GREEN, a: AMBER, x: GREY, e: PAPER } as const
type TileState = keyof typeof STATE_FILL

/** Five: two graded guesses and the row being typed. */
function FiveMotif() {
	const rows: [string, TileState[]][] = [
		['CRANE', ['x', 'a', 'x', 'x', 'g']],
		['STORE', ['x', 'g', 'a', 'g', 'g']],
		['', ['e', 'e', 'e', 'e', 'e']],
	]
	const s = 17
	const gap = 4
	const x0 = 29.5
	const y0 = 17
	return (
		<>
			{rows.map(([word, states], r) =>
				states.map((state, c) => {
					const x = x0 + c * (s + gap)
					const y = y0 + r * (s + gap + 1)
					return (
						<Tile key={`${r}-${c}`} x={x} y={y} w={s} fill={STATE_FILL[state]}>
							{word ? (
								<Glyph x={x + s / 2} y={y + s / 2 + 0.5} size={10}>
									{word[c]}
								</Glyph>
							) : null}
						</Tile>
					)
				}),
			)}
			<rect x={x0 + 6} y={y0 + 2 * (s + gap + 1) + 4} width={1.8} height={9} fill={INK} />
		</>
	)
}

/** Threads: one solved group, two words picked, the rest waiting. */
function ThreadsMotif() {
	const w = 27
	const h = 14
	const gap = 4
	const x0 = 20
	const y0 = 14
	const picked = new Set(['1-1', '2-3'])
	const bandW = 4 * w + 3 * gap
	return (
		<>
			<Tile x={x0} y={y0} w={bandW} h={h} fill={AMBER}>
				<rect x={x0 + bandW / 2 - 22} y={y0 + 4} width={44} height={2.6} rx={1.3} fill={INK} />
				<rect
					x={x0 + bandW / 2 - 30}
					y={y0 + 8.4}
					width={60}
					height={2}
					rx={1}
					fill={INK}
					opacity={0.45}
				/>
			</Tile>
			{[1, 2, 3].map((r) =>
				[0, 1, 2, 3].map((c) => {
					const x = x0 + c * (w + gap)
					const y = y0 + r * (h + gap + 1)
					const on = picked.has(`${r}-${c}`)
					const barW = 10 + ((r * 7 + c * 5) % 9)
					return (
						<Tile key={`${r}-${c}`} x={x} y={y} w={w} h={h} fill={on ? INK : PAPER}>
							<rect
								x={x + (w - barW) / 2}
								y={y + h / 2 - 1.4}
								width={barW}
								height={2.8}
								rx={1.4}
								fill={on ? PAPER : INK}
								opacity={on ? 1 : 0.7}
							/>
						</Tile>
					)
				}),
			)}
		</>
	)
}

function hexPoints(cx: number, cy: number, r: number): string {
	return Array.from({ length: 6 }, (_, i) => {
		const a = (Math.PI / 3) * i
		return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
	}).join(' ')
}

/** Hive: seven letters, the centre one amber. */
function HiveMotif() {
	const r = 14
	const d = Math.sqrt(3) * r + 1.5
	const cx = 80
	const cy = 49
	const letters = ['R', 'T', 'L', 'E', 'I', 'N']
	const cells = [
		{ x: cx, y: cy, letter: 'A', center: true },
		...letters.map((letter, i) => {
			const a = Math.PI / 6 + (Math.PI / 3) * i
			return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a), letter, center: false }
		}),
	]
	return (
		<>
			{cells.map((cell) => (
				<g key={cell.letter}>
					<polygon points={hexPoints(cell.x, cell.y + EDGE, r)} fill={INK} />
					<polygon
						points={hexPoints(cell.x, cell.y, r)}
						fill={cell.center ? AMBER : PAPER}
						stroke={INK}
						strokeWidth={1.6}
						strokeLinejoin="round"
					/>
					<Glyph x={cell.x} y={cell.y + 0.5} size={11}>
						{cell.letter}
					</Glyph>
				</g>
			))}
		</>
	)
}

/** Mini Grid: a 5x5 crossword with the active word lit. */
function MiniGridMotif() {
	const s = 13
	const x0 = 47.5
	const y0 = 16.5
	const black = new Set(['0-0', '4-4', '3-0'])
	const numbers: Record<string, string> = {
		'0-1': '1',
		'0-2': '2',
		'0-3': '3',
		'0-4': '4',
		'1-0': '5',
		'2-0': '6',
		'4-0': '7',
	}
	const word = ['B', 'R', 'A', 'V', 'O']
	return (
		<>
			<Board x={x0 - 1} y={y0 - 1} w={5 * s + 2} h={5 * s + 2} r={3} />
			{Array.from({ length: 5 }, (_, r) =>
				Array.from({ length: 5 }, (_, c) => {
					const key = `${r}-${c}`
					const x = x0 + c * s
					const y = y0 + r * s
					const fill = black.has(key)
						? INK
						: r === 2 && c === 2
							? AMBER
							: r === 2
								? AMBER_SOFT
								: 'none'
					return (
						<g key={key}>
							{fill !== 'none' ? <rect x={x} y={y} width={s} height={s} fill={fill} /> : null}
							{numbers[key] ? (
								<text x={x + 1.6} y={y + 4.6} fontSize={4.2} fontWeight={700} fill={INK}>
									{numbers[key]}
								</text>
							) : null}
							{r === 2 && c < 3 ? (
								<Glyph x={x + s / 2} y={y + s / 2 + 1} size={8}>
									{word[c]}
								</Glyph>
							) : null}
						</g>
					)
				}),
			)}
			<GridLines x={x0} y={y0} cols={5} rows={5} s={s} opacity={0.5} />
		</>
	)
}

/** Sudoku: one 3x3 box, a picked cell and a cell of pencil marks. */
function SudokuMotif() {
	const s = 21
	const x0 = 48.5
	const y0 = 16
	const digits: Record<string, string> = {
		'0-0': '5',
		'0-2': '3',
		'1-1': '7',
		'2-0': '2',
		'1-2': '9',
	}
	return (
		<>
			<Board x={x0} y={y0} w={3 * s} h={3 * s} r={3} />
			<rect x={x0 + 2 * s} y={y0 + s} width={s} height={s} fill={AMBER} />
			<GridLines x={x0} y={y0} cols={3} rows={3} s={s} opacity={0.6} width={1} />
			<rect
				x={x0}
				y={y0}
				width={3 * s}
				height={3 * s}
				rx={3}
				fill="none"
				stroke={INK}
				strokeWidth={2.4}
			/>
			{Object.entries(digits).map(([key, digit]) => {
				const [r, c] = key.split('-').map(Number) as [number, number]
				return (
					<Glyph key={key} x={x0 + c * s + s / 2} y={y0 + r * s + s / 2 + 1} size={12}>
						{digit}
					</Glyph>
				)
			})}
			{['1', '4', '6', '8'].map((digit, i) => (
				<text
					key={digit}
					x={x0 + 2 * s + 5 + (i % 2) * 10}
					y={y0 + 2 * s + 8 + Math.floor(i / 2) * 8}
					fontSize={5.5}
					fontWeight={700}
					fill={INK}
					opacity={0.75}
				>
					{digit}
				</text>
			))}
		</>
	)
}

/** Paint: a nonogram heart with its clues. */
function PaintMotif() {
	const s = 9
	const pattern = ['011011', '111111', '111111', '011110', '001100', '000000']
	const cols = ['2', '4', '5', '4', '4', '2']
	const rows = ['2 2', '6', '6', '4', '2', '0']
	const x0 = 63
	const y0 = 32
	return (
		<>
			<Board x={x0 - 18} y={y0 - 18} w={6 * s + 22} h={6 * s + 22} r={4} />
			{pattern.map((row, r) =>
				row
					.split('')
					.map((v, c) =>
						v === '1' ? (
							<rect
								key={`${r}-${c}`}
								x={x0 + c * s + 0.6}
								y={y0 + r * s + 0.6}
								width={s - 1.2}
								height={s - 1.2}
								rx={1.2}
								fill={r === 4 && c === 3 ? AMBER : INK}
							/>
						) : r === 5 && c % 2 === 0 ? (
							<path
								key={`${r}-${c}`}
								d={`M${x0 + c * s + 2.5} ${y0 + r * s + 2.5}l4 4m0 -4l-4 4`}
								stroke={INK}
								strokeWidth={1}
								opacity={0.5}
							/>
						) : null,
					),
			)}
			<GridLines x={x0} y={y0} cols={6} rows={6} s={s} opacity={0.3} />
			<rect x={x0} y={y0} width={6 * s} height={6 * s} fill="none" stroke={INK} strokeWidth={1.2} />
			{cols.map((clue, c) => (
				<Glyph key={`c${c}`} x={x0 + c * s + s / 2} y={y0 - 7} size={6} weight={700}>
					{clue}
				</Glyph>
			))}
			{rows.map((clue, r) => (
				<text
					key={`r${r}`}
					x={x0 - 3}
					y={y0 + r * s + s / 2 + 2}
					fontSize={6}
					fontWeight={700}
					fill={INK}
					textAnchor="end"
				>
					{clue}
				</text>
			))}
		</>
	)
}

/** Rungs: a word ladder, one changed letter per rung. */
function RungsMotif() {
	const words = ['COLD', 'CORD', 'WORD', 'WARD']
	const changed = [-1, 2, 0, 1]
	const s = 13
	const gap = 3
	const rowGap = 5
	const x0 = 49.5
	const y0 = 14
	const w = 4 * s + 3 * gap
	return (
		<>
			<g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
				<line x1={x0 - 8} y1={y0 - 4} x2={x0 - 8} y2={y0 + 4 * (s + rowGap) + 2} />
				<line x1={x0 + w + 8} y1={y0 - 4} x2={x0 + w + 8} y2={y0 + 4 * (s + rowGap) + 2} />
			</g>
			{words.map((word, r) =>
				word.split('').map((letter, c) => {
					const x = x0 + c * (s + gap)
					const y = y0 + r * (s + rowGap)
					return (
						<Tile
							key={`${r}-${c}`}
							x={x}
							y={y}
							w={s}
							edge={2}
							fill={changed[r] === c ? AMBER : PAPER}
						>
							<Glyph x={x + s / 2} y={y + s / 2 + 0.5} size={8}>
								{letter}
							</Glyph>
						</Tile>
					)
				}),
			)}
		</>
	)
}

/** Arithmo: an equation guess graded tile by tile. */
function ArithmoMotif() {
	const rows: [string, TileState[]][] = [
		['12+35=47', ['x', 'g', 'a', 'x', 'g', 'g', 'x', 'a']],
		['42-15=27', ['g', 'g', 'g', 'a', 'g', 'g', 'a', 'g']],
		['', ['e', 'e', 'e', 'e', 'e', 'e', 'e', 'e']],
	]
	const s = 12
	const gap = 2.6
	const x0 = 22.4
	const y0 = 22
	return (
		<>
			{rows.map(([eq, states], r) =>
				states.map((state, c) => {
					const x = x0 + c * (s + gap)
					const y = y0 + r * (s + 6)
					return (
						<Tile key={`${r}-${c}`} x={x} y={y} w={s} edge={2} r={2.5} fill={STATE_FILL[state]}>
							{eq ? (
								<Glyph x={x + s / 2} y={y + s / 2 + 0.5} size={8}>
									{eq[c]}
								</Glyph>
							) : null}
						</Tile>
					)
				}),
			)}
		</>
	)
}

type Shape = 'oval' | 'diamond' | 'bar'
function MatchShape({ shape, x, y, fill }: { shape: Shape; x: number; y: number; fill: string }) {
	const stroke = { stroke: INK, strokeWidth: 1 }
	if (shape === 'diamond')
		return (
			<polygon
				points={`${x},${y - 3.5} ${x + 2.6},${y} ${x},${y + 3.5} ${x - 2.6},${y}`}
				fill={fill}
				{...stroke}
			/>
		)
	if (shape === 'oval')
		return (
			<rect x={x - 2.4} y={y - 3.6} width={4.8} height={7.2} rx={2.4} fill={fill} {...stroke} />
		)
	return <rect x={x - 2.2} y={y - 3.4} width={4.4} height={6.8} rx={0.6} fill={fill} {...stroke} />
}

/** Match: twelve cards, a set of three lifted. */
function MatchMotif() {
	const w = 26
	const h = 17
	const gap = 4
	const x0 = 22
	const y0 = 19
	const shapes: Shape[] = ['oval', 'diamond', 'bar']
	const fills = [INK, PAPER, AMBER]
	const picked = new Set([1, 6, 11])
	return (
		<>
			{Array.from({ length: 12 }, (_, i) => {
				const r = Math.floor(i / 4)
				const c = i % 4
				const lift = picked.has(i) ? -2 : 0
				const x = x0 + c * (w + gap)
				const y = y0 + r * (h + gap) + lift
				const count = (i % 3) + 1
				const shape = shapes[(i * 2) % 3]!
				const fill = picked.has(i) ? AMBER : fills[(i + r) % 3]!
				return (
					<Tile
						key={i}
						x={x}
						y={y}
						w={w}
						h={h}
						edge={picked.has(i) ? 4 : 2}
						r={3}
						stroke={picked.has(i) ? 2 : 1.4}
					>
						{Array.from({ length: count }, (_, k) => (
							<MatchShape
								key={k}
								shape={shape}
								x={x + w / 2 + (k - (count - 1) / 2) * 6.5}
								y={y + h / 2}
								fill={fill}
							/>
						))}
					</Tile>
				)
			})}
		</>
	)
}

/** Slides: a sliding-block tray, the amber block heading for the exit. */
function SlidesMotif() {
	const s = 13
	const x0 = 46
	const y0 = 23
	const blocks: [number, number, number, number, string][] = [
		[0, 1, 2, 2, AMBER],
		[0, 0, 2, 1, PAPER],
		[2, 0, 1, 2, PAPER],
		[3, 0, 2, 1, PAPER],
		[3, 1, 1, 1, PAPER],
		[2, 2, 1, 2, PAPER],
		[0, 3, 2, 1, PAPER],
		[3, 3, 2, 1, PAPER],
	]
	const w = 5 * s
	const h = 4 * s
	return (
		<>
			<rect x={x0 - 4} y={y0 - 4 + 3} width={w + 8} height={h + 8} rx={5} fill={INK} />
			<rect
				x={x0 - 4}
				y={y0 - 4}
				width={w + 8}
				height={h + 8}
				rx={5}
				fill={GREY}
				stroke={INK}
				strokeWidth={2}
			/>
			<rect x={x0 + w + 2} y={y0 + s + 1} width={4} height={2 * s - 2} fill={PAPER} />
			{blocks.map(([c, r, bw, bh, fill]) => (
				<Tile
					key={`${c}-${r}`}
					x={x0 + c * s + 1}
					y={y0 + r * s + 1}
					w={bw * s - 2}
					h={bh * s - 2 - 1.5}
					r={2.5}
					edge={1.5}
					fill={fill}
					stroke={1.4}
				/>
			))}
			<path
				d={`M${x0 + w + 12} ${y0 + 2 * s - 5}l5 5l-5 5`}
				fill="none"
				stroke={INK}
				strokeWidth={2.2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</>
	)
}

function Crown({ x, y, s }: { x: number; y: number; s: number }) {
	const l = x + s * 0.2
	const r = x + s * 0.8
	const b = y + s * 0.74
	const t = y + s * 0.28
	return (
		<path
			d={`M${l} ${b}L${l} ${t}L${x + s * 0.35} ${y + s * 0.5}L${x + s / 2} ${t - 1}L${x + s * 0.65} ${y + s * 0.5}L${r} ${t}L${r} ${b}Z`}
			fill={INK}
			strokeLinejoin="round"
		/>
	)
}

/** Crowns: colour regions, three crowns placed. */
function CrownsMotif() {
	const s = 13
	const x0 = 47.5
	const y0 = 16.5
	const regions = ['00111', '02213', '02443', '02433', '22443']
	const colors = ['#f8c9a4', '#bfe3c6', '#f7e09a', '#b9dcf5', '#f5b8cc']
	const crowns = ['0-3', '1-0', '3-4']
	return (
		<>
			<Board x={x0 - 1} y={y0 - 1} w={5 * s + 2} h={5 * s + 2} r={3} />
			{regions.map((row, r) =>
				row
					.split('')
					.map((v, c) => (
						<rect
							key={`${r}-${c}`}
							x={x0 + c * s}
							y={y0 + r * s}
							width={s}
							height={s}
							fill={colors[Number(v)]}
						/>
					)),
			)}
			<GridLines x={x0} y={y0} cols={5} rows={5} s={s} opacity={0.45} />
			{crowns.map((key) => {
				const [r, c] = key.split('-').map(Number) as [number, number]
				return <Crown key={key} x={x0 + c * s} y={y0 + r * s} s={s} />
			})}
			<rect x={x0 + 2 * s} y={y0 + 2 * s} width={s} height={s} fill={AMBER} />
			<Crown x={x0 + 2 * s} y={y0 + 2 * s} s={s} />
			<path
				d={`M${x0 + 4 * s + 4} ${y0 + 4} l5 5 m0 -5 l-5 5`}
				stroke={INK}
				strokeWidth={1.2}
				opacity={0.6}
			/>
		</>
	)
}

function Sun({ x, y }: { x: number; y: number }) {
	return <circle cx={x} cy={y} r={4.4} fill={AMBER} stroke={INK} strokeWidth={1.3} />
}
function Moon({ x, y, bg }: { x: number; y: number; bg: string }) {
	return (
		<g>
			<circle cx={x} cy={y} r={4.4} fill={INK} />
			<circle cx={x + 2.4} cy={y - 1.8} r={3.6} fill={bg} />
		</g>
	)
}

/** Duo: suns and moons balancing a 4x4 grid. */
function DuoMotif() {
	const s = 15
	const x0 = 50
	const y0 = 18
	const grid = ['SMSM', 'MS.S', 'S.MM', '.MS.']
	return (
		<>
			<Board x={x0 - 1} y={y0 - 1} w={4 * s + 2} h={4 * s + 2} r={3} />
			<rect x={x0 + s} y={y0 + 2 * s} width={s} height={s} fill={AMBER_SOFT} />
			<GridLines x={x0} y={y0} cols={4} rows={4} s={s} opacity={0.4} />
			{grid.map((row, r) =>
				row.split('').map((v, c) => {
					const cx = x0 + c * s + s / 2
					const cy = y0 + r * s + s / 2
					const bg = r === 2 && c === 1 ? AMBER_SOFT : PAPER
					return v === 'S' ? (
						<Sun key={`${r}-${c}`} x={cx} y={cy} />
					) : v === 'M' ? (
						<Moon key={`${r}-${c}`} x={cx} y={cy} bg={bg} />
					) : null
				}),
			)}
			{(
				[
					[x0 + 3 * s, y0 + 3 * s + s / 2, '='],
					[x0 + 2 * s + s / 2, y0 + 2 * s, '×'],
				] as const
			).map(([x, y, mark]) => (
				<g key={mark}>
					<circle cx={x} cy={y} r={3.4} fill={PAPER} stroke={INK} strokeWidth={0.9} />
					<Glyph x={x} y={y + 0.3} size={5.5} weight={800}>
						{mark}
					</Glyph>
				</g>
			))}
		</>
	)
}

/** Frame: letters round a box, one amber word chain across it. */
function FrameMotif() {
	const x0 = 54
	const y0 = 22
	const side = 52
	const at = (i: number) => x0 + (side / 4) * (i + 1)
	const atY = (i: number) => y0 + (side / 4) * (i + 1)
	const nodes = [
		...[0, 1, 2].map((i) => ({ x: at(i), y: y0 })),
		...[0, 1, 2].map((i) => ({ x: x0 + side, y: atY(i) })),
		...[0, 1, 2].map((i) => ({ x: at(2 - i), y: y0 + side })),
		...[0, 1, 2].map((i) => ({ x: x0, y: atY(2 - i) })),
	]
	const chain = [0, 4, 8, 10, 2, 5]
	return (
		<>
			<rect x={x0} y={y0 + 3} width={side} height={side} rx={2} fill={INK} />
			<rect
				x={x0}
				y={y0}
				width={side}
				height={side}
				rx={2}
				fill={PAPER}
				stroke={INK}
				strokeWidth={2.2}
			/>
			<polyline
				points={chain.map((i) => `${nodes[i]!.x},${nodes[i]!.y}`).join(' ')}
				fill="none"
				stroke={AMBER}
				strokeWidth={3.2}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<polyline
				points={chain.map((i) => `${nodes[i]!.x},${nodes[i]!.y}`).join(' ')}
				fill="none"
				stroke={INK}
				strokeWidth={0.9}
				strokeLinejoin="round"
				opacity={0.6}
			/>
			{nodes.map((node, i) => (
				<circle
					key={i}
					cx={node.x}
					cy={node.y}
					r={3.6}
					fill={chain.includes(i) ? AMBER : PAPER}
					stroke={INK}
					strokeWidth={1.5}
				/>
			))}
		</>
	)
}

/** Quad: four boards played at once, every guess on all four. */
function QuadMotif() {
	const s = 7
	const gap = 1.6
	const bw = 5 * s + 4 * gap
	const bh = 3 * s + 2 * gap
	const boards: TileState[][][] = [
		[
			['x', 'a', 'x', 'g', 'x'],
			['g', 'g', 'x', 'g', 'a'],
			['e', 'e', 'e', 'e', 'e'],
		],
		[
			['a', 'x', 'x', 'x', 'g'],
			['x', 'a', 'g', 'x', 'g'],
			['e', 'e', 'e', 'e', 'e'],
		],
		[
			['x', 'x', 'g', 'x', 'x'],
			['g', 'g', 'g', 'g', 'g'],
			['e', 'e', 'e', 'e', 'e'],
		],
		[
			['g', 'x', 'a', 'x', 'x'],
			['g', 'a', 'x', 'a', 'x'],
			['e', 'e', 'e', 'e', 'e'],
		],
	]
	const x0 = 34
	const y0 = 18
	const pad = 4
	return (
		<>
			{boards.map((board, b) => {
				const bx = x0 + (b % 2) * (bw + 2 * pad + 8)
				const by = y0 + Math.floor(b / 2) * (bh + 2 * pad + 8)
				return (
					<g key={b}>
						<Board x={bx} y={by} w={bw + 2 * pad} h={bh + 2 * pad} r={3} />
						{board.map((row, r) =>
							row.map((state, c) => (
								<rect
									key={`${r}-${c}`}
									x={bx + pad + c * (s + gap)}
									y={by + pad + r * (s + gap)}
									width={s}
									height={s}
									rx={1.4}
									fill={STATE_FILL[state]}
									stroke={INK}
									strokeWidth={0.8}
								/>
							)),
						)}
					</g>
				)
			})}
		</>
	)
}

/** Cage Sudoku: dashed cages with their sums. */
function CageSudokuMotif() {
	const s = 21
	const x0 = 48.5
	const y0 = 16
	const cages: [number, number, number, number, string][] = [
		[0, 0, 2, 1, '11'],
		[2, 0, 1, 2, '9'],
		[0, 1, 1, 2, '7'],
		[1, 1, 1, 1, '5'],
		[1, 2, 2, 1, '13'],
	]
	return (
		<>
			<Board x={x0} y={y0} w={3 * s} h={3 * s} r={3} />
			<rect x={x0 + s} y={y0 + s} width={s} height={s} fill={AMBER} />
			<GridLines x={x0} y={y0} cols={3} rows={3} s={s} opacity={0.35} />
			{cages.map(([c, r, w, h, sum]) => (
				<g key={`${c}-${r}`}>
					<rect
						x={x0 + c * s + 2.5}
						y={y0 + r * s + 2.5}
						width={w * s - 5}
						height={h * s - 5}
						rx={2}
						fill="none"
						stroke={INK}
						strokeWidth={1}
						strokeDasharray="2.2 1.8"
					/>
					<text x={x0 + c * s + 4.5} y={y0 + r * s + 9} fontSize={5.5} fontWeight={800} fill={INK}>
						{sum}
					</text>
				</g>
			))}
			<Glyph x={x0 + s * 0.5} y={y0 + s * 2.5 + 2} size={11}>
				4
			</Glyph>
			<Glyph x={x0 + s * 2.5} y={y0 + s * 2.5 + 2} size={11}>
				9
			</Glyph>
			<rect
				x={x0}
				y={y0}
				width={3 * s}
				height={3 * s}
				rx={3}
				fill="none"
				stroke={INK}
				strokeWidth={2.4}
			/>
		</>
	)
}

/** Cipher: coded letters with their numbers, one being decoded. */
function CipherMotif() {
	const s = 11.5
	const gap = 2.5
	const codes: Record<string, string> = {
		T: '14',
		H: '3',
		E: '21',
		A: '9',
		R: '17',
		O: '6',
		F: '18',
		P: '2',
		L: '11',
		Y: '25',
	}
	const rows = ['THE ART', 'OF PLAY']
	const blank = new Set(['0-5', '1-4'])
	const active = '1-4'
	const y0 = 19
	return (
		<>
			{rows.map((text, r) => {
				const w = text.length * s + (text.length - 1) * gap
				const x0 = 80 - w / 2
				return text.split('').map((ch, c) => {
					if (ch === ' ') return null
					const key = `${r}-${c}`
					const x = x0 + c * (s + gap)
					const y = y0 + r * 32
					return (
						<g key={key}>
							<Tile x={x} y={y} w={s} edge={2} r={2.5} fill={key === active ? AMBER : PAPER}>
								{blank.has(key) ? null : (
									<Glyph x={x + s / 2} y={y + s / 2 + 0.5} size={8}>
										{ch}
									</Glyph>
								)}
							</Tile>
							<Glyph x={x + s / 2} y={y + s + 8} size={5.5} weight={700}>
								{codes[ch]}
							</Glyph>
						</g>
					)
				})
			})}
		</>
	)
}

/** Hunt: a letter grid with two words circled. */
function HuntMotif() {
	const s = 11.5
	const cols = 7
	const rows = 5
	const x0 = 80 - (cols * s) / 2
	const y0 = 21
	const letters = 'PLANETSKOROAMVITEDGEWRUNQSTALHCLOUDY'
	return (
		<>
			<Board x={x0 - 4} y={y0 - 4} w={cols * s + 8} h={rows * s + 8} r={4} />
			<rect
				x={x0 + 0.5}
				y={y0 + 0.8}
				width={6 * s - 1}
				height={s - 1.6}
				rx={(s - 1.6) / 2}
				fill={AMBER}
			/>
			<rect
				x={x0 + 6 * s + 0.8}
				y={y0 + s + 0.5}
				width={s - 1.6}
				height={4 * s - 1}
				rx={(s - 1.6) / 2}
				fill={GREEN}
			/>
			{Array.from({ length: rows * cols }, (_, i) => {
				const r = Math.floor(i / cols)
				const c = i % cols
				return (
					<Glyph key={i} x={x0 + c * s + s / 2} y={y0 + r * s + s / 2 + 0.5} size={7} weight={700}>
						{letters[i % letters.length]}
					</Glyph>
				)
			})}
		</>
	)
}

/** Path: one line through every cell, numbers in order. */
function PathMotif() {
	const s = 13
	const x0 = 47.5
	const y0 = 16.5
	const cells: [number, number][] = [
		[0, 0],
		[1, 0],
		[2, 0],
		[2, 1],
		[1, 1],
		[0, 1],
		[0, 2],
		[0, 3],
		[1, 3],
		[1, 2],
		[2, 2],
		[3, 2],
		[3, 1],
	]
	const center = ([c, r]: [number, number]) => `${x0 + c * s + s / 2},${y0 + r * s + s / 2}`
	const dots: [number, number, string, string][] = [
		[0, 0, '1', INK],
		[0, 3, '2', INK],
		[3, 1, '3', AMBER],
		[4, 4, '4', INK],
	]
	return (
		<>
			<Board x={x0 - 1} y={y0 - 1} w={5 * s + 2} h={5 * s + 2} r={3} />
			<GridLines x={x0} y={y0} cols={5} rows={5} s={s} opacity={0.3} />
			<polyline
				points={cells.map(center).join(' ')}
				fill="none"
				stroke={INK}
				strokeWidth={5}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{dots.map(([c, r, label, fill]) => (
				<g key={label}>
					<circle
						cx={x0 + c * s + s / 2}
						cy={y0 + r * s + s / 2}
						r={4.8}
						fill={fill}
						stroke={INK}
						strokeWidth={1.4}
					/>
					<Glyph
						x={x0 + c * s + s / 2}
						y={y0 + r * s + s / 2 + 0.4}
						size={6}
						fill={fill === AMBER ? INK : PAPER}
					>
						{label}
					</Glyph>
				</g>
			))}
		</>
	)
}

function Pips({ x, y, n }: { x: number; y: number; n: number }) {
	const at: Record<number, [number, number][]> = {
		0: [],
		1: [[0, 0]],
		2: [
			[-1, -1],
			[1, 1],
		],
		3: [
			[-1, -1],
			[0, 0],
			[1, 1],
		],
		4: [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		],
		5: [
			[-1, -1],
			[1, -1],
			[0, 0],
			[-1, 1],
			[1, 1],
		],
		6: [
			[-1, -1],
			[1, -1],
			[-1, 0],
			[1, 0],
			[-1, 1],
			[1, 1],
		],
	}
	return (
		<>
			{(at[n] ?? []).map(([dx, dy], i) => (
				<circle key={i} cx={x + dx * 3.2} cy={y + dy * 3.2} r={1.25} fill={INK} />
			))}
		</>
	)
}

/** Spots: dominoes placed into rule regions. */
function SpotsMotif() {
	const s = 13
	const x0 = 41
	const y0 = 22
	const dominoes: [number, number, boolean, number, number, string][] = [
		[0, 0, true, 3, 3, AMBER],
		[3, 0, false, 2, 5, PAPER],
		[4, 2, true, 6, 1, PAPER],
	]
	return (
		<>
			<Board x={x0 - 4} y={y0 - 4} w={6 * s + 8} h={4 * s + 8} r={4} />
			<rect
				x={x0}
				y={y0}
				width={2 * s}
				height={2 * s}
				rx={2}
				fill={AMBER_SOFT}
				stroke={INK}
				strokeWidth={1}
				strokeDasharray="2.2 1.8"
			/>
			<rect
				x={x0 + 2 * s}
				y={y0 + 2 * s}
				width={4 * s}
				height={2 * s}
				rx={2}
				fill="#cfe7d4"
				stroke={INK}
				strokeWidth={1}
				strokeDasharray="2.2 1.8"
			/>
			<GridLines x={x0} y={y0} cols={6} rows={4} s={s} opacity={0.2} />
			{dominoes.map(([c, r, horizontal, a, b, fill]) => {
				const x = x0 + c * s + 1
				const y = y0 + r * s + 1
				const w = (horizontal ? 2 * s : s) - 2
				const h = (horizontal ? s : 2 * s) - 2 - 1.5
				return (
					<Tile key={`${c}-${r}`} x={x} y={y} w={w} h={h} r={3} edge={1.5} fill={fill} stroke={1.4}>
						{horizontal ? (
							<line
								x1={x + w / 2}
								y1={y + 2}
								x2={x + w / 2}
								y2={y + h - 2}
								stroke={INK}
								strokeWidth={0.8}
							/>
						) : (
							<line
								x1={x + 2}
								y1={y + h / 2}
								x2={x + w - 2}
								y2={y + h / 2}
								stroke={INK}
								strokeWidth={0.8}
							/>
						)}
						<Pips
							x={horizontal ? x + w / 4 : x + w / 2}
							y={horizontal ? y + h / 2 : y + h / 4}
							n={a}
						/>
						<Pips
							x={horizontal ? x + (3 * w) / 4 : x + w / 2}
							y={horizontal ? y + h / 2 : y + (3 * h) / 4}
							n={b}
						/>
					</Tile>
				)
			})}
			<g>
				<rect x={x0 + 2 * s - 7} y={y0 - 9} width={14} height={9} rx={4.5} fill={INK} />
				<Glyph x={x0 + 2 * s} y={y0 - 4.3} size={6.5} fill={PAPER}>
					=
				</Glyph>
			</g>
			<g>
				<rect x={x0 + 6 * s - 10} y={y0 + 4 * s - 1} width={18} height={9} rx={4.5} fill={INK} />
				<Glyph x={x0 + 6 * s - 1} y={y0 + 4 * s + 3.6} size={6} fill={PAPER}>
					{'>6'}
				</Glyph>
			</g>
		</>
	)
}

const MOTIFS: Record<string, () => ReactNode> = {
	'word-guess': FiveMotif,
	'word-groups': ThreadsMotif,
	'word-hive': HiveMotif,
	crossword: MiniGridMotif,
	sudoku: SudokuMotif,
	nonogram: PaintMotif,
	'word-ladder': RungsMotif,
	arithmo: ArithmoMotif,
	'pattern-match': MatchMotif,
	'block-slide': SlidesMotif,
	crowns: CrownsMotif,
	duo: DuoMotif,
	'word-box': FrameMotif,
	'quad-words': QuadMotif,
	'killer-sudoku': CageSudokuMotif,
	cryptogram: CipherMotif,
	'word-search': HuntMotif,
	'number-path': PathMotif,
	'pip-place': SpotsMotif,
}

/** True when the game has a drawn miniature (every registered game should). */
export function hasGameMotif(slug: string): boolean {
	return slug in MOTIFS
}

/** Slugs with a drawn miniature, for the static files in public/motifs. */
export const MOTIF_SLUGS: readonly string[] = Object.keys(MOTIFS)

/** Font for standalone files, which cannot load the site's web font. */
const STANDALONE_FONT = "'Bricolage Grotesque', 'Arial Black', Arial, Helvetica, sans-serif"

type GameMotifProps = {
	slug: string
	className?: string
	/** Crop the canvas margin so the board fills a small field. */
	zoom?: boolean
	/** A self-contained file (public/motifs): xmlns and a system font stack. */
	standalone?: boolean
}

/** The game's miniature board; decorative, so hidden from assistive tech. */
export function GameMotif({ slug, className, zoom = false, standalone = false }: GameMotifProps) {
	const Motif = MOTIFS[slug]
	if (!Motif) return null
	const viewBox = zoom ? '14 8 132 84' : '0 0 160 100'
	if (standalone) {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={viewBox}
				width={zoom ? 132 : 160}
				height={zoom ? 84 : 100}
				fontFamily={STANDALONE_FONT}
				aria-hidden="true"
			>
				<Motif />
			</svg>
		)
	}
	return (
		<svg
			viewBox={viewBox}
			className={cn('block h-full w-full', className)}
			style={{ fontFamily: 'var(--font-display)' }}
			aria-hidden="true"
			focusable="false"
		>
			<Motif />
		</svg>
	)
}

/** Path of the static miniature file (generated by scripts/generate-motifs.tsx). */
export function motifSrc(slug: string, zoom = false): string {
	return `/motifs/${slug}${zoom ? '-zoom' : ''}.svg`
}

/**
 * The miniature as one cached image: dense grids (home, /games, the archive)
 * show many boards, and an image costs one DOM node where inline SVG costs
 * dozens. Large single boards keep the inline `GameMotif` and the site font.
 */
export function GameMotifImage({
	slug,
	zoom = false,
	className,
}: {
	slug: string
	zoom?: boolean
	className?: string
}) {
	if (!hasGameMotif(slug)) return null
	return (
		// biome-ignore lint/performance/noImgElement: a static decorative SVG; next/image adds nothing here
		<img
			src={motifSrc(slug, zoom)}
			alt=""
			aria-hidden="true"
			width={zoom ? 132 : 160}
			height={zoom ? 84 : 100}
			loading="lazy"
			decoding="async"
			className={cn('block h-full w-full object-contain', className)}
		/>
	)
}
