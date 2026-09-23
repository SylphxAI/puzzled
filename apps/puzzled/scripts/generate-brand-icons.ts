#!/usr/bin/env bun
/**
 * Regenerates the raster brand icons from the SVG source of truth.
 *
 *   bun run scripts/generate-brand-icons.ts
 *
 * public/brand/mark.svg is parsed here (ground rect + four tiles) and
 * re-emitted per size with the icon-specific rounding and coverage, so a mark
 * change is picked up without editing this file. Tiles are emitted in absolute
 * coordinates: no transform wrapper, so every rasteriser agrees on the result.
 *
 * Rendering prefers rsvg-convert, then ImageMagick, then the headless Chromium
 * used originally - a wedged browser on a loaded host is the failure mode seen
 * in practice, so each renderer gets one attempt with a hard timeout instead of
 * a browser retry loop.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const PUBLIC_DIR = join(import.meta.dir, '..', 'public')
const MARK_PATH = join(PUBLIC_DIR, 'brand', 'mark.svg')
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium'
const CANVAS = 512
const RASTER_TIMEOUT_MS = 45_000

type Tile = {
	x: number
	y: number
	width: number
	height: number
	rx: number
	fill: string
	opacity?: number
}

type Mark = {
	ground: { rx: number; fill: string }
	tiles: Tile[]
}

type IconSpec = {
	/** Output paths relative to public/. */
	files: string[]
	size: number
	/** Tile corner radius as a fraction of the canvas. */
	radius: number
	/** Mark coverage as a fraction of the canvas (maskable icons stay inset). */
	coverage: number
	/** Opaque background edge-to-edge, as required by iOS home screen icons. */
	square?: boolean
}

const ICONS: IconSpec[] = [
	{ files: ['icons/favicon-16x16.png'], size: 16, radius: 0.1875, coverage: 0.68 },
	{
		files: ['favicon.png', 'icons/favicon-32x32.png'],
		size: 32,
		radius: 0.1875,
		coverage: 0.68,
	},
	{ files: ['icons/icon-48.png'], size: 48, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-72.png'], size: 72, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-96.png'], size: 96, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-128.png'], size: 128, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-144.png'], size: 144, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-152.png'], size: 152, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-192.png'], size: 192, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-384.png'], size: 384, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-512.png'], size: 512, radius: 0.1875, coverage: 0.68 },
	{ files: ['icons/icon-maskable-512.png'], size: 512, radius: 0.5, coverage: 0.56 },
	{
		files: ['apple-touch-icon.png', 'icons/apple-touch-icon.png'],
		size: 180,
		radius: 0,
		coverage: 0.7,
		square: true,
	},
]

/** Reads key="value" pairs off one mark.svg element line. */
function attributes(line: string): Record<string, string> {
	const found: Record<string, string> = {}
	for (const hit of line.matchAll(/([a-z-]+)="([^"]*)"/g)) {
		found[hit[1]] = hit[2]
	}
	return found
}

/** Parses the committed mark so the raster icons follow it, not a copy. */
export function readMark(path = MARK_PATH): Mark {
	const rects = readFileSync(path, 'utf8')
		.split('\n')
		.filter((line) => line.includes('<rect'))
		.map((line) => attributes(line))
	const ground = rects.find((rect) => rect.width === '512' && rect.height === '512')
	if (!ground) throw new Error(path + ': ground rect not found')
	const tiles: Tile[] = rects
		.filter((rect) => rect.x !== undefined)
		.map((rect) => ({
			x: Number(rect.x),
			y: Number(rect.y),
			width: Number(rect.width),
			height: Number(rect.height),
			rx: Number(rect.rx),
			fill: rect.fill,
			...(rect['fill-opacity'] ? { opacity: Number(rect['fill-opacity']) } : {}),
		}))
	if (tiles.length !== 4) {
		throw new Error(path + ': expected 4 tiles, found ' + tiles.length)
	}
	return { ground: { rx: Number(ground.rx), fill: ground.fill }, tiles }
}

/** Scales the mark to the icon canvas. Coordinates stay absolute. */
export function iconSvg(mark: Mark, { radius, coverage, square }: IconSpec): string {
	const minX = Math.min(...mark.tiles.map((tile) => tile.x))
	const minY = Math.min(...mark.tiles.map((tile) => tile.y))
	const maxX = Math.max(...mark.tiles.map((tile) => tile.x + tile.width))
	const maxY = Math.max(...mark.tiles.map((tile) => tile.y + tile.height))
	const extent = Math.max(maxX - minX, maxY - minY)
	const scale = (coverage * CANVAS) / extent
	const offsetX = CANVAS / 2 - ((minX + maxX) / 2) * scale
	const offsetY = CANVAS / 2 - ((minY + maxY) / 2) * scale
	const bgRx = square ? 0 : radius * CANVAS
	const tiles = mark.tiles.map((tile) => ({
		x: offsetX + tile.x * scale,
		y: offsetY + tile.y * scale,
		width: tile.width * scale,
		height: tile.height * scale,
		rx: tile.rx * scale,
		fill: tile.fill,
		opacity: tile.opacity,
	}))

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">
	  <rect width="${CANVAS}" height="${CANVAS}" rx="${bgRx.toFixed(1)}" fill="${mark.ground.fill}"/>
	${tiles
		.map(
			(tile) =>
				`  <rect x="${tile.x.toFixed(2)}" y="${tile.y.toFixed(2)}" width="${tile.width.toFixed(2)}" height="${tile.height.toFixed(2)}" rx="${tile.rx.toFixed(2)}" fill="${tile.fill}"${tile.opacity === undefined ? '' : ` fill-opacity="${tile.opacity}"`}/>`,
		)
		.join('\n')}
	</svg>
	`
}

function commandExists(binary: string): boolean {
	try {
		execFileSync('which', [binary], { stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}

function chromiumArgs(spec: IconSpec, svgPath: string, target: string): string[] {
	return [
		'--headless=new',
		'--disable-gpu',
		'--no-sandbox',
		'--hide-scrollbars',
		'--virtual-time-budget=2000',
		`--user-data-dir=${join(mkdtempSync(join(tmpdir(), 'puzzled-icon-')), 'profile')}`,
		`--window-size=${spec.size},${spec.size}`,
		`--screenshot=${target}`,
		`file://${svgPath}`,
	]
}

/**
 * Rasterises one icon SVG with the first renderer that works here.
 * rsvg-convert and ImageMagick are headless and fast; headless Chromium is
 * kept as the last resort and runs with a hard timeout so a wedged browser
 * cannot stall the build.
 */
function renderIcon(spec: IconSpec, svgPath: string, target: string): void {
	const renderers: Array<{ name: string; run: () => void }> = []
	if (commandExists('rsvg-convert')) {
		renderers.push({
			name: 'rsvg-convert',
			run: () =>
				execFileSync(
					'rsvg-convert',
					['-w', String(spec.size), '-h', String(spec.size), '-o', target, svgPath],
					{
						stdio: 'ignore',
						timeout: RASTER_TIMEOUT_MS,
					},
				),
		})
	}
	if (commandExists('convert')) {
		renderers.push({
			name: 'imagemagick',
			run: () =>
				execFileSync(
					'convert',
					[
						'-background',
						'none',
						'-density',
						'288',
						'-resize',
						`${spec.size}x${spec.size}`,
						svgPath,
						target,
					],
					{
						stdio: 'ignore',
						timeout: RASTER_TIMEOUT_MS,
					},
				),
		})
	}
	if (commandExists(CHROMIUM) && !process.env.SKIP_CHROMIUM_RASTER) {
		renderers.push({
			name: 'chromium',
			run: () =>
				execFileSync(CHROMIUM, chromiumArgs(spec, svgPath, target), {
					stdio: 'ignore',
					timeout: RASTER_TIMEOUT_MS,
				}),
		})
	}
	if (renderers.length === 0)
		throw new Error('No SVG rasteriser found: install rsvg-convert or ImageMagick')

	let lastError: unknown
	for (const renderer of renderers) {
		try {
			renderer.run()
			return
		} catch (error) {
			lastError = new Error(renderer.name + ': ' + String(error))
		}
	}
	throw new Error(`Failed to render ${target}: ${String(lastError)}`)
}

if (import.meta.main) {
	const mark = readMark()
	const workDir = mkdtempSync(join(tmpdir(), 'puzzled-icons-'))

	for (const spec of ICONS) {
		const svgPath = join(workDir, `${spec.files[0].replace(/\//g, '-')}.svg`)
		writeFileSync(svgPath, iconSvg(mark, spec))
		for (const file of spec.files) {
			const target = join(PUBLIC_DIR, file)
			mkdirSync(dirname(target), { recursive: true })
			renderIcon(spec, svgPath, target)
			console.log(`rendered public/${file} (${spec.size}px)`)
		}
	}

	console.log(`\nBrand icons written under ${PUBLIC_DIR} from public/brand/mark.svg`)
}
