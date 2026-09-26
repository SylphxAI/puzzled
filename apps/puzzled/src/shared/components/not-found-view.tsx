import { Home, LifeBuoy, Play } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { playerTitle, slugToCamelCase } from '@/lib/game-slug'
import { localizedPath } from '@/lib/seo/metadata'
import { BrandMark } from './brand/mark'

/** Every string the 404 body renders, already resolved for the locale. */
export type NotFoundLabels = {
	eyebrow: string
	title: string
	description: string
	playCta: string
	browseCta: string
	home: string
	support: string
}

export type NotFoundContent = {
	labels: NotFoundLabels
	/** Today's free module: the play-first target of the dead end. */
	freeGame: string
}

/**
 * Resolve the 404 copy for one locale.
 *
 * Takes the locale explicitly so the root `not-found.tsx` — which renders
 * outside `[locale]/layout.tsx` and therefore has no next-intl provider — can
 * use the same copy as the in-locale page.
 */
export async function buildNotFoundContent(locale: string): Promise<NotFoundContent> {
	const [t, tNav, tRoot] = await Promise.all([
		getTranslations({ locale, namespace: 'common' }),
		getTranslations({ locale, namespace: 'nav' }),
		getTranslations({ locale }),
	])
	const freeGame = getTodaysFreeGame()
	const freeGameName = tRoot(`games.${slugToCamelCase(freeGame)}.name`, {
		defaultValue: playerTitle(freeGame),
	})

	return {
		freeGame,
		labels: {
			eyebrow: t('notFound.eyebrow'),
			title: t('notFound.title'),
			description: t('notFound.description'),
			playCta: t('notFound.playCta', { game: freeGameName }),
			browseCta: t('notFound.browseCta'),
			home: tNav('home'),
			support: tNav('support'),
		},
	}
}

/**
 * The 404 body, shared by `app/[locale]/not-found.tsx` (inside the locale
 * chrome) and `app/not-found.tsx` (for paths that match no route at all).
 *
 * The unmatched-route document is rendered without any layout, so it never
 * receives the app stylesheet — a self-contained stylesheet keeps both cases
 * identical instead of shipping an unstyled page to the one audience that is
 * already lost. Values mirror the tokens in `globals.css` (paper, ink, the
 * serif display face, 44px targets) with a dark-mode variant.
 *
 * Play-first: the dead end still offers today's free puzzle, then the
 * catalogue, then the way home — every target is a real, indexable route and
 * keeps the visitor's locale prefix, so a 404 never bounces through a redirect.
 */
export function NotFoundView({
	locale,
	labels,
	freeGame,
}: {
	locale: string
	labels: NotFoundLabels
	freeGame: string
}) {
	const href = (path: string) => localizedPath(locale, path)

	return (
		<main className="nf-shell">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static stylesheet, no user input */}
			<style dangerouslySetInnerHTML={{ __html: NOT_FOUND_STYLES }} />
			<div className="nf-card">
				<span className="nf-mark">
					<BrandMark size={64} />
				</span>

				<p className="nf-eyebrow">{labels.eyebrow}</p>
				<h1 className="nf-title">{labels.title}</h1>
				<p className="nf-description">{labels.description}</p>

				<div className="nf-actions">
					<Link href={href(`/games/${freeGame}`)} className="nf-cta nf-cta-primary">
						<Play className="nf-icon" aria-hidden="true" />
						{labels.playCta}
					</Link>
					<Link href={href('/games')} className="nf-cta nf-cta-secondary">
						{labels.browseCta}
					</Link>
				</div>

				<div className="nf-links">
					<Link href={href('/')} className="nf-link">
						<Home className="nf-icon" aria-hidden="true" />
						{labels.home}
					</Link>
					<Link href={href('/support')} className="nf-link">
						<LifeBuoy className="nf-icon" aria-hidden="true" />
						{labels.support}
					</Link>
				</div>
			</div>
		</main>
	)
}

/**
 * Scoped stylesheet for the 404 document. Deliberately small: no layout CSS is
 * available on the unmatched-route path, and this page must not depend on one.
 */
const NOT_FOUND_STYLES = `
.nf-shell {
	--nf-paper: #f7f4ee; --nf-ink: #1a1712; --nf-muted: #5f584c; --nf-line: #e4ded2; --nf-card: #ffffff;
	display: flex;
	min-height: 100vh;
	align-items: center;
	justify-content: center;
	padding: 4rem 1rem;
	background: var(--nf-paper);
	color: var(--nf-ink);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Noto Sans TC", sans-serif;
	-webkit-font-smoothing: antialiased;
}
.nf-card { width: 100%; max-width: 32rem; text-align: center; }
.nf-mark { display: inline-flex; }
.nf-eyebrow {
	margin: 1.5rem 0 0;
	font-size: 0.75rem;
	font-weight: 600;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--nf-muted);
}
.nf-title {
	margin: 0.5rem 0 0;
	font-family: var(--font-display-family), "Iowan Old Style", "Palatino Linotype", Georgia, serif;
	font-size: 2.25rem;
	line-height: 1.08;
	font-weight: 600;
	letter-spacing: -0.015em;
	text-wrap: balance;
}
.nf-description {
	margin: 1rem auto 0;
	max-width: 26rem;
	font-size: 1.0625rem;
	line-height: 1.55;
	color: var(--nf-muted);
}
.nf-actions {
	margin-top: 2rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	justify-content: center;
}
.nf-cta {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	min-height: 3rem;
	padding: 0 1.5rem;
	border-radius: 999px;
	font-size: 0.9375rem;
	font-weight: 600;
	text-decoration: none;
	transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
.nf-cta:active { transform: scale(0.97); }
.nf-cta-primary { background: var(--nf-ink); color: var(--nf-paper); }
.nf-cta-secondary { border: 1px solid var(--nf-line); background: var(--nf-card); color: var(--nf-ink); }
.nf-links {
	margin-top: 1.25rem;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.25rem 1rem;
}
.nf-link {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	min-height: 2.75rem;
	padding: 0 0.5rem;
	font-size: 0.9375rem;
	font-weight: 500;
	color: var(--nf-muted);
	text-decoration: none;
}
.nf-link:hover { color: var(--nf-ink); }
.nf-cta:focus-visible, .nf-link:focus-visible { outline: 2px solid #2458d6; outline-offset: 2px; }
.nf-icon { width: 1rem; height: 1rem; flex: none; }
@media (min-width: 640px) {
	.nf-title { font-size: 3rem; }
	.nf-actions { flex-direction: row; }
}
@media (prefers-color-scheme: dark) {
	.nf-shell { --nf-paper: #121110; --nf-ink: #f2eee6; --nf-muted: #aaa396; --nf-line: #2f2c27; --nf-card: #1c1b18; }
}
.dark .nf-shell { --nf-paper: #121110; --nf-ink: #f2eee6; --nf-muted: #aaa396; --nf-line: #2f2c27; --nf-card: #1c1b18; }
.light .nf-shell { --nf-paper: #f7f4ee; --nf-ink: #1a1712; --nf-muted: #5f584c; --nf-line: #e4ded2; --nf-card: #ffffff; }
`
