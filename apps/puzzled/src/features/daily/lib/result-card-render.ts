/**
 * Result-card canvas renderer (S3 slice 2 - register row G3).
 *
 * Paints the non-spoiler card described by the model in result-card.ts onto a
 * 1080x1080 canvas: one common chrome for every module (wordmark, day, module
 * name, status, chips, pattern, deep link), with the module's existing theme
 * (src/games/theme-colors.ts) supplying the palette. Only data the model
 * carries can reach the pixels - the solution never has a path here.
 *
 * The renderer is deliberately split:
 * - paintResultCard(ctx, ...) is synchronous and testable against a recording
 *   context (no DOM);
 * - resultCardBlob(...) is the only DOM-touching function; it paints and
 *   encodes PNG.
 * Both are pure with respect to the model: no clocks, no randomness, no reads
 * outside the model, so the same run always renders the same bytes.
 */
import type { GameColorTheme } from '@/games/theme-colors'
import { type ResultCardModel, type ResultCardStrings, resultCardChips } from './result-card'

export const RESULT_CARD_SIZE = 1080

const FONT_FAMILY =
	"'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans TC', 'Noto Sans SC', sans-serif"

/** Fixed chrome geometry at RESULT_CARD_SIZE; scaled for other sizes. */
const FRAME = { x: 40, y: 40, w: 1000, h: 1000, r: 64 }
const PAD = 124

export interface ResultCardPalette {
	bg: string
	bgWash: string
	glow: string
	frame: string
	accent: string
	accentSoft: string
	chipBg: string
	chipStroke: string
	text: string
	textMuted: string
	tileNear: string
	tileMiss: string
}

/**
 * The theme's 500-weight colour, cross-checked against the rgba() triple the
 * theme already embeds in its Tailwind pattern (see result-card-render.test.ts),
 * so the card palette cannot drift from the module theme silently.
 */
function cardPalette(accent: string, rgb: string): ResultCardPalette {
	return {
		bg: '#0a0f1c',
		bgWash: 'rgba(' + rgb + ', 0.08)',
		glow: 'rgba(' + rgb + ', 0.30)',
		frame: 'rgba(255,255,255,0.10)',
		accent,
		accentSoft: 'rgba(' + rgb + ', 0.55)',
		chipBg: 'rgba(255,255,255,0.06)',
		chipStroke: 'rgba(255,255,255,0.14)',
		text: '#f8fafc',
		textMuted: '#94a3b8',
		tileNear: '#fbbf24',
		tileMiss: 'rgba(255,255,255,0.10)',
	}
}

const THEME_PALETTES: Record<GameColorTheme, ResultCardPalette> = {
	emerald: cardPalette('#10b981', '16,185,129'),
	cyan: cardPalette('#06b6d4', '6,182,212'),
	violet: cardPalette('#8b5cf6', '139,92,246'),
	amber: cardPalette('#f59e0b', '245,158,11'),
	pink: cardPalette('#ec4899', '236,72,153'),
	rose: cardPalette('#f43f5e', '244,63,94'),
	blue: cardPalette('#3b82f6', '59,130,246'),
	sky: cardPalette('#0ea5e9', '14,165,233'),
	orange: cardPalette('#f97316', '249,115,22'),
	lime: cardPalette('#84cc16', '132,204,22'),
	slate: cardPalette('#64748b', '100,116,139'),
}

export function resultCardPalette(theme: GameColorTheme): ResultCardPalette {
	return THEME_PALETTES[theme]
}

type Ctx = CanvasRenderingContext2D

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
	const radius = Math.max(0, Math.min(r, w / 2, h / 2))
	ctx.beginPath()
	ctx.moveTo(x + radius, y)
	ctx.lineTo(x + w - radius, y)
	ctx.arcTo(x + w, y, x + w, y + radius, radius)
	ctx.lineTo(x + w, y + h - radius)
	ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
	ctx.lineTo(x + radius, y + h)
	ctx.arcTo(x, y + h, x, y + h - radius, radius)
	ctx.lineTo(x, y + radius)
	ctx.arcTo(x, y, x + radius, y, radius)
	ctx.closePath()
}

/** Draw text one glyph at a time so the wordmark can carry tracking. */
function trackedText(ctx: Ctx, text: string, x: number, y: number, tracking: number): void {
	let cursor = x
	for (const glyph of text) {
		ctx.fillText(glyph, cursor, y)
		cursor += ctx.measureText(glyph).width + tracking
	}
}

/** Largest whole size in [minPx, startPx] whose rendered text fits maxWidth. */
function fitTextSize(
	ctx: Ctx,
	text: string,
	maxWidth: number,
	startPx: number,
	minPx: number,
	weight: string,
): number {
	let px = Math.round(startPx)
	const floor = Math.round(minPx)
	while (px > floor) {
		ctx.font = weight + ' ' + px + 'px ' + FONT_FAMILY
		if (ctx.measureText(text).width <= maxWidth) return px
		px -= 2
	}
	return floor
}

export interface ResultCardPaintOptions {
	size?: number
}

/**
 * Paint one card. Synchronous, DOM-free, deterministic: the same model and
 * strings always paint the same calls.
 */
export function paintResultCard(
	ctx: Ctx,
	model: ResultCardModel,
	strings: ResultCardStrings,
	options: ResultCardPaintOptions = {},
): void {
	const size = options.size ?? RESULT_CARD_SIZE
	const scale = size / RESULT_CARD_SIZE
	const palette = resultCardPalette(model.theme)

	ctx.save()

	// Background: deep ink, a theme-coloured wash, and one glow behind the header.
	ctx.fillStyle = palette.bg
	ctx.fillRect(0, 0, size, size)
	ctx.fillStyle = palette.bgWash
	ctx.fillRect(0, 0, size, size)
	const glow = ctx.createRadialGradient(
		size * 0.82,
		size * 0.1,
		40 * scale,
		size * 0.82,
		size * 0.1,
		size * 0.9,
	)
	glow.addColorStop(0, palette.glow)
	glow.addColorStop(1, 'rgba(0,0,0,0)')
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, size, size)

	// The common chrome: one frame, whatever the module.
	roundedRect(
		ctx,
		FRAME.x * scale,
		FRAME.y * scale,
		FRAME.w * scale,
		FRAME.h * scale,
		FRAME.r * scale,
	)
	ctx.fillStyle = palette.bgWash
	ctx.fill()
	ctx.strokeStyle = palette.frame
	ctx.lineWidth = 2 * scale
	ctx.stroke()

	const innerX = PAD * scale
	const innerW = (RESULT_CARD_SIZE - PAD * 2) * scale
	ctx.textBaseline = 'alphabetic'
	ctx.textAlign = 'left'

	// Header: wordmark left, product day right (when the run has one).
	ctx.fillStyle = palette.text
	ctx.font = '700 ' + Math.round(36 * scale) + 'px ' + FONT_FAMILY
	trackedText(ctx, 'PUZZLED', innerX, 168 * scale, 8 * scale)
	if (model.dayDisplay) {
		ctx.textAlign = 'right'
		ctx.fillStyle = palette.textMuted
		ctx.font = '500 ' + Math.round(34 * scale) + 'px ' + FONT_FAMILY
		ctx.fillText(model.dayDisplay, innerX + innerW, 168 * scale)
		ctx.textAlign = 'left'
	}

	// The module's name is the biggest thing on the card.
	const titleSize = fitTextSize(ctx, model.gameName, innerW, 96 * scale, 54 * scale, '800')
	ctx.font = '800 ' + titleSize + 'px ' + FONT_FAMILY
	ctx.fillStyle = palette.text
	ctx.fillText(model.gameName, innerX, 336 * scale)

	// Status in the theme accent.
	ctx.font = '700 ' + Math.round(46 * scale) + 'px ' + FONT_FAMILY
	ctx.fillStyle = palette.accent
	ctx.fillText(model.status === 'won' ? strings.statusWon : strings.statusLost, innerX, 418 * scale)

	ctx.strokeStyle = palette.accentSoft
	ctx.lineWidth = 3 * scale
	ctx.beginPath()
	ctx.moveTo(innerX, 472 * scale)
	ctx.lineTo(innerX + innerW, 472 * scale)
	ctx.stroke()

	// Chips: up to four glanceable facts.
	const chips = resultCardChips(model, strings)
	if (chips.length > 0) {
		const gap = 24 * scale
		const chipY = 524 * scale
		const chipH = 148 * scale
		const chipW = (innerW - gap * (chips.length - 1)) / chips.length
		for (let i = 0; i < chips.length; i += 1) {
			const chip = chips[i]
			if (!chip) continue
			const x = innerX + i * (chipW + gap)
			roundedRect(ctx, x, chipY, chipW, chipH, 28 * scale)
			ctx.fillStyle = palette.chipBg
			ctx.fill()
			ctx.strokeStyle = palette.chipStroke
			ctx.lineWidth = 2 * scale
			ctx.stroke()

			ctx.textAlign = 'center'
			ctx.fillStyle = palette.textMuted
			ctx.font = '600 ' + Math.round(30 * scale) + 'px ' + FONT_FAMILY
			ctx.fillText(chip.label, x + chipW / 2, chipY + 58 * scale)
			const valueSize = fitTextSize(
				ctx,
				chip.value,
				chipW - 48 * scale,
				58 * scale,
				30 * scale,
				'800',
			)
			ctx.fillStyle = palette.text
			ctx.font = '800 ' + valueSize + 'px ' + FONT_FAMILY
			ctx.fillText(chip.value, x + chipW / 2, chipY + 120 * scale)
			ctx.textAlign = 'left'
		}
	}

	// Pattern: hit / near / miss tiles, capped by the model (12x12).
	if (model.pattern) {
		const rows = model.pattern.length
		let cols = 0
		for (const row of model.pattern) cols = Math.max(cols, row.length)
		const gap = 14 * scale
		const bandTop = (chips.length > 0 ? 716 : 520) * scale
		const bandBottom = 952 * scale
		const availH = bandBottom - bandTop
		const availW = Math.min(innerW, 720 * scale)
		const tile = Math.max(
			10,
			Math.min(96 * scale, (availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows),
		)
		const gridW = tile * cols + gap * (cols - 1)
		const gridH = tile * rows + gap * (rows - 1)
		const startX = innerX + (innerW - gridW) / 2
		const startY = bandTop + (availH - gridH) / 2
		for (let r = 0; r < rows; r += 1) {
			const row = model.pattern[r]
			if (!row) continue
			for (let c = 0; c < row.length; c += 1) {
				const value = row[c]
				roundedRect(
					ctx,
					startX + c * (tile + gap),
					startY + r * (tile + gap),
					tile,
					tile,
					tile * 0.22,
				)
				ctx.fillStyle =
					value === 'hit' ? palette.accent : value === 'near' ? palette.tileNear : palette.tileMiss
				ctx.fill()
			}
		}
	}

	// Footer: the dated deep link, the one string that must survive a re-share.
	ctx.textAlign = 'center'
	ctx.fillStyle = palette.textMuted
	ctx.font = '500 ' + Math.round(32 * scale) + 'px ' + FONT_FAMILY
	ctx.fillText(model.deepLink, innerX + innerW / 2, 984 * scale)
	ctx.textAlign = 'left'

	ctx.restore()
}

/**
 * Paint and encode. Returns null when there is no DOM (server render, tests) -
 * callers fall back to the text share in that case.
 */
export async function resultCardBlob(
	model: ResultCardModel,
	strings: ResultCardStrings,
	options: ResultCardPaintOptions = {},
): Promise<Blob | null> {
	if (typeof document === 'undefined') return null
	const size = options.size ?? RESULT_CARD_SIZE
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) return null
	paintResultCard(ctx, model, strings, { size })
	return await new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), 'image/png')
	})
}

/** Download/attachment name: puzzled-result-<slug>[-<day>].png */
export function resultCardFileName(model: ResultCardModel): string {
	const slug =
		model.gameSlug
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'puzzled'
	return model.dayKey
		? 'puzzled-result-' + slug + '-' + model.dayKey + '.png'
		: 'puzzled-result-' + slug + '.png'
}
