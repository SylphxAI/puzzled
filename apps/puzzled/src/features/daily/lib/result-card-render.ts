/**
 * Result-card canvas renderer (S3 slice 2 - register row G3).
 *
 * Paints the non-spoiler card described by the model in result-card.ts onto a
 * 1080x1080 canvas: one common layout for every module (wordmark, day, module
 * name, status, chips, pattern, deep link) on paper, with the module's theme
 * (src/games/theme-colors.ts) supplying the band colour and the solved-tile hue. Only data the model
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
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { type ResultCardModel, type ResultCardStrings, resultCardChips } from './result-card'

export const RESULT_CARD_SIZE = 1080

/*
 * The site's display face. On the page it is the self-hosted Fraunces
 * (`--font-display-family`, set by next/font); resultCardBlob passes the
 * resolved family in, and the serif stack stands in when it is absent.
 */
const DISPLAY_FALLBACK = "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Noto Serif TC', serif"

const FONT_FAMILY =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'PingFang TC', 'Noto Sans TC', 'Noto Sans SC', sans-serif"

const PAD = 96
/** The pastel band that carries the module's colour. */
const BAND_H = 468

export interface ResultCardPalette {
	/** Paper ground. */
	bg: string
	/** The module's field colour (the band). */
	accent: string
	/** Hairlines and chip borders. */
	frame: string
	chipBg: string
	chipStroke: string
	text: string
	textMuted: string
	/** A solved tile: the module's deep hue. */
	tileHit: string
	tileNear: string
	tileMiss: string
}

function cardPalette(theme: GameColorTheme): ResultCardPalette {
	const colors = getGameColors(theme)
	return {
		bg: '#f7f4ee',
		accent: colors.hex,
		frame: 'rgba(26,23,18,0.12)',
		chipBg: '#ffffff',
		chipStroke: '#e4ded2',
		text: '#1a1712',
		textMuted: 'rgba(26,23,18,0.62)',
		tileHit: colors.deepHex,
		tileNear: '#f4b42a',
		tileMiss: '#e4ded2',
	}
}

/** The palette follows the module theme in theme-colors.ts; nothing is copied. */
export function resultCardPalette(theme: GameColorTheme): ResultCardPalette {
	return cardPalette(theme)
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
		ctx.font = `${weight} ${px}px ${FONT_FAMILY}`
		if (ctx.measureText(text).width <= maxWidth) return px
		px -= 2
	}
	return floor
}

export interface ResultCardPaintOptions {
	size?: number
	/** Resolved display family (the page's Fraunces); falls back to a serif stack. */
	displayFamily?: string
}

/**
 * Paint one card. Synchronous, DOM-free, deterministic: the same model and
 * strings always paint the same calls.
 *
 * Layout: paper ground; a pastel band in the module's colour with the
 * wordmark, the day, the module name and the result; up to four fact chips;
 * the non-spoiler pattern; the dated link.
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
	const display = options.displayFamily
		? `${options.displayFamily}, ${DISPLAY_FALLBACK}`
		: DISPLAY_FALLBACK

	ctx.save()

	ctx.fillStyle = palette.bg
	ctx.fillRect(0, 0, size, size)

	// The band: the module's own colour, rounded at the bottom like a card lip.
	roundedRect(ctx, 32 * scale, 32 * scale, size - 64 * scale, BAND_H * scale, 44 * scale)
	ctx.fillStyle = palette.accent
	ctx.fill()

	const innerX = PAD * scale
	const innerW = (RESULT_CARD_SIZE - PAD * 2) * scale
	ctx.textBaseline = 'alphabetic'
	ctx.textAlign = 'left'

	// Wordmark left, product day right.
	ctx.fillStyle = palette.text
	ctx.font = `600 ${Math.round(44 * scale)}px ${display}`
	ctx.fillText('Puzzled', innerX, 134 * scale)
	if (model.dayDisplay) {
		ctx.textAlign = 'right'
		ctx.fillStyle = palette.textMuted
		ctx.font = `500 ${Math.round(32 * scale)}px ${FONT_FAMILY}`
		ctx.fillText(model.dayDisplay, innerX + innerW, 132 * scale)
		ctx.textAlign = 'left'
	}

	// The module's name is the biggest thing on the card.
	const titleSize = fitTextSize(ctx, model.gameName, innerW, 132 * scale, 64 * scale, '600')
	ctx.font = `600 ${titleSize}px ${display}`
	ctx.fillStyle = palette.text
	ctx.fillText(model.gameName, innerX, 330 * scale)

	ctx.font = `600 ${Math.round(44 * scale)}px ${FONT_FAMILY}`
	ctx.fillStyle = palette.text
	ctx.fillText(model.status === 'won' ? strings.statusWon : strings.statusLost, innerX, 418 * scale)

	// Chips: up to four glanceable facts on white cards.
	const chips = resultCardChips(model, strings)
	const chipY = 540 * scale
	const chipH = 136 * scale
	if (chips.length > 0) {
		const gap = 20 * scale
		const chipW = (innerW - gap * (chips.length - 1)) / chips.length
		for (let i = 0; i < chips.length; i += 1) {
			const chip = chips[i]
			if (!chip) continue
			const x = innerX + i * (chipW + gap)
			roundedRect(ctx, x, chipY, chipW, chipH, 26 * scale)
			ctx.fillStyle = palette.chipBg
			ctx.fill()
			ctx.strokeStyle = palette.chipStroke
			ctx.lineWidth = 2 * scale
			ctx.stroke()

			ctx.textAlign = 'center'
			ctx.fillStyle = palette.textMuted
			ctx.font = `600 ${Math.round(26 * scale)}px ${FONT_FAMILY}`
			ctx.fillText(chip.label, x + chipW / 2, chipY + 50 * scale)
			const valueSize = fitTextSize(
				ctx,
				chip.value,
				chipW - 40 * scale,
				56 * scale,
				28 * scale,
				'700',
			)
			ctx.fillStyle = palette.text
			ctx.font = `700 ${valueSize}px ${FONT_FAMILY}`
			ctx.fillText(chip.value, x + chipW / 2, chipY + 110 * scale)
			ctx.textAlign = 'left'
		}
	}

	// Pattern: hit / near / miss tiles, capped by the model (12x12).
	if (model.pattern) {
		const rows = model.pattern.length
		let cols = 0
		for (const row of model.pattern) cols = Math.max(cols, row.length)
		const gap = 12 * scale
		const bandTop = (chips.length > 0 ? 716 : 540) * scale
		const bandBottom = 940 * scale
		const availH = bandBottom - bandTop
		const availW = Math.min(innerW, 720 * scale)
		const tile = Math.max(
			10,
			Math.min(88 * scale, (availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows),
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
					tile * 0.2,
				)
				ctx.fillStyle =
					value === 'hit' ? palette.tileHit : value === 'near' ? palette.tileNear : palette.tileMiss
				ctx.fill()
			}
		}
	}

	// Footer: the dated deep link, the one string that must survive a re-share.
	ctx.strokeStyle = palette.frame
	ctx.lineWidth = 2 * scale
	ctx.beginPath()
	ctx.moveTo(innerX, 966 * scale)
	ctx.lineTo(innerX + innerW, 966 * scale)
	ctx.stroke()
	ctx.textAlign = 'center'
	ctx.fillStyle = palette.textMuted
	ctx.font = `500 ${Math.round(28 * scale)}px ${FONT_FAMILY}`
	ctx.fillText(model.deepLink, innerX + innerW / 2, 1020 * scale)
	ctx.textAlign = 'left'

	ctx.restore()
}

/** The page's resolved display family, when the page has one. */
function pageDisplayFamily(): string | undefined {
	if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return undefined
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue('--font-display-family')
		.trim()
	return value || undefined
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
	if (document.fonts?.ready) await document.fonts.ready
	paintResultCard(ctx, model, strings, { size, displayFamily: pageDisplayFamily() })
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
	return model.dayKey ? `puzzled-result-${slug}-${model.dayKey}.png` : `puzzled-result-${slug}.png`
}
