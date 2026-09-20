import {
	ArrowRight,
	BarChart3,
	Check,
	Flame,
	Play,
	Share2,
	ShieldCheck,
	Sparkles,
	Trophy,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

/**
 * The three trust bullets, moved out of the fold.
 *
 * They used to sit under the hero CTAs, where they read as sales reassurance
 * beside the pitch. They are true and worth saying; they are not the day, so
 * they sit with the evergreen explainer instead.
 */
export async function TrustBand() {
	const t = await getTranslations('home')
	const bullets = [t('hero.trustFree'), t('hero.trustAccount'), t('hero.trustReset')]

	return (
		<section className="pb-6">
			<div className="page-shell-wide">
				<ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
					{bullets.map((bullet) => (
						<li key={bullet} className="inline-flex items-center gap-1.5">
							<Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
							{bullet}
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

/** Value props for first-time visitors — replaces an empty state, not a wall. */
export async function ValueStrip() {
	const t = await getTranslations('home')
	const values = [
		{ icon: Sparkles, title: t('value.dailyTitle'), body: t('value.dailyBody') },
		{ icon: ShieldCheck, title: t('value.honestTitle'), body: t('value.honestBody') },
		{ icon: Share2, title: t('value.shareTitle'), body: t('value.shareBody') },
	]

	return (
		<section className="pb-2">
			<div className="page-shell-wide">
				<ul className="grid gap-3 md:grid-cols-3">
					{values.map(({ icon: Icon, title, body }) => (
						<li key={title} className="rounded-2xl border border-border/70 bg-surface-muted/60 p-5">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<Icon className="h-5 w-5" aria-hidden="true" />
							</span>
							<h3 className="mt-3 font-display text-base font-bold">{title}</h3>
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

/** Member summary: the numbers that make a habit visible. */
export async function MemberStatsBand({
	currentStreak,
	bestStreak,
	totalGamesPlayed,
}: MemberStatsBandProps) {
	const t = await getTranslations('home')
	const stats = [
		{
			icon: Flame,
			label: t('member.currentStreak'),
			value: currentStreak,
			tone: 'text-stat-streak',
		},
		{ icon: Trophy, label: t('member.bestStreak'), value: bestStreak, tone: 'text-amber-500' },
		{
			icon: BarChart3,
			label: t('member.gamesPlayed'),
			value: totalGamesPlayed,
			tone: 'text-primary',
		},
	]

	return (
		<section className="pb-2">
			<div className="page-shell-wide">
				<div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-surface-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
					<ul className="grid flex-1 grid-cols-3 gap-3">
						{stats.map(({ icon: Icon, label, value, tone }) => (
							<li key={label} className="flex items-center gap-2.5">
								<span
									className={cn(
										'flex h-9 w-9 items-center justify-center rounded-xl bg-background',
										tone,
									)}
								>
									<Icon className="h-4 w-4" aria-hidden="true" />
								</span>
								<span>
									<span className="block font-display text-lg font-extrabold leading-none tnum">
										{value}
									</span>
									<span className="block text-[11px] text-muted-foreground">{label}</span>
								</span>
							</li>
						))}
					</ul>
					<Link
						href="/stats"
						className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
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
		<section className="pt-2">
			<div className="page-shell-wide">
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-background/60 px-4 py-3.5 text-sm">
					<p className="text-muted-foreground">
						<span className="font-semibold text-foreground">
							{t('tomorrow.title', { game: gameName })}
						</span>{' '}
						{t('tomorrow.body')}
					</p>
					<Link
						href="/games"
						className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
					>
						{t('tomorrow.cta')}
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	)
}

/** Evergreen explainer: what the product is and how a day works. */
export async function HowItWorks() {
	const t = await getTranslations('home')
	const steps = [
		{ title: t('how.step1Title'), body: t('how.step1Body') },
		{ title: t('how.step2Title'), body: t('how.step2Body') },
		{ title: t('how.step3Title'), body: t('how.step3Body') },
	]

	return (
		<section className="section-block">
			<div className="page-shell-wide">
				<h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
					{t('how.title')}
				</h2>
				<p className="mt-2 max-w-2xl text-muted-foreground">{t('how.subtitle')}</p>
				<ol className="mt-6 grid gap-3 md:grid-cols-3">
					{steps.map((step, index) => (
						<li key={step.title} className="rounded-2xl border border-border/70 bg-card p-5">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-extrabold text-primary tnum">
								{index + 1}
							</span>
							<h3 className="mt-3 font-display text-base font-bold">{step.title}</h3>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	)
}

type FinalCtaProps = {
	freeGameSlug: string
	freeGameName: string
	gameCount: number
}

export async function FinalCta({ freeGameSlug, freeGameName, gameCount }: FinalCtaProps) {
	const t = await getTranslations('home')

	return (
		<section className="pb-12 md:pb-16">
			<div className="page-shell-wide">
				<div className="surface-ink relative overflow-hidden rounded-3xl px-6 py-10 text-center md:px-12 md:py-14">
					<div
						className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40"
						aria-hidden="true"
					/>
					<div className="relative">
						<h2 className="font-display text-2xl font-extrabold tracking-tight text-balance md:text-4xl">
							{t('final.title')}
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm text-white/75 md:text-base">
							{t('final.body', { count: gameCount })}
						</p>
						<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
							<Link
								href={`/games/${freeGameSlug}`}
								className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
							>
								<Play className="h-4 w-4" aria-hidden="true" />
								{t('final.play', { game: freeGameName })}
							</Link>
							<Link
								href="/games"
								className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/25 px-5 font-semibold text-white transition-colors hover:bg-white/10"
							>
								{t('final.explore')}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
