import { Crown, Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'

type GameUnlockPanelProps = {
	slug: string
	/** The request was for a past day, not another game. */
	archive: boolean
	gameCount: number
	/** No account on this request. */
	isGuest: boolean
	/** Today's free module, offered as the honest alternative. */
	freeGameSlug: string
	freeGameName: string
}

/**
 * The path for a game or day that needs Puzzled Plus: what Plus opens, the
 * plans, sign-in for guests, and today's free game, so the page is never a
 * dead end. Finished results are never taken away.
 */
export async function GameUnlockPanel({
	slug,
	archive,
	gameCount,
	isGuest,
	freeGameSlug,
	freeGameName,
}: GameUnlockPanelProps) {
	const t = await getTranslations('plus.unlock')

	return (
		<div className="rounded-3xl border border-border/70 bg-card p-6 text-center shadow-card md:p-8">
			<div className="mx-auto flex max-w-lg flex-col items-center gap-4">
				<span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Lock className="h-7 w-7" aria-hidden="true" />
				</span>
				<h2 className="font-display text-xl md:text-2xl">
					{archive ? t('archiveTitle') : t('title')}
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{t('body', { game: freeGameName, count: gameCount })}
				</p>
				<div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
					<Link
						href="/pricing"
						className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25"
					>
						<Crown className="h-4 w-4" aria-hidden="true" />
						{t('cta')}
					</Link>
					{isGuest ? (
						<Link
							href={{ pathname: '/login', query: { callbackUrl: `/games/${slug}` } }}
							className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold hover:border-primary/30 hover:text-primary"
						>
							{t('signIn')}
						</Link>
					) : null}
					{slug !== freeGameSlug || archive ? (
						<Link
							href={`/games/${freeGameSlug}`}
							className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background px-5 font-semibold hover:border-primary/30 hover:text-primary"
						>
							{t('playFree', { game: freeGameName })}
						</Link>
					) : null}
				</div>
				<p className="text-xs text-muted-foreground">{t('keep')}</p>
			</div>
		</div>
	)
}
