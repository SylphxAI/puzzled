#!/usr/bin/env bun
/**
 * Regenerates the raster brand icons from the SVG source of truth.
 *
 *   bun run scripts/generate-brand-icons.ts
 *
 * public/brand/mark.svg is the app icon on a 64-unit canvas: an ink ground
 * and the glyph (the question-mark hook in paper, its dot an amber tile). Each
 * raster keeps the glyph and redraws only the ground: rounded for favicons and
 * PWA icons, square and opaque for the iOS home screen, and full-bleed with
 * the glyph inside the safe zone for maskable icons.
 *
 * Rendering uses the Playwright Chromium this repository already installs
 * (or CHROMIUM_PATH), so every size comes from the same renderer.
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PUBLIC_DIR = join(import.meta.dir, '..', 'public')
const MARK_PATH = join(PUBLIC_DIR, 'brand', 'mark.svg')

type IconSpec = {
	/** Output paths relative to public/. */
	files: string[]
	size: number
	/** Ground corner radius as a fraction of the canvas; 0 is square. */
	radius: number
	/** Glyph scale relative to the mark as drawn (maskable icons stay inset). */
	glyphScale: number
}

const ICONS: IconSpec[] = [
	{ files: ['icons/favicon-16x16.png'], size: 16, radius: 0.22, glyphScale: 1.08 },
	{ files: ['favicon.png', 'icons/favicon-32x32.png'], size: 32, radius: 0.22, glyphScale: 1.04 },
	...[48, 72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({
		files: [`icons/icon-${size}.png`],
		size,
		radius: 0.22,
		glyphScale: 1,
	})),
	{ files: ['icons/icon-maskable-512.png'], size: 512, radius: 0, glyphScale: 0.8 },
	{
		files: ['apple-touch-icon.png', 'icons/apple-touch-icon.png'],
		size: 180,
		radius: 0,
		glyphScale: 1,
	},
]

type Mark = { ground: string; glyph: string }

/** Splits the committed mark into its ground colour and its glyph markup. */
export function readMark(path = MARK_PATH): Mark {
	const svg = readFileSync(path, 'utf8')
	const ground = svg.match(/<rect width="64" height="64"[^>]*fill="([^"]+)"\/>/)
	if (!ground?.[1]) throw new Error(`${path}: ground rect not found`)
	const glyph = svg
		.replace(/^[\s\S]*?<rect width="64" height="64"[^>]*\/>/, '')
		.replace(/<\/svg>\s*$/, '')
	if (!glyph.includes('<path')) throw new Error(`${path}: glyph not found`)
	return { ground: ground[1], glyph }
}

export function iconSvg(mark: Mark, spec: IconSpec): string {
	const rx = (spec.radius * 64).toFixed(2)
	const s = spec.glyphScale
	const offset = (32 - 32 * s).toFixed(3)
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${spec.size}" height="${spec.size}"><rect width="64" height="64" rx="${rx}" fill="${mark.ground}"/><g transform="translate(${offset} ${offset}) scale(${s})">${mark.glyph}</g></svg>`
}

if (import.meta.main) {
	const { chromium } = await import('playwright')
	const browser = await chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--no-sandbox'],
	})
	const mark = readMark()
	try {
		for (const spec of ICONS) {
			const page = await browser.newPage({ viewport: { width: spec.size, height: spec.size } })
			await page.setContent(
				`<html><body style="margin:0;background:transparent">${iconSvg(mark, spec)}</body></html>`,
			)
			for (const file of spec.files) {
				const target = join(PUBLIC_DIR, file)
				mkdirSync(dirname(target), { recursive: true })
				await page.screenshot({ path: target, omitBackground: true })
				console.log(`rendered public/${file} (${spec.size}px)`)
			}
			await page.close()
		}
	} finally {
		await browser.close()
	}
	console.log(`\nBrand icons written under ${PUBLIC_DIR} from public/brand/mark.svg`)
}
