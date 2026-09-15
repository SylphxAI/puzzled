import { Crown, Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

type GameUnlockPanelProps = {
	slug: string
	theme: GameColorTheme
	gameCount: number
	/** No account on this request. */
	isGuest: boolean
	/** Today's free-rotation module, offered as the honest alternative. */
	freeGameSlug: string
	freeGameName: string
}

/**
 * The honest path for a premium module the viewer cannot open today.
 *
 * It states what premium unlocks, links to the plans, keeps the sign-in route
 * for guests, and always points at today's free module so the page is never a
 * dead end.
 */
export async function GameUnlockPanel({
	slug,
	theme,
	gameCount,
	isGuest,
	freeGameSlug,
	freeGameName,
}: GameUnlockPanelProps) {
	const t = await getTranslations('catalog')
	const colors = getGameColors(theme)

	return (
		<div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 text-center shadow-card md:p-8">
			<div
				className={cn('pointer-events-none absolute inset-0 opacity-70', colors.pattern)}
				aria-hidden="true"
			/>
			<div className="relative mx-auto flex max-w-lg flex-col items-center gap-4">
				<span
					className={cn(
						'flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md',
						colors.gradient,
					)}
				>
					<Lock className="h-7 w-7" aria-hidden="true" />
				</span>
				<h2 className="font-display text-xl font-extrabold tracking-tight md:text-2xl">
					{t('gamePage.lockedTitle')}
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{t('gamePage.lockedBody', { count: gameCount })}
				</p>

				<div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
					<Link
						href="/pricing"
						className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
					>
						<Crown className="h-4 w-4" aria-hidden="true" />
						{t('gamePage.lockedCta')}
					</Link>
					{isGuest && (
						<Link
							href={`/login?callbackUrl=/games/${slug}`}
							className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold transition-colors hover:border-primary/30 hover:text-primary"
						>
							{t('gamePage.lockedSignIn')}
						</Link>
					)}
				</div>

				<p className="text-sm text-muted-foreground">
					{t('gamePage.todaysFree')}{' '}
					<Link
						href={`/games/${freeGameSlug}`}
						className="font-semibold text-primary hover:underline"
					>
						{freeGameName}
					</Link>
				</p>
			</div>
		</div>
	)
}
