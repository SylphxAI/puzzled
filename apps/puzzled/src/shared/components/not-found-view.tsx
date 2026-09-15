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
 * already lost. Values mirror `globals.css` (brand gradient, ink/slate text,
 * 44px targets) with a dark-mode variant.
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
	display: flex;
	min-height: 100vh;
	align-items: center;
	justify-content: center;
	padding: 4rem 1rem;
	background: #ffffff;
	color: #0f172a;
	font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.nf-card { width: 100%; max-width: 34rem; text-align: center; }
.nf-mark {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 64px;
	border-radius: 19px;
	background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
	box-shadow: 0 8px 24px rgba(99, 102, 241, 0.28);
}
.nf-mark svg rect { fill: #ffffff; }
.nf-eyebrow {
	margin: 1.5rem 0 0;
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.3em;
	text-transform: uppercase;
	color: #64748b;
}
.nf-title {
	margin: 0.75rem 0 0;
	font-size: 1.875rem;
	line-height: 1.15;
	font-weight: 800;
	letter-spacing: -0.02em;
}
.nf-description {
	margin: 1rem auto 0;
	max-width: 26rem;
	font-size: 1rem;
	line-height: 1.6;
	color: #475569;
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
	min-height: 2.75rem;
	padding: 0 1.5rem;
	border-radius: 1rem;
	font-size: 0.875rem;
	font-weight: 600;
	text-decoration: none;
}
.nf-cta-primary {
	background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
	color: #ffffff;
	box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}
.nf-cta-secondary { border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; }
.nf-cta-secondary:hover { background: #f1f5f9; }
.nf-cta-primary:hover { filter: brightness(1.05); }
.nf-links {
	margin-top: 1.5rem;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.5rem 1rem;
}
.nf-link {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	min-height: 2.75rem;
	padding: 0 0.5rem;
	font-size: 0.875rem;
	font-weight: 600;
	color: #64748b;
	text-decoration: none;
}
.nf-link:hover { color: #0f172a; }
.nf-cta:focus-visible, .nf-link:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
.nf-icon { width: 1rem; height: 1rem; flex: none; }
@media (min-width: 640px) {
	.nf-title { font-size: 2.25rem; }
	.nf-actions { flex-direction: row; }
}
@media (prefers-color-scheme: dark) {
	.nf-shell { background: #0f172a; color: #f8fafc; }
	.nf-eyebrow, .nf-link { color: #94a3b8; }
	.nf-description { color: #cbd5e1; }
	.nf-cta-secondary { border-color: #334155; background: #1e293b; color: #f8fafc; }
	.nf-cta-secondary:hover { background: #273449; }
	.nf-link:hover { color: #f8fafc; }
}
.dark .nf-shell { background: #0f172a; color: #f8fafc; }
.dark .nf-eyebrow, .dark .nf-link { color: #94a3b8; }
.dark .nf-description { color: #cbd5e1; }
.dark .nf-cta-secondary { border-color: #334155; background: #1e293b; color: #f8fafc; }
.dark .nf-link:hover { color: #f8fafc; }
`
