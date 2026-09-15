#!/usr/bin/env bun
/**
 * Regenerates the raster brand icons from one SVG source of truth.
 *
 * The mark is four rounded tiles with the last one softened (the piece you
 * are looking for). Run after any change to the mark:
 *
 *   bun run scripts/generate-brand-icons.ts
 *
 * Rasterisation uses the local headless Chromium so the committed PNGs stay
 * reproducible without adding an image library to the runtime dependencies.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const PUBLIC_DIR = join(import.meta.dir, '..', 'public')
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium'

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

function iconSvg({ size, radius, coverage, square }: IconSpec): string {
	const canvas = 512
	const tile = coverage * canvas * 0.5
	const gap = tile * 0.18
	const block = tile - gap / 2
	const origin = canvas / 2 - tile + gap / 4
	const rx = block * 0.28
	const bgRx = square ? 0 : radius * canvas
	const pieces = [
		{ x: origin, y: origin, soft: 1 },
		{ x: origin + tile, y: origin, soft: 1 },
		{ x: origin, y: origin + tile, soft: 1 },
		{ x: origin + tile, y: origin + tile, soft: 0.6 },
	]

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="52%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <rect width="${canvas}" height="${canvas}" rx="${bgRx}" fill="url(#brand)"/>
  <g>
${pieces
	.map(
		(p) =>
			`    <rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${block.toFixed(1)}" height="${block.toFixed(1)}" rx="${rx.toFixed(1)}" fill="#ffffff" fill-opacity="${p.soft}"/>`,
	)
	.join('\n')}
  </g>
</svg>
`
}

const workDir = mkdtempSync(join(tmpdir(), 'puzzled-icons-'))

for (const spec of ICONS) {
	const svgPath = join(workDir, `${spec.files[0].replace(/\//g, '-')}.svg`)
	writeFileSync(svgPath, iconSvg(spec))
	for (const file of spec.files) {
		const target = join(PUBLIC_DIR, file)
		mkdirSync(dirname(target), { recursive: true })
		renderIcon(spec, svgPath, target)
		console.log(`rendered public/${file} (${spec.size}px)`)
	}
}

/**
 * Chromium occasionally exits non-zero when several headless instances start
 * at once (shared profile contention), so give each render its own profile
 * directory and retry a couple of times before failing the build step.
 */
function renderIcon(spec: IconSpec, svgPath: string, target: string): void {
	const profileKey = `${spec.size}-${spec.coverage}-${target.split('/').pop()}`
	let lastError: unknown
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			execFileSync(
				CHROMIUM,
				[
					'--headless=new',
					'--disable-gpu',
					'--no-sandbox',
					'--hide-scrollbars',
					`--user-data-dir=${join(workDir, 'profile', `${profileKey}-${attempt}`)}`,
					`--window-size=${spec.size},${spec.size}`,
					`--screenshot=${target}`,
					`file://${svgPath}`,
				],
				{ stdio: 'ignore' },
			)
			return
		} catch (error) {
			lastError = error
		}
	}
	throw new Error(`Failed to render ${target}: ${String(lastError)}`)
}

console.log(`\nBrand icons written under ${PUBLIC_DIR}`)
