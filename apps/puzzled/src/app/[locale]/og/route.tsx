import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

/**
 * Dynamic Open Graph card, one per page.
 *
 * Rendered on the edge with the brand gradient, the mark and the page's own
 * title, so shared links stop falling back to a single static banner. Text is
 * clamped: social cards are decorative, and the crawler only reads the tags.
 */

const THEMES: Record<string, [string, string]> = {
	violet: ['#7c3aed', '#d946ef'],
	emerald: ['#059669', '#22c55e'],
	cyan: ['#0891b2', '#2dd4bf'],
	amber: ['#d97706', '#fbbf24'],
	pink: ['#db2777', '#f472b6'],
	rose: ['#e11d48', '#fb7185'],
	blue: ['#2563eb', '#60a5fa'],
	sky: ['#0284c7', '#38bdf8'],
	orange: ['#ea580c', '#fb923c'],
	lime: ['#65a30d', '#a3e635'],
	slate: ['#475569', '#94a3b8'],
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
	const [from, to] = THEMES[params.get('theme') ?? ''] ?? THEMES.violet

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: '72px',
				background: '#0f0b2b',
				backgroundImage: `radial-gradient(900px 520px at 12% 8%, ${from}66, transparent 62%), radial-gradient(760px 460px at 92% 92%, ${to}55, transparent 60%)`,
				color: '#ffffff',
				fontFamily: 'Inter, sans-serif',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: 72,
						height: 72,
						borderRadius: 22,
						backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
					}}
				>
					<svg width="44" height="44" viewBox="0 0 26 26" aria-hidden="true">
						<rect x="1.5" y="1.5" width="11" height="11" rx="3.2" fill="#ffffff" />
						<rect x="13.5" y="1.5" width="11" height="11" rx="3.2" fill="#ffffff" />
						<rect x="1.5" y="13.5" width="11" height="11" rx="3.2" fill="#ffffff" />
						<rect
							x="13.5"
							y="13.5"
							width="11"
							height="11"
							rx="3.2"
							fill="#ffffff"
							fillOpacity="0.6"
						/>
					</svg>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>Puzzled</span>
					<span style={{ fontSize: 22, color: 'rgba(255,255,255,0.66)' }}>Daily brain games</span>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
				{eyebrow ? (
					<span
						style={{
							fontSize: 24,
							letterSpacing: 3,
							textTransform: 'uppercase',
							color: 'rgba(255,255,255,0.7)',
						}}
					>
						{eyebrow}
					</span>
				) : null}
				<span style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
					{title}
				</span>
				{subtitle ? (
					<span style={{ fontSize: 34, lineHeight: 1.3, color: 'rgba(255,255,255,0.78)' }}>
						{subtitle}
					</span>
				) : null}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 26 }}>
				<span
					style={{
						padding: '10px 22px',
						borderRadius: 999,
						backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
						fontWeight: 600,
					}}
				>
					{badge}
				</span>
				<span style={{ color: 'rgba(255,255,255,0.7)' }}>puzzled.gg</span>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			headers: {
				// Cards are immutable per query string and safe to cache at the edge.
				'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
				// Social images are not search content.
				'x-robots-tag': 'noindex',
			},
		},
	)
}
