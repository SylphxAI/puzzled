import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

/**
 * Dynamic Open Graph card, one per page.
 *
 * Imagery v2: the card wears the midnight skin instead of a generic gradient -
 * ink ground (#0e1226), warm paper text (#faf6ef) and the four tiles of the
 * mark with the amber piece lit. The `theme` search param still carries the
 * game colour slug from src/games/theme-colors.ts; each entry resolves to two
 * glow hues that read on ink, and the default is the brand warm pair. Text is
 * clamped: social cards are decorative and the crawler only reads the tags.
 */

const INK = '#0e1226'
const PAPER = '#faf6ef'
const AMBER = '#fbbf24'
const PAPER_MUTED = 'rgba(250, 246, 239, 0.72)'

/** Glow hues per game theme slug, tuned to sit on the ink ground. */
const THEMES: Record<string, [string, string]> = {
	violet: ['#8b5cf6', '#c4b5fd'],
	emerald: ['#10b981', '#6ee7b7'],
	cyan: ['#06b6d4', '#67e8f9'],
	amber: ['#f59e0b', '#fcd34d'],
	pink: ['#ec4899', '#f9a8d4'],
	rose: ['#f43f5e', '#fda4af'],
	blue: ['#3b82f6', '#93c5fd'],
	sky: ['#0ea5e9', '#7dd3fc'],
	orange: ['#f97316', '#fdba74'],
	lime: ['#84cc16', '#bef264'],
	slate: ['#64748b', '#cbd5e1'],
}

const DEFAULT_THEME: [string, string] = ['#ea580c', '#f59e0b']

let cachedFont: ArrayBuffer | null | undefined

/**
 * Space Grotesk for the title. ImageResponse (satori) parses TTF/OTF/WOFF and
 * next/font only emits WOFF2, so the display face is vendored at
 * public/fonts/space-grotesk-700.ttf and read per render. Without that file
 * the card falls back to the built-in sans with the tighter tracking below,
 * which keeps the same rhythm at card size; the read is optional on purpose so
 * the route cannot fail on a missing font.
 */
function displayFont(): ArrayBuffer | null {
	if (cachedFont !== undefined) return cachedFont
	try {
		const file = readFileSync(join(process.cwd(), 'public', 'fonts', 'space-grotesk-700.ttf'))
		cachedFont = file.buffer.slice(
			file.byteOffset,
			file.byteOffset + file.byteLength,
		) as ArrayBuffer
	} catch {
		cachedFont = null
	}
	return cachedFont
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
	const [from, to] = THEMES[params.get('theme') ?? ''] ?? DEFAULT_THEME
	const font = displayFont()

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: 72,
				background: INK,
				backgroundImage: `radial-gradient(820px 500px at 90% 2%, ${from}44, transparent 62%), radial-gradient(700px 440px at 2% 98%, ${to}2e, transparent 60%)`,
				color: PAPER,
				fontFamily: font ? 'Space Grotesk' : 'Inter, sans-serif',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: 78,
						height: 78,
						borderRadius: 22,
						background: INK,
						border: `2px solid ${AMBER}2e`,
						boxShadow: `0 0 46px ${AMBER}22`,
					}}
				>
					<svg width="48" height="48" viewBox="0 0 26 26" aria-hidden="true">
						<rect x="1.5" y="1.5" width="11" height="11" rx="3.2" fill={PAPER} />
						<rect x="13.5" y="1.5" width="11" height="11" rx="3.2" fill={PAPER} />
						<rect x="1.5" y="13.5" width="11" height="11" rx="3.2" fill={PAPER} />
						<rect x="13.5" y="13.5" width="11" height="11" rx="3.2" fill={AMBER} />
					</svg>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>Puzzled</span>
					<span style={{ fontSize: 22, color: PAPER_MUTED }}>Daily brain games</span>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
				{eyebrow ? (
					<span
						style={{
							fontSize: 24,
							letterSpacing: 4,
							textTransform: 'uppercase',
							color: AMBER,
						}}
					>
						{eyebrow}
					</span>
				) : null}
				<span style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>
					{title}
				</span>
				{subtitle ? (
					<span style={{ fontSize: 34, lineHeight: 1.3, color: PAPER_MUTED }}>{subtitle}</span>
				) : null}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 26 }}>
				<span
					style={{
						padding: '10px 24px',
						borderRadius: 999,
						background: AMBER,
						color: INK,
						fontWeight: 600,
					}}
				>
					{badge}
				</span>
				<span style={{ color: PAPER_MUTED }}>puzzled.gg</span>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			fonts: font
				? [{ name: 'Space Grotesk', data: font, weight: 700 as const, style: 'normal' as const }]
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
