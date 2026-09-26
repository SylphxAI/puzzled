import { ArrowRight, BarChart3, Flame, Share2, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'

/** What a first-time visitor gets, said once, in three plain columns. */
export async function ValueStrip() {
	const t = await getTranslations('home')
	const values = [
		{ icon: Sparkles, title: t('value.dailyTitle'), body: t('value.dailyBody') },
		{ icon: ShieldCheck, title: t('value.honestTitle'), body: t('value.honestBody') },
		{ icon: Share2, title: t('value.shareTitle'), body: t('value.shareBody') },
	]

	return (
		<section className="pb-10 md:pb-14">
			<div className="page-shell-wide">
				<ul className="grid gap-6 border-t border-border pt-6 md:grid-cols-3 md:gap-8 md:pt-8">
					{values.map(({ icon: Icon, title, body }) => (
						<li key={title}>
							<Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
							<h3 className="mt-2.5 text-[15px] font-semibold">{title}</h3>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

type MemberStatsBandProps = {
	currentStreak: number
	bestStreak: number
	totalGamesPlayed: number
}

/** Member summary: three numbers that make the habit visible. */
export async function MemberStatsBand({
	currentStreak,
	bestStreak,
	totalGamesPlayed,
}: MemberStatsBandProps) {
	const t = await getTranslations('home')
	const stats = [
		{ icon: Flame, label: t('member.currentStreak'), value: currentStreak },
		{ icon: Trophy, label: t('member.bestStreak'), value: bestStreak },
		{ icon: BarChart3, label: t('member.gamesPlayed'), value: totalGamesPlayed },
	]

	return (
		<section className="pb-10 md:pb-14">
			<div className="page-shell-wide">
				<div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
					<ul className="grid grid-cols-3 divide-x divide-border">
						{stats.map(({ icon: Icon, label, value }) => (
							<li key={label} className="px-3 text-center first:pl-0 last:pr-0">
								<span className="block font-display text-3xl leading-none tnum sm:text-4xl">
									{value}
								</span>
								<span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
									<Icon className="h-3.5 w-3.5" aria-hidden="true" />
									{label}
								</span>
							</li>
						))}
					</ul>
					<Link
						href="/stats"
						className="pressable mt-4 flex h-11 items-center justify-center gap-1.5 rounded-full border border-border text-sm font-semibold transition-colors hover:bg-muted"
					>
						{t('member.viewStats')}
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	)
}

/** Gentle tomorrow teaser. No countdown pressure, no streak threats. */
export async function TomorrowBand({ gameName }: { gameName: string }) {
	const t = await getTranslations('home')

	return (
		<section className="pb-10 md:pb-14">
			<div className="page-shell-wide">
				<p className="text-center text-[15px] text-muted-foreground">
					<span className="font-display text-lg text-foreground">
						{t('tomorrow.title', { game: gameName })}
					</span>{' '}
					{t('tomorrow.body')}
				</p>
			</div>
		</section>
	)
}
