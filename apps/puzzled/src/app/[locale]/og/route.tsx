import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import {
	MARK_AMBER,
	MARK_HOOK_PATH,
	WORDMARK_PATH,
	WORDMARK_VIEWBOX,
} from '@/shared/components/brand/mark'

/**
 * Dynamic Open Graph card, one per page.
 *
 * Paper ground and ink type, like the site. The `theme` search param carries
 * a game colour slug (src/games/theme-colors.ts): the right-hand panel takes
 * that game's field colour; site pages without one get the ink panel. The
 * panel holds the brand mark. Text is clamped: social cards are decorative.
 */

const INK = '#1a1712'
const PAPER = '#f7f4ee'
const MUTED = '#5f584c'

let cachedFont: ArrayBuffer | null | undefined

/**
 * Fraunces for the title. ImageResponse (satori) cannot read WOFF2, so the
 * display face is vendored as public/fonts/fraunces-600.ttf. The read is
 * optional on purpose, so the route cannot fail on a missing font.
 */
function displayFont(): ArrayBuffer | null {
	if (cachedFont !== undefined) return cachedFont
	try {
		const file = readFileSync(join(process.cwd(), 'public', 'fonts', 'fraunces-600.ttf'))
		cachedFont = file.buffer.slice(
			file.byteOffset,
			file.byteOffset + file.byteLength,
		) as ArrayBuffer
	} catch {
		cachedFont = null
	}
	return cachedFont
}

function panelColors(theme: string | null): { field: string; glyph: string } {
	if (!theme) return { field: INK, glyph: PAPER }
	try {
		const colors = getGameColors(theme as GameColorTheme)
		return colors ? { field: colors.hex, glyph: INK } : { field: INK, glyph: PAPER }
	} catch {
		return { field: INK, glyph: PAPER }
	}
}

function clamp(value: string | null, max: number): string {
	if (!value) return ''
	return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function GET(request: NextRequest) {
	const params = request.nextUrl.searchParams
	const title = clamp(params.get('title'), 64) || 'Puzzled'
	const subtitle = clamp(params.get('subtitle'), 96)
	const eyebrow = clamp(params.get('eyebrow'), 32)
	const badge = clamp(params.get('badge'), 32) || 'Free puzzle every day'
	const panel = panelColors(params.get('theme'))
	const font = displayFont()
	const [, , wordW, wordH] = WORDMARK_VIEWBOX.split(' ').map(Number)

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				padding: 64,
				gap: 56,
				background: PAPER,
				color: INK,
				fontFamily: 'sans-serif',
			}}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
				}}
			>
				<svg
					width={Math.round((34 * (wordW ?? 1)) / (wordH ?? 1))}
					height="34"
					viewBox={WORDMARK_VIEWBOX}
					aria-hidden="true"
				>
					<path d={WORDMARK_PATH} fill={INK} />
				</svg>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
					{eyebrow ? (
						<span
							style={{ fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: MUTED }}
						>
							{eyebrow}
						</span>
					) : null}
					<span
						style={{
							fontFamily: font ? 'Fraunces' : 'serif',
							fontSize: 76,
							fontWeight: 600,
							lineHeight: 1.04,
							letterSpacing: -1.2,
						}}
					>
						{title}
					</span>
					{subtitle ? (
						<span style={{ fontSize: 30, lineHeight: 1.3, color: MUTED }}>{subtitle}</span>
					) : null}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 24 }}>
					<span
						style={{
							padding: '10px 22px',
							borderRadius: 999,
							background: INK,
							color: PAPER,
							fontWeight: 600,
						}}
					>
						{badge}
					</span>
					<span style={{ color: MUTED }}>puzzled.gg</span>
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: 400,
					height: 502,
					borderRadius: 48,
					background: panel.field,
				}}
			>
				<svg width="220" height="220" viewBox="0 0 64 64" aria-hidden="true">
					<path
						d={MARK_HOOK_PATH}
						fill="none"
						stroke={panel.glyph}
						strokeWidth={8}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<rect x="27" y="46" width="10" height="10" rx="2.6" fill={MARK_AMBER} />
				</svg>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			fonts: font
				? [{ name: 'Fraunces', data: font, weight: 600 as const, style: 'normal' as const }]
				: [],
			headers: {
				// Cards are immutable per query string and safe to cache at the edge.
				'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
				// Social images are not search content.
				'x-robots-tag': 'noindex',
			},
		},
	)
}
