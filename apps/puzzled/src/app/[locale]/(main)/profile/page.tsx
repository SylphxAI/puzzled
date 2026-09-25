export const dynamic = 'force-dynamic'

import { BadgeCheck, BarChart3, Flame, Trophy, UserCircle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import {
	getServerStreakInfo,
	getServerUserStats,
	type StreakInfo,
	type UserStats,
} from '@/lib/api/server'
import { Link, redirect } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { cn } from '@/lib/utils'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/profile',
		title: t('playerCard.pageTitle'),
		description: t('playerCard.pageDescription'),
		imagePath: ogImagePath({
			title: t('playerCard.pageTitle'),
			subtitle: t('playerCard.pageDescription'),
			eyebrow: 'Puzzled',
		}),
		// A player's own identity page, not search content.
		noindex: true,
	})
}

function initials(value: string): string {
	const words = value.trim().split(/\s+/).slice(0, 2)
	return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * The player's own card.
 *
 * Identity comes from the session, progress from the same Connect reads the
 * stats console uses, and anything unreadable is left unstated instead of being
 * filled in with a zero.
 */
export default async function ProfilePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('settings')

	const user = await withPresentationDeadline(currentUser(), null)
	if (!user) {
		redirect({ href: { pathname: '/login', query: { callbackUrl: '/profile' } }, locale })
		// `redirect` throws; returning keeps the type narrowing honest if it ever
		// resolves instead.
		return null
	}

	const [statsResult, streakResult] = await Promise.allSettled([
		getServerUserStats(),
		getServerStreakInfo(),
	])
	const stats: UserStats | null = statsResult.status === 'fulfilled' ? statsResult.value : null
	const streak: StreakInfo | null = streakResult.status === 'fulfilled' ? streakResult.value : null
	const finished = stats
		? Object.values(stats).reduce((sum, entry) => sum + entry.gamesPlayed, 0)
		: null
	const won = stats ? Object.values(stats).reduce((sum, entry) => sum + entry.gamesWon, 0) : null

	const displayName = user.name?.trim() || t('playerCard.nameFallback')
	const memberSince =
		user.createdAt && !Number.isNaN(Date.parse(user.createdAt))
			? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(user.createdAt))
			: null

	const links = [
		{ href: '/stats', icon: BarChart3, label: t('playerCard.recordLink') },
		{ href: '/leaderboard', icon: Trophy, label: t('playerCard.boardLink') },
		{ href: '/settings/account', icon: UserCircle, label: t('playerCard.settingsLink') },
		{ href: '/settings/privacy', icon: BadgeCheck, label: t('playerCard.privacyLink') },
	]

	return (
		<main className="page-shell-wide py-8 md:py-10">
			<div className="space-y-6">
				<ConsoleHeader
					eyebrow={t('playerCard.eyebrow')}
					title={t('playerCard.pageTitle')}
					description={t('playerCard.pageDescription')}
					chips={
						user.emailVerified ? (
							<span className="chip bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
								{t('playerCard.verified')}
							</span>
						) : null
					}
				/>

				<div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
					<ConsoleCard
						title={t('playerCard.identityTitle')}
						description={t('playerCard.identityDescription')}
					>
						<div className="flex items-start gap-4">
							<span
								className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 font-display text-xl font-extrabold text-white"
								aria-hidden="true"
							>
								{initials(displayName)}
							</span>
							<div className="min-w-0">
								<p className="font-display text-lg font-bold">{displayName}</p>
								{user.email ? (
									<p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
								) : null}
								{memberSince ? (
									<p className="mt-2 text-xs text-muted-foreground">
										{t('playerCard.memberSince', { date: memberSince })}
									</p>
								) : null}
							</div>
						</div>
					</ConsoleCard>

					<ConsoleCard
						title={t('playerCard.progressTitle')}
						description={t('playerCard.progressDescription')}
					>
						<dl className="grid grid-cols-3 gap-3 text-center">
							<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
								<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									{t('playerCard.stats.gamesPlayed')}
								</dt>
								<dd
									className={cn(
										'mt-1 font-display text-2xl font-extrabold tnum',
										finished === null && 'text-muted-foreground',
									)}
								>
									{finished === null ? t('playerCard.notLoaded') : finished}
								</dd>
							</div>
							<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
								<dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									{t('playerCard.stats.winRate')}
								</dt>
								<dd className="mt-1 font-display text-2xl font-extrabold tnum">
									{stats === null || won === null || finished === null
										? t('playerCard.notLoaded')
										: finished > 0
											? `${Math.round((won / finished) * 100)}%`
											: t('playerCard.noFinishes')}
								</dd>
							</div>
							<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-3">
								<dt className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									<Flame className="h-3.5 w-3.5 text-stat-streak" aria-hidden="true" />
									{t('playerCard.stats.streak')}
								</dt>
								<dd className="mt-1 font-display text-2xl font-extrabold tnum">
									{streak === null ? t('playerCard.notLoaded') : streak.currentStreak}
								</dd>
							</div>
						</dl>
						{stats === null || streak === null ? (
							<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
								{t('playerCard.progressNote')}
							</p>
						) : null}
					</ConsoleCard>
				</div>

				<ConsoleCard
					title={t('playerCard.linksTitle')}
					description={t('playerCard.linksDescription')}
				>
					<ul className="grid gap-2 sm:grid-cols-2">
						{links.map(({ href, icon: Icon, label }) => (
							<li key={href}>
								<Link
									href={href}
									className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border/70 bg-surface-muted/60 px-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
									{label}
								</Link>
							</li>
						))}
					</ul>
				</ConsoleCard>
			</div>
		</main>
	)
}
